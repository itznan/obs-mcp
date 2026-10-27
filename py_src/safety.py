"""
Safety Guardrails for OBS Studio MCP Server (Python)

Supports:
- OBS_READ_ONLY=true / --read-only: Blocks all state-modifying requests
- OBS_PROTECT_DESTRUCTIVE=true / --protect-destructive: Blocks high-risk and broadcast requests unless
  confirm=True is passed or OBS_ALLOW_LIVE_STREAM=true is set
"""

import os
import sys
from typing import Optional, Set

DESTRUCTIVE_REQUESTS: Set[str] = {
    "StartStream",
    "StopStream",
    "RemoveScene",
    "RemoveInput",
    "RemoveProfile",
    "SetCurrentSceneCollection",
}


class SafetyViolationError(Exception):
    def __init__(self, message: str, request_type: str, reason: str):
        super().__init__(message)
        self.request_type = request_type
        self.reason = reason


def is_read_only_request(request_type: str) -> bool:
    if request_type.startswith("Get"):
        return True
    if request_type == "Sleep":
        return True
    return False


def _parse_bool(val: Optional[str]) -> bool:
    if not val:
        return False
    return val.strip().lower() in {"true", "1", "yes"}


class SafetyConfig:
    def __init__(
        self,
        read_only: bool = False,
        protect_destructive: bool = False,
        allow_live_stream: bool = False,
    ):
        self.read_only = read_only
        self.protect_destructive = protect_destructive
        self.allow_live_stream = allow_live_stream


_global_safety_config: Optional[SafetyConfig] = None


def get_safety_config(argv: Optional[list] = None) -> SafetyConfig:
    global _global_safety_config
    if _global_safety_config is not None:
        return _global_safety_config

    read_only = _parse_bool(os.environ.get("OBS_READ_ONLY"))
    protect_destructive = _parse_bool(os.environ.get("OBS_PROTECT_DESTRUCTIVE"))
    allow_live_stream = _parse_bool(os.environ.get("OBS_ALLOW_LIVE_STREAM"))

    args = argv if argv is not None else sys.argv[1:]
    for arg in args:
        if arg == "--read-only":
            read_only = True
        elif arg == "--protect-destructive":
            protect_destructive = True
        elif arg == "--allow-live-stream":
            allow_live_stream = True

    return SafetyConfig(read_only, protect_destructive, allow_live_stream)


def set_safety_config(config: Optional[SafetyConfig]) -> None:
    global _global_safety_config
    _global_safety_config = config


def validate_safety(
    request_type: str,
    is_confirmed: bool = False,
    custom_config: Optional[SafetyConfig] = None,
) -> None:
    config = custom_config if custom_config is not None else get_safety_config()

    # 1. Read-only guardrail
    if config.read_only and not is_read_only_request(request_type):
        raise SafetyViolationError(
            f"Action blocked by safety policy: OBS_READ_ONLY mode is enabled. "
            f"State-modifying request '{request_type}' is prohibited.",
            request_type,
            "READ_ONLY",
        )

    # 2. Destructive guardrail
    if config.protect_destructive and request_type in DESTRUCTIVE_REQUESTS:
        is_live_stream = request_type in {"StartStream", "StopStream"}
        if is_live_stream and config.allow_live_stream:
            return

        if not is_confirmed:
            help_msg = " or set OBS_ALLOW_LIVE_STREAM=true in the environment" if is_live_stream else ""
            raise SafetyViolationError(
                f"Action blocked by safety policy: '{request_type}' is protected under OBS_PROTECT_DESTRUCTIVE. "
                f"To execute this action, provide confirm=True{help_msg}.",
                request_type,
                "DESTRUCTIVE_UNCONFIRMED",
            )
