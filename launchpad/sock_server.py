# Local-only TCP server for framed JSON IPC with the A3_LAUNCHPAD_EXT DLL.
# Wire format matches the extension: 4-byte big-endian length + UTF-8 JSON payload.
# Not hardened for untrusted networks; bind to loopback in config.

from __future__ import annotations

import json
import logging
import socket
import threading
from collections.abc import Callable
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class HandlerType(Enum):
    MESSAGE_RECEIVED_ANY = "message_received_any"
    MESSAGE_RECEIVED_ERROR = "message_received_error"
    MESSAGE_SENT_ANY = "message_sent_any"
    MESSAGE_SENT_ERROR = "message_sent_error"


class FramedIpcService:
    """Accepts one Arma client at a time; buffers partial reads; optional push to the client."""

    MAX_FRAME_BYTES = 16 * 1024 * 1024

    def __init__(self, host: str, port: int) -> None:
        self.host = host
        self.port = int(port)
        self._handlers: dict[HandlerType, list[Callable[[Any], None]]] = {
            HandlerType.MESSAGE_RECEIVED_ANY: [],
            HandlerType.MESSAGE_RECEIVED_ERROR: [],
            HandlerType.MESSAGE_SENT_ANY: [],
            HandlerType.MESSAGE_SENT_ERROR: [],
        }
        self._listen_sock: socket.socket | None = None
        self._accept_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._client_lock = threading.Lock()
        self._client: socket.socket | None = None

    def add_handler(self, handler_type: HandlerType, callback: Callable[[Any], None]) -> None:
        self._handlers[handler_type].append(callback)

    def start_background(self) -> None:
        if self._accept_thread and self._accept_thread.is_alive():
            return
        self._stop.clear()
        self._accept_thread = threading.Thread(target=self._accept_loop, name="LaunchpadIpc", daemon=True)
        self._accept_thread.start()

    def stop(self) -> None:
        self._stop.set()
        try:
            if self._listen_sock:
                self._listen_sock.close()
        except OSError:
            pass
        with self._client_lock:
            c = self._client
            self._client = None
        if c:
            try:
                c.close()
            except OSError:
                pass
        if self._accept_thread and self._accept_thread.is_alive():
            self._accept_thread.join(timeout=2.0)

    def send(self, obj: dict[str, Any]) -> bool:
        """Send one framed JSON object to the connected client (if any)."""
        payload = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        if len(payload) > self.MAX_FRAME_BYTES:
            self._emit(HandlerType.MESSAGE_SENT_ERROR, ValueError("payload too large"))
            return False
        prefix = len(payload).to_bytes(4, "big")
        frame = prefix + payload
        with self._client_lock:
            conn = self._client
        if conn is None:
            self._emit(HandlerType.MESSAGE_SENT_ERROR, RuntimeError("no ipc client connected"))
            return False
        try:
            conn.sendall(frame)
        except OSError as e:
            self._emit(HandlerType.MESSAGE_SENT_ERROR, e)
            return False
        self._emit(HandlerType.MESSAGE_SENT_ANY, obj)
        return True

    def _emit(self, kind: HandlerType, value: Any) -> None:
        for cb in self._handlers.get(kind, []):
            try:
                cb(value)
            except Exception as e:  # noqa: BLE001 — handler diagnostics
                logger.exception("IPC handler error (%s): %s", kind.value, e)

    def _accept_loop(self) -> None:
        listen = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._listen_sock = listen
        try:
            listen.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listen.bind((self.host, self.port))
            listen.listen(8)
        except OSError as e:
            logger.error("IPC bind failed on %s:%s: %s", self.host, self.port, e)
            return

        logger.info("Launchpad IPC listening on %s:%s (framed JSON)", self.host, self.port)

        while not self._stop.is_set():
            try:
                listen.settimeout(1.0)
                conn, addr = listen.accept()
            except TimeoutError:
                continue
            except socket.timeout:
                continue
            except OSError:
                if self._stop.is_set():
                    break
                logger.exception("IPC accept failed")
                break

            logger.info("IPC client connected from %s", addr)
            with self._client_lock:
                old = self._client
                self._client = conn
            if old:
                try:
                    old.close()
                except OSError:
                    pass

            try:
                self._read_frames(conn)
            except Exception as e:  # noqa: BLE001
                self._emit(HandlerType.MESSAGE_RECEIVED_ERROR, e)
            finally:
                with self._client_lock:
                    if self._client is conn:
                        self._client = None
                try:
                    conn.close()
                except OSError:
                    pass
                logger.info("IPC client disconnected (%s)", addr)

        try:
            listen.close()
        except OSError:
            pass

    def _read_frames(self, conn: socket.socket) -> None:
        buf = bytearray()
        while not self._stop.is_set():
            chunk = conn.recv(65536)
            if not chunk:
                break
            buf.extend(chunk)
            while len(buf) >= 4:
                length = int.from_bytes(buf[:4], "big")
                if length == 0 or length > self.MAX_FRAME_BYTES:
                    raise ValueError(f"invalid frame length: {length}")
                if len(buf) < 4 + length:
                    break
                raw = bytes(buf[4 : 4 + length])
                del buf[: 4 + length]
                try:
                    msg = json.loads(raw.decode("utf-8"))
                except Exception as e:  # noqa: BLE001
                    self._emit(HandlerType.MESSAGE_RECEIVED_ERROR, e)
                    continue
                for cb in self._handlers.get(HandlerType.MESSAGE_RECEIVED_ANY, []):
                    try:
                        cb(msg)
                    except Exception as e:  # noqa: BLE001
                        self._emit(HandlerType.MESSAGE_RECEIVED_ERROR, e)
