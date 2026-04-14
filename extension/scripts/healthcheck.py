import argparse
import ctypes
import hashlib
import json
import os
import sys
import time
import threading

current_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.dirname(current_dir, "..", "..")
extension_debug_dir = os.path.join(repo_root, "extension", "out", "build", "x64-debug")
extension_release_dir = os.path.join(repo_root, "extension", "out", "build", "x64-release")

def annotate(level: str, message: str) -> None:
    # GitHub Actions annotation syntax.
    safe = (message or "").replace("\r", " ").replace("\n", " ")
    print(f"::{level}::{safe}")


def decode_cstr(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", errors="replace")
    # ctypes may already give us a str in some cases.
    return str(value)


def run_healthcheck(binary_runtime_path: str, timeout_s: float = 10.0) -> dict:
    if not os.path.exists(binary_runtime_path):
        raise FileNotFoundError(f"Binary not found: {binary_runtime_path}")
    # Helps detect "Arma loaded a different copy" scenarios.
    try:
        st = os.stat(binary_runtime_path)
        with open(binary_runtime_path, "rb") as f:
            sha256 = hashlib.sha256(f.read()).hexdigest()
    except Exception:
        st = None
        sha256 = ""

    # Payload used to prove that input JSON is parsed and echoed back.
    payload = {
        "client": "github-actions",
        "test": "healthCheck",
        "nested": {"n": 123, "ts": int(time.time())},
        "libraryPath": binary_runtime_path,
    }
    payload_json = json.dumps(payload, separators=(",", ":"))

    callback_event = threading.Event()
    callback_data_holder = {"raw": None}

    def python_callback(name, function, data):
        # Called by the extension from a detached thread.
        try:
            name_str = decode_cstr(name)
            function_str = decode_cstr(function)
            data_str = decode_cstr(data)

            callback_data_holder["raw"] = data_str
            callback_event.set()

            # Keep callback lightweight; all verification is done in main thread.
            return 1
        except Exception:
            # If callback fails, unblock main thread and let it error out.
            callback_data_holder["raw"] = None
            callback_event.set()
            return 0

    # Match Windows `__stdcall` callback vs Linux `cdecl` export.
    if os.name == "nt":
        CallbackType = ctypes.WINFUNCTYPE(ctypes.c_int, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p)
        dll_loader = ctypes.WinDLL
    else:
        CallbackType = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p)
        dll_loader = ctypes.CDLL
    callback_func = CallbackType(python_callback)

    if st is not None:
        annotate("notice", f"Loading extension binary: {binary_runtime_path} (size={st.st_size} mtime={int(st.st_mtime)})")
    else:
        annotate("notice", f"Loading extension binary: {binary_runtime_path}")
    if sha256:
        annotate("notice", f"extension sha256: {sha256}")

    try:
        if os.name == "nt":
            dll = dll_loader(binary_runtime_path)
        else:
            # Load with stricter symbol resolution to better match how Arma may dlopen the module.
            mode = getattr(ctypes, "RTLD_NOW", 2) | getattr(ctypes, "RTLD_LOCAL", 0)
            dll = dll_loader(binary_runtime_path, mode=mode)
    except OSError as e:
        raise RuntimeError(f"Failed to load extension shared library: {e}") from e

    # Register callback for returning data.
    dll.RVExtensionRegisterCallback.argtypes = [CallbackType]
    dll.RVExtensionRegisterCallback.restype = None
    dll.RVExtensionRegisterCallback(callback_func)

    # RVExtension: (output, outputSize, function)
    dll.RVExtension.argtypes = [ctypes.c_char_p, ctypes.c_uint, ctypes.c_char_p]
    dll.RVExtension.restype = None

    buffer_size = 4096
    output = ctypes.create_string_buffer(buffer_size)

    function_argument_str = f"healthCheck|{payload_json}"
    function_argument = function_argument_str.encode("utf-8")

    annotate("notice", f"Calling RVExtension with: {function_argument_str[:160]}{'...' if len(function_argument_str) > 160 else ''}")

    dll.RVExtension(output, ctypes.c_uint(buffer_size), ctypes.c_char_p(function_argument))

    if not callback_event.wait(timeout_s):
        raise TimeoutError(f"Timed out waiting for healthCheck callback after {timeout_s}s")

    raw = callback_data_holder.get("raw")
    if not raw:
        raise RuntimeError("healthCheck returned empty callback data")

    try:
        resp = json.loads(raw)
    except json.JSONDecodeError as e:
        snippet = raw if len(raw) < 400 else raw[:400] + "..."
        raise RuntimeError(f"healthCheck returned non-JSON data: {snippet} (error: {e})") from e

    # Basic validation: make sure the extension is returning expected structure.
    if resp.get("ok") is not True:
        raise RuntimeError("healthCheck response missing ok=true")

    ext = resp.get("extension") or {}
    if ext.get("name") != "A3_LAUNCHPAD_EXT":
        raise RuntimeError(f"healthCheck response extension.name mismatch (got {ext.get('name')})")

    if resp.get("function") != "healthCheck":
        raise RuntimeError("healthCheck response.function mismatch")

    echo = resp.get("echo")
    if not isinstance(echo, dict):
        raise RuntimeError("healthCheck response.echo is not an object")
    if echo.get("client") != payload.get("client"):
        raise RuntimeError("healthCheck did not echo expected client")

    lib = resp.get("library")
    if not isinstance(lib, dict) or not lib.get("path"):
        raise RuntimeError("healthCheck response.library.path is empty or invalid")

    # Success: include key metrics for annotations.
    runtime = resp.get("runtime") or {}
    annotate(
        "notice",
        "healthCheck PASS "
        f"(platform={runtime.get('platform')}, pid={runtime.get('pid')}, totalCalls={runtime.get('totalCalls')})",
    )
    annotate("notice", f"healthCheck echo parsed: client={echo.get('client')} test={echo.get('test')}")
    annotate("notice", f"healthCheck library: {lib.get('basename') or lib.get('path')}")

    return resp


def main() -> int:
    parser = argparse.ArgumentParser(description="A3_LAUNCHPAD_EXT healthCheck: validate shared library can be loaded and called.")
    parser.add_argument("--binary", required=True, help="Path to A3_LAUNCHPAD_EXT_x64.so/.dll")
    parser.add_argument("--timeout", type=float, default=12.0, help="Callback wait timeout seconds")
    args = parser.parse_args()

    try:
        resp = run_healthcheck(args.binary, timeout_s=args.timeout)
        # Expose response as a compact single-line JSON (useful for logs).
        print(json.dumps(resp, separators=(",", ":"), ensure_ascii=False))
        return 0
    except Exception as e:
        annotate("error", f"healthCheck FAIL: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

