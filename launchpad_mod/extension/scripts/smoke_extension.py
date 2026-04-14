#!/usr/bin/env python3
"""
Load the built Arma extension shared library (Linux .so), call RVExtensionVersion,
register a callback, invoke healthCheck, and assert the callback runs (async worker thread).
Used by CTest in extension/CMakeLists.txt on Linux CI.
"""
from __future__ import annotations

import ctypes
import json
import sys
import threading
import time


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: smoke_extension.py <path/to/A3_LAUNCHPAD_EXT_x64.so>", file=sys.stderr)
        return 2
    so_path = sys.argv[1]

    received = threading.Event()
    payload: list[str] = []

    def py_cb(_name, _function, data):
        try:
            raw = ctypes.cast(data, ctypes.c_char_p).value
            if raw is not None:
                payload.append(raw.decode("utf-8", errors="replace"))
        except Exception:
            pass
        received.set()
        return 1

    CFUN = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p)
    cb = CFUN(py_cb)

    try:
        lib = ctypes.CDLL(so_path)
    except OSError as e:
        print(f"ERROR: dlopen failed: {e}", file=sys.stderr)
        return 1

    lib.RVExtensionVersion.argtypes = [ctypes.c_char_p, ctypes.c_uint]
    lib.RVExtensionVersion.restype = None
    ver_buf = ctypes.create_string_buffer(512)
    lib.RVExtensionVersion(ver_buf, ctypes.c_uint(len(ver_buf)))
    ver = ver_buf.value.decode("utf-8", errors="replace")
    if "A3_LAUNCHPAD_EXT" not in ver:
        print(f"ERROR: unexpected RVExtensionVersion: {ver!r}", file=sys.stderr)
        return 1

    lib.RVExtensionRegisterCallback.argtypes = [CFUN]
    lib.RVExtensionRegisterCallback.restype = None
    lib.RVExtensionRegisterCallback(cb)

    lib.RVExtension.argtypes = [ctypes.c_char_p, ctypes.c_uint, ctypes.c_char_p]
    lib.RVExtension.restype = None
    out_buf = ctypes.create_string_buffer(4096)
    call = b'healthCheck|smoke_ci|{"client":"smoke_extension.py"}'
    lib.RVExtension(out_buf, ctypes.c_uint(len(out_buf)), call)

    if not received.wait(timeout=60.0):
        print("ERROR: callback not invoked within timeout", file=sys.stderr)
        return 1

    if not payload:
        print("ERROR: empty callback payload", file=sys.stderr)
        return 1

    body = payload[0]
    sep = body.find("|")
    rest = body[sep + 1 :] if sep != -1 else body
    try:
        obj = json.loads(rest)
    except json.JSONDecodeError as e:
        print(f"ERROR: callback JSON parse: {e}: {rest[:200]!r}", file=sys.stderr)
        return 1
    if not obj.get("ok"):
        print(f"ERROR: healthCheck ok=false: {obj!r}", file=sys.stderr)
        return 1

    # Let detached logging flush; avoids rare teardown races
    time.sleep(0.2)
    print("smoke_extension.py: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
