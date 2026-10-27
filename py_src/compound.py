#!/usr/bin/env python3

import json
import logging
from typing import Any, Dict, List, Optional, Union
from .server import mcp, obs_client

logger = logging.getLogger("obs_compound")


@mcp.tool()
async def obs_manage_recording(action: str, confirm: bool = False) -> str:
    """Consolidated tool for managing OBS recording.
    Actions: start | stop | toggle | pause | resume | toggle_pause | split | get_status
    """
    try:
        result = None
        if action == "start":
            result = await obs_client.send_request("StartRecord", confirm=confirm)
        elif action == "stop":
            result = await obs_client.send_request("StopRecord", confirm=confirm)
        elif action == "toggle":
            result = await obs_client.send_request("ToggleRecord", confirm=confirm)
        elif action == "pause":
            result = await obs_client.send_request("PauseRecord")
        elif action == "resume":
            result = await obs_client.send_request("ResumeRecord")
        elif action == "toggle_pause":
            result = await obs_client.send_request("ToggleRecordPause")
        elif action == "split":
            result = await obs_client.send_request("SplitRecordFile")
        elif action == "get_status":
            result = await obs_client.send_request("GetRecordStatus")
        else:
            raise ValueError(f"Unknown recording action: {action}")

        return json.dumps(result or {"status": f"Successfully executed recording action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing recording action '{action}': {e}"


@mcp.tool()
async def obs_manage_streaming(action: str, confirm: bool = False) -> str:
    """Consolidated tool for managing live streaming.
    Actions: start | stop | toggle | get_status
    """
    try:
        result = None
        if action == "start":
            result = await obs_client.send_request("StartStream", confirm=confirm)
        elif action == "stop":
            result = await obs_client.send_request("StopStream", confirm=confirm)
        elif action == "toggle":
            result = await obs_client.send_request("ToggleStream", confirm=confirm)
        elif action == "get_status":
            result = await obs_client.send_request("GetStreamStatus")
        else:
            raise ValueError(f"Unknown streaming action: {action}")

        return json.dumps(result or {"status": f"Successfully executed streaming action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing streaming action '{action}': {e}"


@mcp.tool()
async def obs_manage_scenes(
    action: str,
    scene_name: Optional[str] = None,
    scene_uuid: Optional[str] = None,
    new_scene_name: Optional[str] = None,
    transition_name: Optional[str] = None,
    transition_duration: Optional[int] = None,
    confirm: bool = False,
) -> str:
    """Consolidated tool for managing scenes, preview, groups, and transition overrides.
    Actions: list | get_current | set_current | get_preview | set_preview | create | remove | rename | list_groups | get_transition_override | set_transition_override | studio_transition
    """
    try:
        result = None
        if action == "list":
            result = await obs_client.send_request("GetSceneList")
        elif action == "get_current":
            result = await obs_client.send_request("GetCurrentProgramScene")
        elif action == "set_current":
            data = {}
            if scene_name: data["sceneName"] = scene_name
            if scene_uuid: data["sceneUuid"] = scene_uuid
            result = await obs_client.send_request("SetCurrentProgramScene", data)
        elif action == "get_preview":
            result = await obs_client.send_request("GetCurrentPreviewScene")
        elif action == "set_preview":
            data = {}
            if scene_name: data["sceneName"] = scene_name
            if scene_uuid: data["sceneUuid"] = scene_uuid
            result = await obs_client.send_request("SetCurrentPreviewScene", data)
        elif action == "create":
            if not scene_name: raise ValueError("scene_name required for create")
            result = await obs_client.send_request("CreateScene", {"sceneName": scene_name})
        elif action == "remove":
            data = {}
            if scene_name: data["sceneName"] = scene_name
            if scene_uuid: data["sceneUuid"] = scene_uuid
            result = await obs_client.send_request("RemoveScene", data, confirm=confirm)
        elif action == "rename":
            data = {"newSceneName": new_scene_name}
            if scene_name: data["sceneName"] = scene_name
            if scene_uuid: data["sceneUuid"] = scene_uuid
            result = await obs_client.send_request("SetSceneName", data)
        elif action == "list_groups":
            result = await obs_client.send_request("GetGroupList")
        elif action == "get_transition_override":
            data = {}
            if scene_name: data["sceneName"] = scene_name
            if scene_uuid: data["sceneUuid"] = scene_uuid
            result = await obs_client.send_request("GetSceneSceneTransitionOverride", data)
        elif action == "set_transition_override":
            data = {"transitionName": transition_name, "transitionDuration": transition_duration}
            if scene_name: data["sceneName"] = scene_name
            if scene_uuid: data["sceneUuid"] = scene_uuid
            result = await obs_client.send_request("SetSceneSceneTransitionOverride", data)
        elif action == "studio_transition":
            result = await obs_client.send_request("TriggerStudioModeTransition")
        else:
            raise ValueError(f"Unknown scene action: {action}")

        return json.dumps(result or {"status": f"Successfully executed scene action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing scene action '{action}': {e}"


@mcp.tool()
async def obs_manage_scene_items(
    action: str,
    scene_name: Optional[str] = None,
    scene_uuid: Optional[str] = None,
    scene_item_id: Optional[int] = None,
    source_name: Optional[str] = None,
    source_uuid: Optional[str] = None,
    group_name: Optional[str] = None,
    scene_item_enabled: Optional[bool] = None,
    scene_item_locked: Optional[bool] = None,
    scene_item_index: Optional[int] = None,
    scene_item_transform: Optional[Dict[str, Any]] = None,
    scene_item_blend_mode: Optional[str] = None,
    confirm: bool = False,
) -> str:
    """Consolidated tool for managing scene items: lists, transforms, visibility, locking, ordering, blend modes, and groups.
    Actions: list | get | get_id | create | duplicate | remove | get_transform | set_transform | get_enabled | set_enabled | get_locked | set_locked | get_index | set_index | get_blend_mode | set_blend_mode | list_group_items
    """
    try:
        data: Dict[str, Any] = {}
        if scene_name: data["sceneName"] = scene_name
        if scene_uuid: data["sceneUuid"] = scene_uuid
        if scene_item_id is not None: data["sceneItemId"] = scene_item_id

        result = None
        if action == "list":
            result = await obs_client.send_request("GetSceneItemList", data)
        elif action == "get_id":
            if source_name: data["sourceName"] = source_name
            if source_uuid: data["sourceUuid"] = source_uuid
            result = await obs_client.send_request("GetSceneItemId", data)
        elif action == "create":
            if source_name: data["sourceName"] = source_name
            if source_uuid: data["sourceUuid"] = source_uuid
            if scene_item_enabled is not None: data["sceneItemEnabled"] = scene_item_enabled
            result = await obs_client.send_request("CreateSceneItem", data)
        elif action == "duplicate":
            result = await obs_client.send_request("DuplicateSceneItem", data)
        elif action == "remove":
            result = await obs_client.send_request("RemoveSceneItem", data, confirm=confirm)
        elif action == "get_transform":
            result = await obs_client.send_request("GetSceneItemTransform", data)
        elif action == "set_transform":
            data["sceneItemTransform"] = scene_item_transform or {}
            result = await obs_client.send_request("SetSceneItemTransform", data)
        elif action == "get_enabled":
            result = await obs_client.send_request("GetSceneItemEnabled", data)
        elif action == "set_enabled":
            data["sceneItemEnabled"] = scene_item_enabled
            result = await obs_client.send_request("SetSceneItemEnabled", data)
        elif action == "get_locked":
            result = await obs_client.send_request("GetSceneItemLocked", data)
        elif action == "set_locked":
            data["sceneItemLocked"] = scene_item_locked
            result = await obs_client.send_request("SetSceneItemLocked", data)
        elif action == "get_index":
            result = await obs_client.send_request("GetSceneItemIndex", data)
        elif action == "set_index":
            data["sceneItemIndex"] = scene_item_index
            result = await obs_client.send_request("SetSceneItemIndex", data)
        elif action == "get_blend_mode":
            result = await obs_client.send_request("GetSceneItemBlendMode", data)
        elif action == "set_blend_mode":
            data["sceneItemBlendMode"] = scene_item_blend_mode
            result = await obs_client.send_request("SetSceneItemBlendMode", data)
        elif action == "list_group_items":
            if group_name: data["groupName"] = group_name
            result = await obs_client.send_request("GetGroupSceneItemList", data)
        else:
            raise ValueError(f"Unknown scene item action: {action}")

        return json.dumps(result or {"status": f"Successfully executed scene item action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing scene item action '{action}': {e}"


@mcp.tool()
async def obs_manage_inputs(
    action: str,
    input_name: Optional[str] = None,
    input_uuid: Optional[str] = None,
    input_kind: Optional[str] = None,
    input_settings: Optional[Dict[str, Any]] = None,
    scene_name: Optional[str] = None,
    input_muted: Optional[bool] = None,
    input_volume_db: Optional[float] = None,
    input_volume_mul: Optional[float] = None,
    input_audio_balance: Optional[float] = None,
    input_audio_sync_offset: Optional[int] = None,
    monitor_type: Optional[str] = None,
    confirm: bool = False,
) -> str:
    """Consolidated tool for managing audio/video inputs: creation, settings, volume, mute, balance, sync, monitoring.
    Actions: list | list_kinds | get_default_settings | get_settings | set_settings | create | remove | get_mute | set_mute | toggle_mute | get_volume | set_volume | get_balance | set_balance | get_sync_offset | set_sync_offset | get_monitor_type | set_monitor_type
    """
    try:
        data: Dict[str, Any] = {}
        if input_name: data["inputName"] = input_name
        if input_uuid: data["inputUuid"] = input_uuid

        result = None
        if action == "list":
            if input_kind: data["inputKind"] = input_kind
            result = await obs_client.send_request("GetInputList", data if data else None)
        elif action == "list_kinds":
            result = await obs_client.send_request("GetInputKindList")
        elif action == "get_default_settings":
            if input_kind: data["inputKind"] = input_kind
            result = await obs_client.send_request("GetInputDefaultSettings", data)
        elif action == "get_settings":
            result = await obs_client.send_request("GetInputSettings", data)
        elif action == "set_settings":
            data["inputSettings"] = input_settings or {}
            result = await obs_client.send_request("SetInputSettings", data)
        elif action == "create":
            data["inputKind"] = input_kind
            if scene_name: data["sceneName"] = scene_name
            if input_settings: data["inputSettings"] = input_settings
            result = await obs_client.send_request("CreateInput", data)
        elif action == "remove":
            result = await obs_client.send_request("RemoveInput", data, confirm=confirm)
        elif action == "get_mute":
            result = await obs_client.send_request("GetInputMute", data)
        elif action == "set_mute":
            data["inputMuted"] = input_muted
            result = await obs_client.send_request("SetInputMute", data)
        elif action == "toggle_mute":
            result = await obs_client.send_request("ToggleInputMute", data)
        elif action == "get_volume":
            result = await obs_client.send_request("GetInputVolume", data)
        elif action == "set_volume":
            if input_volume_db is not None: data["inputVolumeDb"] = input_volume_db
            if input_volume_mul is not None: data["inputVolumeMul"] = input_volume_mul
            result = await obs_client.send_request("SetInputVolume", data)
        elif action == "get_balance":
            result = await obs_client.send_request("GetInputAudioBalance", data)
        elif action == "set_balance":
            data["inputAudioBalance"] = input_audio_balance
            result = await obs_client.send_request("SetInputAudioBalance", data)
        elif action == "get_sync_offset":
            result = await obs_client.send_request("GetInputAudioSyncOffset", data)
        elif action == "set_sync_offset":
            data["inputAudioSyncOffset"] = input_audio_sync_offset
            result = await obs_client.send_request("SetInputAudioSyncOffset", data)
        elif action == "get_monitor_type":
            result = await obs_client.send_request("GetInputAudioMonitorType", data)
        elif action == "set_monitor_type":
            data["monitorType"] = monitor_type
            result = await obs_client.send_request("SetInputAudioMonitorType", data)
        else:
            raise ValueError(f"Unknown input action: {action}")

        return json.dumps(result or {"status": f"Successfully executed input action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing input action '{action}': {e}"


@mcp.tool()
async def obs_manage_filters(
    action: str,
    source_name: Optional[str] = None,
    source_uuid: Optional[str] = None,
    filter_name: Optional[str] = None,
    filter_kind: Optional[str] = None,
    filter_settings: Optional[Dict[str, Any]] = None,
    filter_index: Optional[int] = None,
    filter_enabled: Optional[bool] = None,
) -> str:
    """Consolidated tool for managing audio and video filters.
    Actions: list | get_default_settings | get | create | remove | set_name | get_settings | set_settings | set_index | set_enabled
    """
    try:
        data: Dict[str, Any] = {}
        if source_name: data["sourceName"] = source_name
        if source_uuid: data["sourceUuid"] = source_uuid
        if filter_name: data["filterName"] = filter_name

        result = None
        if action == "list":
            result = await obs_client.send_request("GetSourceFilterList", data)
        elif action == "get_default_settings":
            result = await obs_client.send_request("GetSourceFilterDefaultSettings", {"filterKind": filter_kind})
        elif action == "get":
            result = await obs_client.send_request("GetSourceFilter", data)
        elif action == "create":
            data["filterKind"] = filter_kind
            if filter_settings: data["filterSettings"] = filter_settings
            result = await obs_client.send_request("CreateSourceFilter", data)
        elif action == "remove":
            result = await obs_client.send_request("RemoveSourceFilter", data)
        elif action == "set_settings":
            data["filterSettings"] = filter_settings or {}
            result = await obs_client.send_request("SetSourceFilterSettings", data)
        elif action == "set_index":
            data["filterIndex"] = filter_index
            result = await obs_client.send_request("SetSourceFilterIndex", data)
        elif action == "set_enabled":
            data["filterEnabled"] = filter_enabled
            result = await obs_client.send_request("SetSourceFilterEnabled", data)
        else:
            raise ValueError(f"Unknown filter action: {action}")

        return json.dumps(result or {"status": f"Successfully executed filter action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing filter action '{action}': {e}"


@mcp.tool()
async def obs_manage_transitions(
    action: str,
    transition_name: Optional[str] = None,
    transition_duration: Optional[int] = None,
    transition_settings: Optional[Dict[str, Any]] = None,
) -> str:
    """Consolidated tool for managing scene transitions.
    Actions: list_kinds | get_current | set_current | set_duration | get_cursor | trigger | set_settings
    """
    try:
        result = None
        if action == "list_kinds":
            result = await obs_client.send_request("GetTransitionKindList")
        elif action == "get_current":
            result = await obs_client.send_request("GetCurrentSceneTransition")
        elif action == "set_current":
            result = await obs_client.send_request("SetCurrentSceneTransition", {"transitionName": transition_name})
        elif action == "set_duration":
            result = await obs_client.send_request("SetCurrentSceneTransitionDuration", {"transitionDuration": transition_duration})
        elif action == "get_cursor":
            result = await obs_client.send_request("GetCurrentSceneTransitionCursor")
        elif action == "trigger":
            result = await obs_client.send_request("TriggerStudioModeTransition")
        elif action == "set_settings":
            result = await obs_client.send_request("SetCurrentSceneTransitionSettings", {"transitionSettings": transition_settings or {}})
        else:
            raise ValueError(f"Unknown transition action: {action}")

        return json.dumps(result or {"status": f"Successfully executed transition action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing transition action '{action}': {e}"


@mcp.tool()
async def obs_manage_outputs(
    action: str,
    output_name: Optional[str] = None,
    output_settings: Optional[Dict[str, Any]] = None,
) -> str:
    """Consolidated tool for managing OBS outputs, Virtual Camera, and Replay Buffer.
    Actions: list | get_status | start | stop | toggle | get_virtual_cam_status | start_virtual_cam | stop_virtual_cam | toggle_virtual_cam | get_replay_buffer_status | start_replay_buffer | stop_replay_buffer | toggle_replay_buffer | save_replay_buffer | get_last_replay
    """
    try:
        data: Dict[str, Any] = {}
        if output_name: data["outputName"] = output_name

        result = None
        if action == "list":
            result = await obs_client.send_request("GetOutputList")
        elif action == "get_status":
            result = await obs_client.send_request("GetOutputStatus", data)
        elif action == "start":
            result = await obs_client.send_request("StartOutput", data)
        elif action == "stop":
            result = await obs_client.send_request("StopOutput", data)
        elif action == "toggle":
            result = await obs_client.send_request("ToggleOutput", data)
        elif action == "get_virtual_cam_status":
            result = await obs_client.send_request("GetVirtualCamStatus")
        elif action == "start_virtual_cam":
            result = await obs_client.send_request("StartVirtualCam")
        elif action == "stop_virtual_cam":
            result = await obs_client.send_request("StopVirtualCam")
        elif action == "toggle_virtual_cam":
            result = await obs_client.send_request("ToggleVirtualCam")
        elif action == "get_replay_buffer_status":
            result = await obs_client.send_request("GetReplayBufferStatus")
        elif action == "start_replay_buffer":
            result = await obs_client.send_request("StartReplayBuffer")
        elif action == "stop_replay_buffer":
            result = await obs_client.send_request("StopReplayBuffer")
        elif action == "toggle_replay_buffer":
            result = await obs_client.send_request("ToggleReplayBuffer")
        elif action == "save_replay_buffer":
            result = await obs_client.send_request("SaveReplayBuffer")
        elif action == "get_last_replay":
            result = await obs_client.send_request("GetLastReplayBufferReplay")
        else:
            raise ValueError(f"Unknown output action: {action}")

        return json.dumps(result or {"status": f"Successfully executed output action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing output action '{action}': {e}"


@mcp.tool()
async def obs_manage_media(
    action: str,
    input_name: Optional[str] = None,
    input_uuid: Optional[str] = None,
    media_action: Optional[str] = None,
    media_cursor: Optional[int] = None,
) -> str:
    """Consolidated tool for managing media playback inputs.
    Actions: get_status | set_cursor | offset_cursor | trigger_action
    """
    try:
        data: Dict[str, Any] = {}
        if input_name: data["inputName"] = input_name
        if input_uuid: data["inputUuid"] = input_uuid

        result = None
        if action == "get_status":
            result = await obs_client.send_request("GetMediaInputStatus", data)
        elif action == "set_cursor":
            data["mediaCursor"] = media_cursor
            result = await obs_client.send_request("SetMediaInputCursor", data)
        elif action == "offset_cursor":
            data["mediaCursorOffset"] = media_cursor
            result = await obs_client.send_request("OffsetMediaInputCursor", data)
        elif action == "trigger_action":
            data["mediaAction"] = media_action
            result = await obs_client.send_request("TriggerMediaInputAction", data)
        else:
            raise ValueError(f"Unknown media action: {action}")

        return json.dumps(result or {"status": f"Successfully executed media action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing media action '{action}': {e}"


@mcp.tool()
async def obs_manage_config(
    action: str,
    parameter_category: Optional[str] = None,
    parameter_name: Optional[str] = None,
    parameter_value: Optional[str] = None,
    profile_name: Optional[str] = None,
    scene_collection_name: Optional[str] = None,
    video_settings: Optional[Dict[str, Any]] = None,
    confirm: bool = False,
) -> str:
    """Consolidated tool for OBS configuration: profiles, scene collections, video parameters, and persistent settings.
    Actions: get_persistent_data | set_persistent_data | list_scene_collections | get_current_scene_collection | set_current_scene_collection | create_scene_collection | list_profiles | get_current_profile | set_current_profile | create_profile | remove_profile | get_profile_parameter | set_profile_parameter | get_video_settings | set_video_settings
    """
    try:
        result = None
        if action == "list_scene_collections":
            result = await obs_client.send_request("GetSceneCollectionList")
        elif action == "set_current_scene_collection":
            result = await obs_client.send_request("SetCurrentSceneCollection", {"sceneCollectionName": scene_collection_name}, confirm=confirm)
        elif action == "create_scene_collection":
            result = await obs_client.send_request("CreateSceneCollection", {"sceneCollectionName": scene_collection_name})
        elif action == "list_profiles":
            result = await obs_client.send_request("GetProfileList")
        elif action == "set_current_profile":
            result = await obs_client.send_request("SetCurrentProfile", {"profileName": profile_name})
        elif action == "create_profile":
            result = await obs_client.send_request("CreateProfile", {"profileName": profile_name})
        elif action == "remove_profile":
            result = await obs_client.send_request("RemoveProfile", {"profileName": profile_name}, confirm=confirm)
        elif action == "get_profile_parameter":
            result = await obs_client.send_request("GetProfileParameter", {"parameterCategory": parameter_category, "parameterName": parameter_name})
        elif action == "set_profile_parameter":
            result = await obs_client.send_request("SetProfileParameter", {"parameterCategory": parameter_category, "parameterName": parameter_name, "parameterValue": parameter_value})
        elif action == "get_video_settings":
            result = await obs_client.send_request("GetVideoSettings")
        elif action == "set_video_settings":
            result = await obs_client.send_request("SetVideoSettings", video_settings or {})
        else:
            raise ValueError(f"Unknown config action: {action}")

        return json.dumps(result or {"status": f"Successfully executed config action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing config action '{action}': {e}"


@mcp.tool()
async def obs_manage_ui(
    action: str,
    studio_mode_enabled: Optional[bool] = None,
    video_mix_type: Optional[str] = None,
    monitor_index: Optional[int] = None,
    source_name: Optional[str] = None,
) -> str:
    """Consolidated tool for managing OBS Studio UI: Studio Mode, full-screen and windowed projectors, and monitor lists.
    Actions: get_studio_mode_enabled | set_studio_mode_enabled | list_monitors | open_video_projector | open_source_projector
    """
    try:
        result = None
        if action == "get_studio_mode_enabled":
            result = await obs_client.send_request("GetStudioModeEnabled")
        elif action == "set_studio_mode_enabled":
            result = await obs_client.send_request("SetStudioModeEnabled", {"studioModeEnabled": studio_mode_enabled})
        elif action == "list_monitors":
            result = await obs_client.send_request("GetMonitorList")
        elif action == "open_video_projector":
            result = await obs_client.send_request("OpenVideoMixProjector", {"videoMixType": video_mix_type, "monitorIndex": monitor_index})
        elif action == "open_source_projector":
            result = await obs_client.send_request("OpenSourceProjector", {"sourceName": source_name, "monitorIndex": monitor_index})
        else:
            raise ValueError(f"Unknown UI action: {action}")

        return json.dumps(result or {"status": f"Successfully executed UI action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing UI action '{action}': {e}"


@mcp.tool()
async def obs_manage_general(
    action: str,
    hotkey_name: Optional[str] = None,
    event_data: Optional[Dict[str, Any]] = None,
    vendor_name: Optional[str] = None,
    request_type: Optional[str] = None,
    request_data: Optional[Dict[str, Any]] = None,
    sleep_millis: Optional[int] = None,
    sleep_frames: Optional[int] = None,
    requests: Optional[List[Dict[str, Any]]] = None,
    halt_on_failure: bool = False,
    execution_type: Union[int, str] = 0,
    limit: int = 20,
    event_type: Optional[str] = None,
    confirm: bool = False,
) -> str:
    """Consolidated tool for server status, version, session stats, hotkeys, custom events, batch requests, and recent event ring buffer.
    Actions: status | version | stats | test_connection | list_hotkeys | trigger_hotkey | broadcast_custom_event | call_vendor_request | sleep | execute_batch | get_recent_events
    """
    try:
        result = None
        if action == "status":
            result = {
                "obsConnected": obs_client.is_connected(),
                "serverVersion": "1.1.0",
                "status": obs_client.get_connection_status()
            }
        elif action == "version":
            result = await obs_client.send_request("GetVersion")
        elif action == "stats":
            result = await obs_client.send_request("GetStats")
        elif action == "test_connection":
            result = {
                "connected": obs_client.is_connected(),
                "status": "Connection test successful" if obs_client.is_connected() else "Disconnected"
            }
        elif action == "list_hotkeys":
            result = await obs_client.send_request("GetHotkeyList")
        elif action == "trigger_hotkey":
            result = await obs_client.send_request("TriggerHotkeyByName", {"hotkeyName": hotkey_name})
        elif action == "broadcast_custom_event":
            result = await obs_client.send_request("BroadcastCustomEvent", {"eventData": event_data or {}})
        elif action == "call_vendor_request":
            result = await obs_client.send_request("CallVendorRequest", {"vendorName": vendor_name, "requestType": request_type, "requestData": request_data or {}})
        elif action == "sleep":
            params = {}
            if sleep_millis is not None: params["sleepMillis"] = sleep_millis
            if sleep_frames is not None: params["sleepFrames"] = sleep_frames
            result = await obs_client.send_request("Sleep", params)
        elif action == "execute_batch":
            if not requests:
                raise ValueError("requests list is required for execute_batch")
            result = await obs_client.send_request_batch(
                requests=requests,
                halt_on_failure=halt_on_failure,
                execution_type=execution_type,
                confirm=confirm
            )
        elif action == "get_recent_events":
            events = obs_client.get_recent_events(limit=limit, event_type=event_type)
            result = {
                "total": len(events),
                "events": events
            }
        else:
            raise ValueError(f"Unknown general action: {action}")

        return json.dumps(result or {"status": f"Successfully executed general action '{action}'"}, indent=2)
    except Exception as e:
        return f"Error executing general action '{action}': {e}"
