#!/usr/bin/env python3

from typing import Any, Dict, List, Optional, Union

from .client import obs_client
from .server import mcp

@mcp.tool()
async def get_version() -> Dict[str, Any]:
    """
    Gets data about the current plugin and RPC version.
    
    Returns:
        Dict containing OBS version information including obsVersion, 
        obsWebSocketVersion, rpcVersion, and available requests list
    """
    return await obs_client.send_request("GetVersion")

@mcp.tool()
async def get_stats() -> Dict[str, Any]:
    """
    Gets statistics about OBS, obs-websocket, and the current session.
    
    Returns:
        Dict containing various OBS statistics including CPU usage, memory usage,
        available disk space, and session information
    """
    return await obs_client.send_request("GetStats")

@mcp.tool()
async def broadcast_custom_event(event_data: Dict[str, Any]) -> None:
    """
    Broadcasts a custom event to all WebSocket clients.
    
    Args:
        event_data: Data to send with the event
    """
    await obs_client.send_request("BroadcastCustomEvent", {"eventData": event_data})

@mcp.tool()
async def call_vendor_request(vendor_name: str, request_type: str, request_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Call a request registered to a vendor.
    
    Args:
        vendor_name: Name of the vendor to use
        request_type: The request type to call
        request_data: Additional data to pass to the request
    
    Returns:
        Response data from the vendor request
    """
    payload = {
        "vendorName": vendor_name,
        "requestType": request_type
    }
    if request_data:
        payload["requestData"] = request_data
    
    return await obs_client.send_request("CallVendorRequest", payload)

@mcp.tool()
async def get_hot_key_list() -> List[str]:
    """
    Gets an array of all available hotkey names.
    
    Returns:
        List of hotkey names
    """
    response = await obs_client.send_request("GetHotkeyList")
    return response.get("hotkeys", [])

@mcp.tool()
async def trigger_hotkey_by_name(hotkey_name: str) -> None:
    """
    Triggers a hotkey using its name.
    
    Args:
        hotkey_name: Name of the hotkey to trigger
    """
    await obs_client.send_request("TriggerHotkeyByName", {"hotkeyName": hotkey_name})

@mcp.tool()
async def trigger_hotkey_by_key_sequence(key_id: str, press_shift: bool = False, 
                                        press_ctrl: bool = False, press_alt: bool = False, 
                                        press_cmd: bool = False) -> None:
    """
    Triggers a hotkey using a sequence of keys.
    
    Args:
        key_id: The key to use (e.g., "OBS_KEY_A")
        press_shift: Whether to press the Shift key
        press_ctrl: Whether to press the Control key
        press_alt: Whether to press the Alt key
        press_cmd: Whether to press the Command key (macOS)
    """
    payload = {
        "keyId": key_id,
        "keyModifiers": {
            "shift": press_shift,
            "control": press_ctrl,
            "alt": press_alt,
            "cmd": press_cmd
        }
    }
    
    await obs_client.send_request("TriggerHotkeyByKeySequence", payload)

@mcp.tool()
async def sleep(sleep_milliseconds: int) -> None:
    """
    Sleeps for a specified amount of time (in milliseconds).
    
    Args:
        sleep_milliseconds: Number of milliseconds to sleep for
    """
    await obs_client.send_request("Sleep", {"sleepMillis": sleep_milliseconds})


@mcp.tool()
async def execute_batch(
    requests: List[Dict[str, Any]],
    halt_on_failure: bool = False,
    execution_type: Union[int, str] = 0,
    confirm: bool = False
) -> Dict[str, Any]:
    """
    Executes multiple OBS WebSocket requests atomically as a batch (OpCode 8 RequestBatch).

    Args:
        requests: List of request objects (each with 'requestType' and optional 'requestData')
        halt_on_failure: Whether to halt subsequent execution if one request fails
        execution_type: 0/SerialRealtime, 1/SerialFrame, 2/Parallel
        confirm: Confirmation flag for destructive requests
    """
    return await obs_client.send_request_batch(
        requests=requests,
        halt_on_failure=halt_on_failure,
        execution_type=execution_type,
        confirm=confirm
    )


@mcp.tool()
async def get_recent_events(limit: int = 20, event_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Get recent OBS events captured in the circular ring buffer.

    Args:
        limit: Maximum number of recent events to return (default 20, max 100)
        event_type: Optional filter by event type substring
    """
    events = obs_client.get_recent_events(limit=limit, event_type=event_type)
    return {
        "total": len(events),
        "events": events
    }
