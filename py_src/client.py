#!/usr/bin/env python3

import os
import json
import asyncio
import websockets
import logging
import hashlib
import base64
import time
import uuid
import collections
from typing import Any, Dict, List, Optional, Union

from .safety import validate_safety

OBS_WS_URL = os.environ.get("OBS_WEBSOCKET_URL", "ws://localhost:4455")
OBS_WS_PASSWORD = os.environ.get("OBS_WEBSOCKET_PASSWORD", os.environ.get("OBS_WS_PASSWORD", ""))

# Setup logging
logger = logging.getLogger("obs_client")


class EventRingBuffer:
    """Bounded circular buffer storing the last N OBS events with timestamps."""

    def __init__(self, capacity: int = 100):
        self.capacity = capacity
        self.buffer = collections.deque(maxlen=capacity)

    def push(self, event_type: str, event_intent: int = 0, event_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        record = {
            "id": str(uuid.uuid4()),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            "millis": int(time.time() * 1000),
            "eventType": event_type,
            "eventIntent": event_intent,
            "eventData": event_data or {}
        }
        self.buffer.append(record)
        return record

    def get_recent(self, limit: int = 20, event_type: Optional[str] = None) -> List[Dict[str, Any]]:
        events = list(self.buffer)
        if event_type and event_type.strip():
            query = event_type.strip().lower()
            events = [e for e in events if query in e["eventType"].lower()]
        if limit and 0 < limit < len(events):
            events = events[-limit:]
        return events

    def clear(self) -> None:
        self.buffer.clear()

    def __len__(self) -> int:
        return len(self.buffer)


class OBSWebSocketClient:
    """OBS WebSocket v5 client with full protocol support, batch requests, and event capturing."""

    def __init__(self, url: str = OBS_WS_URL, password: str = OBS_WS_PASSWORD, loop=None):
        self.url = url
        self.password = password
        self.ws = None
        self.authenticated = False
        self.loop = loop or asyncio.get_event_loop()
        self.lock = asyncio.Lock()
        self.event_buffer = EventRingBuffer(capacity=100)
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self._listener_task: Optional[asyncio.Task] = None

    def is_connected(self) -> bool:
        return self.ws is not None and self.authenticated

    def get_connection_status(self) -> Dict[str, Any]:
        return {
            "connected": self.is_connected(),
            "url": self.url,
            "hasPassword": bool(self.password),
            "identified": self.authenticated
        }

    async def connect(self):
        """Connect to OBS WebSocket server and perform identification."""
        if self.ws and self.authenticated:
            try:
                pong = await self.ws.ping()
                await asyncio.wait_for(pong, timeout=2.0)
                return
            except Exception:
                logger.info("Connection stale, reconnecting...")
                await self.close()

        async with self.lock:
            if self.ws and self.authenticated:
                return

            try:
                logger.info(f"Connecting to OBS WebSocket at {self.url}")
                self.ws = await websockets.connect(self.url)
                await self._authenticate()
                self._listener_task = asyncio.create_task(self._listen())
                logger.info("Successfully connected and authenticated with OBS WebSocket server")
            except Exception as e:
                self.ws = None
                self.authenticated = False
                logger.error(f"Failed to connect to OBS WebSocket server: {e}")
                raise Exception(f"Failed to connect to OBS WebSocket server: {e}")

    def _generate_auth_string(self, password: str, salt: str, challenge: str) -> str:
        """Compute SHA256 challenge response for OBS WebSocket v5."""
        secret_bytes = hashlib.sha256((password + salt).encode('utf-8')).digest()
        secret = base64.b64encode(secret_bytes).decode('utf-8')
        auth_bytes = hashlib.sha256((secret + challenge).encode('utf-8')).digest()
        return base64.b64encode(auth_bytes).decode('utf-8')

    async def _authenticate(self):
        """Receive Hello (op: 0) and send Identify (op: 1)."""
        hello_raw = await self.ws.recv()
        hello_data = json.loads(hello_raw)
        logger.debug(f"Received hello: {hello_data}")

        if hello_data.get("op") != 0:
            raise Exception("Did not receive Hello message (op: 0) from OBS WebSocket server")

        d = hello_data.get("d", {})
        auth_req = d.get("authentication")
        auth_string = None

        if auth_req:
            if not self.password:
                raise Exception("OBS WebSocket server requires authentication, but no password was provided. Set OBS_WEBSOCKET_PASSWORD.")
            auth_string = self._generate_auth_string(
                self.password,
                auth_req.get("salt", ""),
                auth_req.get("challenge", "")
            )

        identify_data = {
            "op": 1,
            "d": {
                "rpcVersion": d.get("rpcVersion", 1),
                "eventSubscriptions": 1023,  # Subscribe to all events
            }
        }
        if auth_string:
            identify_data["d"]["authentication"] = auth_string

        logger.debug("Sending identification...")
        await self.ws.send(json.dumps(identify_data))

        response_raw = await self.ws.recv()
        response_data = json.loads(response_raw)
        logger.debug(f"Received auth response: {response_data}")

        if response_data.get("op") != 2:  # Identified (op: 2)
            raise Exception("Authentication/Identification failed with OBS WebSocket")

        self.authenticated = True

    async def _listen(self):
        """Continuous background listener for incoming WebSocket messages."""
        try:
            async for raw_message in self.ws:
                try:
                    message = json.loads(raw_message)
                    op = message.get("op")
                    d = message.get("d", {})

                    if op == 5:  # Event
                        self.event_buffer.push(
                            event_type=d.get("eventType", "Unknown"),
                            event_intent=d.get("eventIntent", 0),
                            event_data=d.get("eventData", {})
                        )
                    elif op == 7:  # RequestResponse
                        req_id = d.get("requestId")
                        fut = self.pending_requests.pop(req_id, None)
                        if fut and not fut.done():
                            status = d.get("requestStatus", {})
                            if status.get("result", False):
                                fut.set_result(d.get("responseData", {}))
                            else:
                                code = status.get("code", 0)
                                comment = status.get("comment", "Unknown error")
                                fut.set_exception(Exception(f"OBS WebSocket request failed: {code} {comment}"))
                    elif op == 9:  # RequestBatchResponse
                        req_id = d.get("requestId")
                        fut = self.pending_requests.pop(req_id, None)
                        if fut and not fut.done():
                            fut.set_result({
                                "requestId": req_id,
                                "results": d.get("results", [])
                            })
                except Exception as e:
                    logger.error(f"Error handling message: {e}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"WebSocket listener exception: {e}")
        finally:
            self.authenticated = False
            for fut in self.pending_requests.values():
                if not fut.done():
                    fut.set_exception(Exception("WebSocket connection closed"))
            self.pending_requests.clear()

    async def send_request(
        self,
        request_type: str,
        request_data: Optional[Dict[str, Any]] = None,
        confirm: bool = False,
        timeout: float = 10.0
    ) -> Dict[str, Any]:
        """Send a request to OBS WebSocket and wait for response."""
        is_confirmed = confirm
        clean_data = request_data.copy() if request_data else {}
        if "confirm" in clean_data:
            if clean_data["confirm"] is True:
                is_confirmed = True
            del clean_data["confirm"]
        clean_payload = clean_data if clean_data else None

        validate_safety(request_type, is_confirmed)

        if not self.ws or not self.authenticated:
            await self.connect()

        req_id = str(uuid.uuid4())
        fut = self.loop.create_future()
        self.pending_requests[req_id] = fut

        payload = {
            "op": 6,
            "d": {
                "requestType": request_type,
                "requestId": req_id
            }
        }
        if clean_payload is not None:
            payload["d"]["requestData"] = clean_payload

        await self.ws.send(json.dumps(payload))
        return await asyncio.wait_for(fut, timeout=timeout)

    async def send_request_batch(
        self,
        requests: List[Dict[str, Any]],
        halt_on_failure: bool = False,
        execution_type: Union[int, str] = 0,
        confirm: bool = False,
        timeout: float = 15.0
    ) -> Dict[str, Any]:
        """Execute multiple requests as an atomic batch (OpCode 8 RequestBatch)."""
        if not requests:
            raise ValueError("send_request_batch requires a non-empty array of requests")

        exec_type_num = 0
        if isinstance(execution_type, int):
            exec_type_num = execution_type
        elif isinstance(execution_type, str):
            lower = execution_type.lower()
            if lower == "serialframe":
                exec_type_num = 1
            elif lower == "parallel":
                exec_type_num = 2
            else:
                exec_type_num = 0

        sanitized = []
        for idx, req in enumerate(requests):
            req_type = req.get("requestType")
            if not req_type:
                raise ValueError(f"Batch request at index {idx} is missing 'requestType'")
            r_data = req.get("requestData")
            is_conf = confirm
            clean_r_data = r_data.copy() if isinstance(r_data, dict) else {}
            if "confirm" in clean_r_data:
                if clean_r_data["confirm"] is True:
                    is_conf = True
                del clean_r_data["confirm"]
            clean_sub_payload = clean_r_data if clean_r_data else None

            validate_safety(req_type, is_conf)
            item = {
                "requestType": req_type,
                "requestId": req.get("requestId") or f"batch_req_{idx}_{uuid.uuid4()}"
            }
            if clean_sub_payload is not None:
                item["requestData"] = clean_sub_payload
            sanitized.append(item)

        if not self.ws or not self.authenticated:
            await self.connect()

        batch_id = str(uuid.uuid4())
        fut = self.loop.create_future()
        self.pending_requests[batch_id] = fut

        payload = {
            "op": 8,
            "d": {
                "requestId": batch_id,
                "haltOnFailure": halt_on_failure,
                "executionType": exec_type_num,
                "requests": sanitized
            }
        }

        await self.ws.send(json.dumps(payload))
        return await asyncio.wait_for(fut, timeout=timeout)

    def get_recent_events(self, limit: int = 20, event_type: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.event_buffer.get_recent(limit, event_type)

    def clear_recent_events(self) -> None:
        self.event_buffer.clear()

    async def close(self):
        """Close WebSocket connection."""
        if self._listener_task:
            self._listener_task.cancel()
            self._listener_task = None
        if self.ws:
            logger.info("Closing connection to OBS WebSocket server")
            await self.ws.close()
            self.ws = None
            self.authenticated = False


# Default shared client instance
obs_client = OBSWebSocketClient()
