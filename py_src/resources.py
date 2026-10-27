#!/usr/bin/env python3

import json
import logging
import asyncio
from .server import mcp, obs_client

logger = logging.getLogger("obs_resources")


@mcp.resource("obs://state/summary")
async def get_state_summary() -> str:
    """Consolidated real-time snapshot of OBS connection, active scenes, streaming/recording, outputs, and performance stats."""
    if not obs_client.is_connected():
        return json.dumps({
            "connected": False,
            "message": "OBS WebSocket client is disconnected. Please ensure OBS is running with WebSocket enabled on port 4455."
        }, indent=2)

    version_res, program_scene_res, preview_scene_res, stream_status_res, record_status_res, stats_res = await asyncio.gather(
        obs_client.send_request("GetVersion"),
        obs_client.send_request("GetCurrentProgramScene"),
        obs_client.send_request("GetCurrentPreviewScene"),
        obs_client.send_request("GetStreamStatus"),
        obs_client.send_request("GetRecordStatus"),
        obs_client.send_request("GetStats"),
        return_exceptions=True
    )

    def get_val(res):
        return res if not isinstance(res, Exception) else None

    summary = {
        "connected": True,
        "version": get_val(version_res),
        "scenes": {
            "currentProgramScene": get_val(program_scene_res),
            "currentPreviewScene": get_val(preview_scene_res)
        },
        "streaming": get_val(stream_status_res),
        "recording": get_val(record_status_res),
        "stats": get_val(stats_res)
    }
    return json.dumps(summary, indent=2)


@mcp.resource("obs://scenes/current")
async def get_scenes_current() -> str:
    """Consolidated snapshot of active program scene, preview scene, available scenes, and current scene items."""
    if not obs_client.is_connected():
        return json.dumps({"connected": False, "message": "OBS WebSocket client is disconnected."}, indent=2)

    scenes_list, program_scene = await asyncio.gather(
        obs_client.send_request("GetSceneList"),
        obs_client.send_request("GetCurrentProgramScene"),
        return_exceptions=True
    )
    payload = {
        "sceneList": scenes_list if not isinstance(scenes_list, Exception) else None,
        "currentProgramScene": program_scene if not isinstance(program_scene, Exception) else None
    }
    return json.dumps(payload, indent=2)


@mcp.resource("obs://audio/mixer")
async def get_audio_mixer() -> str:
    """Consolidated audio mixer snapshot of inputs, volume levels, mute states."""
    if not obs_client.is_connected():
        return json.dumps({"connected": False, "message": "OBS WebSocket client is disconnected."}, indent=2)

    inputs_res = await obs_client.send_request("GetInputList")
    inputs = inputs_res.get("inputs", []) if isinstance(inputs_res, dict) else []

    payload = {
        "totalInputs": len(inputs),
        "inputs": inputs
    }
    return json.dumps(payload, indent=2)


@mcp.resource("obs://events/recent")
async def get_events_recent() -> str:
    """Recent OBS WebSocket events captured in real-time (last 100 events circular ring buffer)."""
    events = obs_client.get_recent_events(limit=100)
    payload = {
        "totalCaptured": len(events),
        "events": events
    }
    return json.dumps(payload, indent=2)
