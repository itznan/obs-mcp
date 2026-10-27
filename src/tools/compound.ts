import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OBSWebSocketClient } from "../client.js";
import { z } from "zod";
import { formatScreenshotContent } from "../screenshot-util.js";

export async function initialize(server: McpServer, client: OBSWebSocketClient): Promise<void> {
  // 1. obs_manage_recording Compound Tool
  server.tool(
    "obs_manage_recording",
    "Consolidated tool for all OBS recording operations (start, stop, toggle, pause, resume, status, split, chapters)",
    {
      action: z.enum([
        "status",
        "start",
        "stop",
        "toggle",
        "pause",
        "resume",
        "toggle_pause",
        "split_file",
        "create_chapter",
      ]).describe("Recording action to perform"),
      chapterName: z.string().optional().describe("Chapter name (used when action is 'create_chapter')"),
    },
    async ({ action, chapterName }) => {
      try {
        let result: any;
        switch (action) {
          case "status":
            result = await client.sendRequest("GetRecordStatus");
            break;
          case "start":
            result = await client.sendRequest("StartRecord");
            break;
          case "stop":
            result = await client.sendRequest("StopRecord");
            break;
          case "toggle":
            result = await client.sendRequest("ToggleRecord");
            break;
          case "pause":
            result = await client.sendRequest("PauseRecord");
            break;
          case "resume":
            result = await client.sendRequest("ResumeRecord");
            break;
          case "toggle_pause":
            result = await client.sendRequest("ToggleRecordPause");
            break;
          case "split_file":
            result = await client.sendRequest("SplitRecordFile");
            break;
          case "create_chapter":
            result = await client.sendRequest("CreateRecordChapter", { chapterName });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed record action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing recording action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 2. obs_manage_streaming Compound Tool
  server.tool(
    "obs_manage_streaming",
    "Consolidated tool for live streaming operations (start, stop, toggle, status, captions)",
    {
      action: z.enum(["status", "start", "stop", "toggle", "send_caption"]).describe("Streaming action to perform"),
      captionText: z.string().optional().describe("CEA-608 caption text to send (used when action is 'send_caption')"),
      confirm: z.boolean().optional().describe("Explicit confirmation required when OBS_PROTECT_DESTRUCTIVE is active"),
    },
    async ({ action, captionText, confirm }) => {
      try {
        let result: any;
        switch (action) {
          case "status":
            result = await client.sendRequest("GetStreamStatus");
            break;
          case "start":
            result = await client.sendRequest("StartStream", { confirm });
            break;
          case "stop":
            result = await client.sendRequest("StopStream", { confirm });
            break;
          case "toggle":
            result = await client.sendRequest("ToggleStream", { confirm });
            break;
          case "send_caption":
            if (!captionText) throw new Error("captionText is required for send_caption");
            result = await client.sendRequest("SendStreamCaption", { captionText });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed stream action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing streaming action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 3. obs_manage_scenes Compound Tool
  server.tool(
    "obs_manage_scenes",
    "Consolidated tool for managing scenes, preview, groups, and transition overrides",
    {
      action: z.enum([
        "list",
        "get_current",
        "set_current",
        "get_preview",
        "set_preview",
        "create",
        "remove",
        "rename",
        "list_groups",
        "get_transition_override",
        "set_transition_override",
        "studio_transition",
      ]).describe("Scene management action to perform"),
      sceneName: z.string().optional().describe("Name of the scene"),
      sceneUuid: z.string().optional().describe("UUID of the scene"),
      newSceneName: z.string().optional().describe("New name for the scene (for 'rename')"),
      transitionName: z.string().nullable().optional().describe("Transition name for override (null to remove)"),
      transitionDuration: z.number().nullable().optional().describe("Transition duration in ms for override"),
      confirm: z.boolean().optional().describe("Explicit confirmation required when OBS_PROTECT_DESTRUCTIVE is active"),
    },
    async ({ action, sceneName, sceneUuid, newSceneName, transitionName, transitionDuration, confirm }) => {
      try {
        let result: any;
        switch (action) {
          case "list":
            result = await client.sendRequest("GetSceneList");
            break;
          case "get_current":
            result = await client.sendRequest("GetCurrentProgramScene");
            break;
          case "set_current":
            if (!sceneName && !sceneUuid) throw new Error("sceneName or sceneUuid is required");
            result = await client.sendRequest("SetCurrentProgramScene", { sceneName, sceneUuid });
            break;
          case "get_preview":
            result = await client.sendRequest("GetCurrentPreviewScene");
            break;
          case "set_preview":
            if (!sceneName && !sceneUuid) throw new Error("sceneName or sceneUuid is required");
            result = await client.sendRequest("SetCurrentPreviewScene", { sceneName, sceneUuid });
            break;
          case "create":
            if (!sceneName) throw new Error("sceneName is required for create");
            result = await client.sendRequest("CreateScene", { sceneName });
            break;
          case "remove":
            if (!sceneName && !sceneUuid) throw new Error("sceneName or sceneUuid is required for remove");
            result = await client.sendRequest("RemoveScene", { sceneName, sceneUuid, confirm });
            break;
          case "rename":
            if (!newSceneName) throw new Error("newSceneName is required for rename");
            result = await client.sendRequest("SetSceneName", { sceneName, sceneUuid, newSceneName });
            break;
          case "list_groups":
            result = await client.sendRequest("GetGroupList");
            break;
          case "get_transition_override":
            result = await client.sendRequest("GetSceneSceneTransitionOverride", { sceneName, sceneUuid });
            break;
          case "set_transition_override":
            result = await client.sendRequest("SetSceneSceneTransitionOverride", {
              sceneName,
              sceneUuid,
              transitionName,
              transitionDuration,
            });
            break;
          case "studio_transition":
            result = await client.sendRequest("TriggerStudioModeTransition");
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed scene action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing scene action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 4. obs_manage_scene_items Compound Tool
  server.tool(
    "obs_manage_scene_items",
    "Consolidated tool for managing items inside scenes (transforms, visibility, locking, Z-index, blend modes, private settings)",
    {
      action: z.enum([
        "list",
        "get_id",
        "create",
        "remove",
        "duplicate",
        "get_source",
        "get_enabled",
        "set_enabled",
        "get_locked",
        "set_locked",
        "get_index",
        "set_index",
        "get_transform",
        "set_transform",
        "get_blend_mode",
        "set_blend_mode",
        "list_group_items",
        "get_private_settings",
        "set_private_settings",
      ]).describe("Scene item action to perform"),
      sceneName: z.string().optional().describe("Scene name containing the item"),
      sceneUuid: z.string().optional().describe("Scene UUID containing the item"),
      sceneItemId: z.number().optional().describe("Numeric ID of the scene item"),
      sourceName: z.string().optional().describe("Source name (for create or ID search)"),
      destinationSceneName: z.string().optional().describe("Destination scene for duplicate"),
      destinationSceneUuid: z.string().optional().describe("Destination scene UUID for duplicate"),
      enabled: z.boolean().optional().describe("Visibility/enabled state"),
      locked: z.boolean().optional().describe("Lock state"),
      index: z.number().optional().describe("Z-index position"),
      blendMode: z.string().optional().describe("Blend mode (OBS_BLEND_NORMAL, OBS_BLEND_ADDITIVE, etc.)"),
      transform: z.object({
        positionX: z.number().optional(),
        positionY: z.number().optional(),
        scaleX: z.number().optional(),
        scaleY: z.number().optional(),
        rotation: z.number().optional(),
        cropTop: z.number().optional(),
        cropBottom: z.number().optional(),
        cropLeft: z.number().optional(),
        cropRight: z.number().optional(),
      }).optional().describe("Transform matrix parameters"),
      privateSettings: z.record(z.any()).optional().describe("Private settings object"),
      overlay: z.boolean().optional().describe("Overlay settings (default true)"),
    },
    async (params) => {
      const { action, sceneName, sceneUuid, sceneItemId, sourceName, destinationSceneName, destinationSceneUuid, enabled, locked, index, blendMode, transform, privateSettings, overlay } = params;
      try {
        let result: any;
        switch (action) {
          case "list":
            result = await client.sendRequest("GetSceneItemList", { sceneName, sceneUuid });
            break;
          case "list_group_items":
            result = await client.sendRequest("GetGroupSceneItemList", { sceneName, sceneUuid });
            break;
          case "get_id":
            if (!sourceName) throw new Error("sourceName is required to get scene item ID");
            result = await client.sendRequest("GetSceneItemId", { sceneName, sceneUuid, sourceName });
            break;
          case "create":
            if (!sourceName) throw new Error("sourceName is required to create a scene item");
            result = await client.sendRequest("CreateSceneItem", { sceneName, sceneUuid, sourceName, sceneItemEnabled: enabled ?? true });
            break;
          case "remove":
            if (sceneItemId === undefined) throw new Error("sceneItemId is required");
            result = await client.sendRequest("RemoveSceneItem", { sceneName, sceneUuid, sceneItemId });
            break;
          case "duplicate":
            if (sceneItemId === undefined) throw new Error("sceneItemId is required");
            result = await client.sendRequest("DuplicateSceneItem", { sceneName, sceneUuid, sceneItemId, destinationSceneName, destinationSceneUuid });
            break;
          case "get_source":
            if (sceneItemId === undefined) throw new Error("sceneItemId is required");
            result = await client.sendRequest("GetSceneItemSource", { sceneName, sceneUuid, sceneItemId });
            break;
          case "get_enabled":
            if (sceneItemId === undefined) throw new Error("sceneItemId is required");
            result = await client.sendRequest("GetSceneItemEnabled", { sceneName, sceneUuid, sceneItemId });
            break;
          case "set_enabled":
            if (sceneItemId === undefined || enabled === undefined) throw new Error("sceneItemId and enabled are required");
            result = await client.sendRequest("SetSceneItemEnabled", { sceneName, sceneUuid, sceneItemId, sceneItemEnabled: enabled });
            break;
          case "get_locked":
            if (sceneItemId === undefined) throw new Error("sceneItemId is required");
            result = await client.sendRequest("GetSceneItemLocked", { sceneName, sceneUuid, sceneItemId });
            break;
          case "set_locked":
            if (sceneItemId === undefined || locked === undefined) throw new Error("sceneItemId and locked are required");
            result = await client.sendRequest("SetSceneItemLocked", { sceneName, sceneUuid, sceneItemId, sceneItemLocked: locked });
            break;
          case "get_index":
            if (sceneItemId === undefined) throw new Error("sceneItemId is required");
            result = await client.sendRequest("GetSceneItemIndex", { sceneName, sceneUuid, sceneItemId });
            break;
          case "set_index":
            if (sceneItemId === undefined || index === undefined) throw new Error("sceneItemId and index are required");
            result = await client.sendRequest("SetSceneItemIndex", { sceneName, sceneUuid, sceneItemId, sceneItemIndex: index });
            break;
          case "get_transform":
            if (sceneItemId === undefined) throw new Error("sceneItemId is required");
            result = await client.sendRequest("GetSceneItemTransform", { sceneName, sceneUuid, sceneItemId });
            break;
          case "set_transform":
            if (sceneItemId === undefined || !transform) throw new Error("sceneItemId and transform are required");
            result = await client.sendRequest("SetSceneItemTransform", { sceneName, sceneUuid, sceneItemId, sceneItemTransform: transform });
            break;
          case "get_blend_mode":
            if (sceneItemId === undefined) throw new Error("sceneItemId is required");
            result = await client.sendRequest("GetSceneItemBlendMode", { sceneName, sceneUuid, sceneItemId });
            break;
          case "set_blend_mode":
            if (sceneItemId === undefined || !blendMode) throw new Error("sceneItemId and blendMode are required");
            result = await client.sendRequest("SetSceneItemBlendMode", { sceneName, sceneUuid, sceneItemId, sceneItemBlendMode: blendMode });
            break;
          case "get_private_settings":
            if (sceneItemId === undefined) throw new Error("sceneItemId is required");
            result = await client.sendRequest("GetSceneItemPrivateSettings", { sceneName, sceneUuid, sceneItemId });
            break;
          case "set_private_settings":
            if (sceneItemId === undefined || !privateSettings) throw new Error("sceneItemId and privateSettings are required");
            result = await client.sendRequest("SetSceneItemPrivateSettings", { sceneName, sceneUuid, sceneItemId, sceneItemSettings: privateSettings, overlay });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed scene item action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing scene item action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 5. obs_manage_inputs Compound Tool
  server.tool(
    "obs_manage_inputs",
    "Consolidated tool for audio and video inputs (volumes, mute, balance, sync, tracks, deinterlacing, settings)",
    {
      action: z.enum([
        "list",
        "list_kinds",
        "list_special",
        "create",
        "remove",
        "rename",
        "get_settings",
        "set_settings",
        "get_mute",
        "set_mute",
        "toggle_mute",
        "get_volume",
        "set_volume",
        "get_balance",
        "set_balance",
        "get_sync_offset",
        "set_sync_offset",
        "get_monitor_type",
        "set_monitor_type",
        "get_audio_tracks",
        "set_audio_tracks",
        "get_deinterlace_mode",
        "set_deinterlace_mode",
        "get_property_items",
        "press_button",
      ]).describe("Input action to perform"),
      inputName: z.string().optional().describe("Input name"),
      inputUuid: z.string().optional().describe("Input UUID"),
      newInputName: z.string().optional().describe("New input name (for rename)"),
      inputKind: z.string().optional().describe("Input kind (e.g., 'wasapi_input_capture', 'ffmpeg_source')"),
      sceneName: z.string().optional().describe("Scene to attach input to on creation"),
      inputSettings: z.record(z.any()).optional().describe("Input settings object"),
      overlay: z.boolean().optional().describe("Overlay settings (default true)"),
      muted: z.boolean().optional().describe("Mute state"),
      volumeDb: z.number().optional().describe("Volume in dB"),
      volumeMul: z.number().optional().describe("Volume multiplier (0.0 to 1.0+)"),
      balance: z.number().optional().describe("Audio balance (0.0 left to 1.0 right)"),
      syncOffset: z.number().optional().describe("Sync offset in milliseconds"),
      monitorType: z.string().optional().describe("OBS_MONITORING_TYPE_NONE | MONITOR_ONLY | MONITOR_AND_OUTPUT"),
      audioTracks: z.record(z.boolean()).optional().describe("Track assignments, e.g. {'1': true, '2': false}"),
      deinterlaceMode: z.string().optional().describe("Deinterlace mode string"),
      propertyName: z.string().optional().describe("Property name for list items or button clicks"),
      confirm: z.boolean().optional().describe("Explicit confirmation required when OBS_PROTECT_DESTRUCTIVE is active"),
    },
    async (params) => {
      const { action, inputName, inputUuid, newInputName, inputKind, sceneName, inputSettings, overlay, muted, volumeDb, volumeMul, balance, syncOffset, monitorType, audioTracks, deinterlaceMode, propertyName, confirm } = params;
      try {
        let result: any;
        switch (action) {
          case "list":
            result = await client.sendRequest("GetInputList", { inputKind });
            break;
          case "list_kinds":
            result = await client.sendRequest("GetInputKindList");
            break;
          case "list_special":
            result = await client.sendRequest("GetSpecialInputs");
            break;
          case "create":
            if (!inputName || !inputKind || !sceneName) throw new Error("inputName, inputKind, and sceneName are required to create an input");
            result = await client.sendRequest("CreateInput", { sceneName, inputName, inputKind, inputSettings });
            break;
          case "remove":
            if (!inputName && !inputUuid) throw new Error("inputName or inputUuid is required");
            result = await client.sendRequest("RemoveInput", { inputName, inputUuid, confirm });
            break;
          case "rename":
            if ((!inputName && !inputUuid) || !newInputName) throw new Error("inputName and newInputName are required");
            result = await client.sendRequest("SetInputName", { inputName, inputUuid, newInputName });
            break;
          case "get_settings":
            result = await client.sendRequest("GetInputSettings", { inputName, inputUuid });
            break;
          case "set_settings":
            if (!inputSettings) throw new Error("inputSettings is required");
            result = await client.sendRequest("SetInputSettings", { inputName, inputUuid, inputSettings, overlay });
            break;
          case "get_mute":
            result = await client.sendRequest("GetInputMute", { inputName, inputUuid });
            break;
          case "set_mute":
            if (muted === undefined) throw new Error("muted boolean is required");
            result = await client.sendRequest("SetInputMute", { inputName, inputUuid, inputMuted: muted });
            break;
          case "toggle_mute":
            result = await client.sendRequest("ToggleInputMute", { inputName, inputUuid });
            break;
          case "get_volume":
            result = await client.sendRequest("GetInputVolume", { inputName, inputUuid });
            break;
          case "set_volume":
            result = await client.sendRequest("SetInputVolume", { inputName, inputUuid, inputVolumeDb: volumeDb, inputVolumeMul: volumeMul });
            break;
          case "get_balance":
            result = await client.sendRequest("GetInputAudioBalance", { inputName, inputUuid });
            break;
          case "set_balance":
            if (balance === undefined) throw new Error("balance is required");
            result = await client.sendRequest("SetInputAudioBalance", { inputName, inputUuid, inputAudioBalance: balance });
            break;
          case "get_sync_offset":
            result = await client.sendRequest("GetInputAudioSyncOffset", { inputName, inputUuid });
            break;
          case "set_sync_offset":
            if (syncOffset === undefined) throw new Error("syncOffset is required");
            result = await client.sendRequest("SetInputAudioSyncOffset", { inputName, inputUuid, inputAudioSyncOffset: syncOffset });
            break;
          case "get_monitor_type":
            result = await client.sendRequest("GetInputAudioMonitorType", { inputName, inputUuid });
            break;
          case "set_monitor_type":
            if (!monitorType) throw new Error("monitorType is required");
            result = await client.sendRequest("SetInputAudioMonitorType", { inputName, inputUuid, monitorType });
            break;
          case "get_audio_tracks":
            result = await client.sendRequest("GetInputAudioTracks", { inputName, inputUuid });
            break;
          case "set_audio_tracks":
            if (!audioTracks) throw new Error("audioTracks object is required");
            result = await client.sendRequest("SetInputAudioTracks", { inputName, inputUuid, inputAudioTracks: audioTracks });
            break;
          case "get_deinterlace_mode":
            result = await client.sendRequest("GetInputDeinterlaceMode", { inputName, inputUuid });
            break;
          case "set_deinterlace_mode":
            if (!deinterlaceMode) throw new Error("deinterlaceMode is required");
            result = await client.sendRequest("SetInputDeinterlaceMode", { inputName, inputUuid, inputDeinterlaceMode: deinterlaceMode });
            break;
          case "get_property_items":
            if (!propertyName) throw new Error("propertyName is required");
            result = await client.sendRequest("GetInputPropertiesListPropertyItems", { inputName, inputUuid, propertyName });
            break;
          case "press_button":
            if (!propertyName) throw new Error("propertyName is required");
            result = await client.sendRequest("PressInputPropertiesButton", { inputName, inputUuid, propertyName });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed input action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing input action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 6. obs_manage_outputs Compound Tool
  server.tool(
    "obs_manage_outputs",
    "Consolidated tool for outputs, Virtual Camera, and Replay Buffer operations",
    {
      action: z.enum([
        "virtual_cam_status",
        "virtual_cam_start",
        "virtual_cam_stop",
        "virtual_cam_toggle",
        "replay_buffer_status",
        "replay_buffer_start",
        "replay_buffer_stop",
        "replay_buffer_toggle",
        "replay_buffer_save",
        "replay_buffer_last",
        "list",
        "status",
        "start",
        "stop",
        "toggle",
        "get_settings",
        "set_settings",
      ]).describe("Output action to perform"),
      outputName: z.string().optional().describe("Output name (for generic output actions)"),
      outputSettings: z.record(z.any()).optional().describe("Output settings object"),
      overlay: z.boolean().optional().describe("Overlay settings (default true)"),
    },
    async ({ action, outputName, outputSettings, overlay }) => {
      try {
        let result: any;
        switch (action) {
          case "virtual_cam_status":
            result = await client.sendRequest("GetVirtualCamStatus");
            break;
          case "virtual_cam_start":
            result = await client.sendRequest("StartVirtualCam");
            break;
          case "virtual_cam_stop":
            result = await client.sendRequest("StopVirtualCam");
            break;
          case "virtual_cam_toggle":
            result = await client.sendRequest("ToggleVirtualCam");
            break;
          case "replay_buffer_status":
            result = await client.sendRequest("GetReplayBufferStatus");
            break;
          case "replay_buffer_start":
            result = await client.sendRequest("StartReplayBuffer");
            break;
          case "replay_buffer_stop":
            result = await client.sendRequest("StopReplayBuffer");
            break;
          case "replay_buffer_toggle":
            result = await client.sendRequest("ToggleReplayBuffer");
            break;
          case "replay_buffer_save":
            result = await client.sendRequest("SaveReplayBuffer");
            break;
          case "replay_buffer_last":
            result = await client.sendRequest("GetLastReplayBufferReplay");
            break;
          case "list":
            result = await client.sendRequest("GetOutputList");
            break;
          case "status":
            if (!outputName) throw new Error("outputName is required for output status");
            result = await client.sendRequest("GetOutputStatus", { outputName });
            break;
          case "start":
            if (!outputName) throw new Error("outputName is required");
            result = await client.sendRequest("StartOutput", { outputName });
            break;
          case "stop":
            if (!outputName) throw new Error("outputName is required");
            result = await client.sendRequest("StopOutput", { outputName });
            break;
          case "toggle":
            if (!outputName) throw new Error("outputName is required");
            result = await client.sendRequest("ToggleOutput", { outputName });
            break;
          case "get_settings":
            if (!outputName) throw new Error("outputName is required");
            result = await client.sendRequest("GetOutputSettings", { outputName });
            break;
          case "set_settings":
            if (!outputName || !outputSettings) throw new Error("outputName and outputSettings are required");
            result = await client.sendRequest("SetOutputSettings", { outputName, outputSettings, overlay });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed output action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing output action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 7. obs_manage_filters Compound Tool
  server.tool(
    "obs_manage_filters",
    "Consolidated tool for source filters (add, remove, configure, reorder, toggle)",
    {
      action: z.enum([
        "list",
        "list_kinds",
        "get",
        "create",
        "remove",
        "rename",
        "set_enabled",
        "set_index",
        "set_settings",
        "get_default_settings",
      ]).describe("Filter action to perform"),
      sourceName: z.string().optional().describe("Source name"),
      filterName: z.string().optional().describe("Filter name"),
      newFilterName: z.string().optional().describe("New filter name (for rename)"),
      filterKind: z.string().optional().describe("Filter kind"),
      filterIndex: z.number().optional().describe("Index position for filter"),
      filterSettings: z.record(z.any()).optional().describe("Filter settings"),
      enabled: z.boolean().optional().describe("Filter enable state"),
      overlay: z.boolean().optional().describe("Overlay settings (default true)"),
    },
    async ({ action, sourceName, filterName, newFilterName, filterKind, filterIndex, filterSettings, enabled, overlay }) => {
      try {
        let result: any;
        switch (action) {
          case "list":
            if (!sourceName) throw new Error("sourceName is required");
            result = await client.sendRequest("GetSourceFilterList", { sourceName });
            break;
          case "list_kinds":
            result = await client.sendRequest("GetFilterKindList");
            break;
          case "get":
            if (!sourceName || !filterName) throw new Error("sourceName and filterName are required");
            result = await client.sendRequest("GetSourceFilter", { sourceName, filterName });
            break;
          case "create":
            if (!sourceName || !filterName || !filterKind) throw new Error("sourceName, filterName, and filterKind are required");
            result = await client.sendRequest("CreateSourceFilter", { sourceName, filterName, filterKind, filterSettings });
            break;
          case "remove":
            if (!sourceName || !filterName) throw new Error("sourceName and filterName are required");
            result = await client.sendRequest("RemoveSourceFilter", { sourceName, filterName });
            break;
          case "rename":
            if (!sourceName || !filterName || !newFilterName) throw new Error("sourceName, filterName, and newFilterName are required");
            result = await client.sendRequest("SetSourceFilterName", { sourceName, filterName, newFilterName });
            break;
          case "set_enabled":
            if (!sourceName || !filterName || enabled === undefined) throw new Error("sourceName, filterName, and enabled are required");
            result = await client.sendRequest("SetSourceFilterEnabled", { sourceName, filterName, filterEnabled: enabled });
            break;
          case "set_index":
            if (!sourceName || !filterName || filterIndex === undefined) throw new Error("sourceName, filterName, and filterIndex are required");
            result = await client.sendRequest("SetSourceFilterIndex", { sourceName, filterName, filterIndex });
            break;
          case "set_settings":
            if (!sourceName || !filterName || !filterSettings) throw new Error("sourceName, filterName, and filterSettings are required");
            result = await client.sendRequest("SetSourceFilterSettings", { sourceName, filterName, filterSettings, overlay });
            break;
          case "get_default_settings":
            if (!filterKind) throw new Error("filterKind is required");
            result = await client.sendRequest("GetFilterDefaultSettings", { filterKind });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed filter action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing filter action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 8. obs_manage_transitions Compound Tool
  server.tool(
    "obs_manage_transitions",
    "Consolidated tool for transitions and T-Bar controls",
    {
      action: z.enum([
        "list",
        "list_kinds",
        "get_current",
        "set_current",
        "get_cursor",
        "set_duration",
        "set_settings",
        "trigger",
        "set_tbar",
      ]).describe("Transition action to perform"),
      transitionName: z.string().optional().describe("Transition name"),
      duration: z.number().optional().describe("Transition duration in milliseconds"),
      transitionSettings: z.record(z.any()).optional().describe("Transition settings object"),
      tbarPosition: z.number().min(0).max(1).optional().describe("T-Bar position (0.0 to 1.0)"),
      tbarRelease: z.boolean().optional().describe("Release T-Bar (default true)"),
    },
    async ({ action, transitionName, duration, transitionSettings, tbarPosition, tbarRelease }) => {
      try {
        let result: any;
        switch (action) {
          case "list":
            result = await client.sendRequest("GetSceneTransitionList");
            break;
          case "list_kinds":
            result = await client.sendRequest("GetTransitionKindList");
            break;
          case "get_current":
            result = await client.sendRequest("GetCurrentSceneTransition");
            break;
          case "set_current":
            if (!transitionName) throw new Error("transitionName is required");
            result = await client.sendRequest("SetCurrentSceneTransition", { transitionName });
            break;
          case "get_cursor":
            result = await client.sendRequest("GetCurrentSceneTransitionCursor");
            break;
          case "set_duration":
            if (duration === undefined) throw new Error("duration is required");
            result = await client.sendRequest("SetCurrentSceneTransitionDuration", { transitionDuration: duration });
            break;
          case "set_settings":
            if (!transitionSettings) throw new Error("transitionSettings is required");
            result = await client.sendRequest("SetCurrentSceneTransitionSettings", { transitionSettings });
            break;
          case "trigger":
            result = await client.sendRequest("TriggerStudioModeTransition");
            break;
          case "set_tbar":
            if (tbarPosition === undefined) throw new Error("tbarPosition is required");
            result = await client.sendRequest("SetTBarPosition", { position: tbarPosition, release: tbarRelease });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed transition action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing transition action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 9. obs_manage_sources Compound Tool
  server.tool(
    "obs_manage_sources",
    "Consolidated tool for source utility (active state, screenshots, private settings)",
    {
      action: z.enum([
        "get_active",
        "get_screenshot",
        "save_screenshot",
        "get_private_settings",
        "set_private_settings",
      ]).describe("Source action to perform"),
      sourceName: z.string().optional().describe("Source name"),
      sourceUuid: z.string().optional().describe("Source UUID"),
      imageFormat: z.string().optional().describe("Image format (e.g., 'png', 'jpg')"),
      imageFilePath: z.string().optional().describe("File path to save screenshot to"),
      imageWidth: z.number().optional().describe("Image width"),
      imageHeight: z.number().optional().describe("Image height"),
      imageCompressionQuality: z.number().optional().describe("Quality (0-100)"),
      sourceSettings: z.record(z.any()).optional().describe("Private settings object"),
      overlay: z.boolean().optional().describe("Overlay settings (default true)"),
    },
    async (params) => {
      const { action, sourceName, sourceUuid, imageFormat, imageFilePath, imageWidth, imageHeight, imageCompressionQuality, sourceSettings, overlay } = params;
      try {
        let result: any;
        switch (action) {
          case "get_active":
            result = await client.sendRequest("GetSourceActive", { sourceName, sourceUuid });
            break;
          case "get_screenshot": {
            let targetSourceName = sourceName;
            if (!targetSourceName && !sourceUuid) {
              try {
                const currentScene = await client.sendRequest("GetCurrentProgramScene");
                targetSourceName = currentScene.currentProgramSceneName || currentScene.sceneName;
              } catch {}
            }
            const format = imageFormat || "png";
            const width = imageWidth || 960;
            const quality = imageCompressionQuality || 80;

            const response = await client.sendRequest("GetSourceScreenshot", {
              sourceName: targetSourceName,
              sourceUuid,
              imageFormat: format,
              imageWidth: width,
              imageHeight,
              imageCompressionQuality: quality,
            });

            return {
              content: formatScreenshotContent(response.imageData, targetSourceName || sourceUuid, format, width),
            };
          }
          case "save_screenshot":
            if (!imageFormat || !imageFilePath) throw new Error("imageFormat and imageFilePath are required");
            result = await client.sendRequest("SaveSourceScreenshot", { sourceName, sourceUuid, imageFormat, imageFilePath, imageWidth, imageHeight, imageCompressionQuality });
            break;
          case "get_private_settings":
            result = await client.sendRequest("GetSourcePrivateSettings", { sourceName, sourceUuid });
            break;
          case "set_private_settings":
            if (!sourceSettings) throw new Error("sourceSettings is required");
            result = await client.sendRequest("SetSourcePrivateSettings", { sourceName, sourceUuid, sourceSettings, overlay });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed source action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing source action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 10. obs_manage_config Compound Tool
  server.tool(
    "obs_manage_config",
    "Consolidated tool for OBS configuration (profiles, collections, video settings, record directory, persistent data)",
    {
      action: z.enum([
        "list_profiles",
        "set_profile",
        "create_profile",
        "remove_profile",
        "get_profile_parameter",
        "set_profile_parameter",
        "list_scene_collections",
        "set_scene_collection",
        "create_scene_collection",
        "get_video_settings",
        "set_video_settings",
        "get_stream_service_settings",
        "set_stream_service_settings",
        "get_record_directory",
        "set_record_directory",
        "get_persistent_data",
        "set_persistent_data",
      ]).describe("Configuration action to perform"),
      profileName: z.string().optional().describe("Profile name"),
      sceneCollectionName: z.string().optional().describe("Scene collection name"),
      categoryName: z.string().optional().describe("Profile parameter category"),
      parameterName: z.string().optional().describe("Profile parameter name"),
      parameterValue: z.string().optional().describe("Profile parameter value"),
      realm: z.string().optional().describe("Persistent data realm (OBS_WEBSOCKET_DATA_REALM_GLOBAL / PROFILE)"),
      slotName: z.string().optional().describe("Slot name for persistent data"),
      slotValue: z.any().optional().describe("Value for persistent data"),
      videoSettings: z.object({
        fpsNumerator: z.number().optional(),
        fpsDenominator: z.number().optional(),
        baseWidth: z.number().optional(),
        baseHeight: z.number().optional(),
        outputWidth: z.number().optional(),
        outputHeight: z.number().optional(),
      }).optional().describe("Video settings parameters"),
      streamServiceType: z.string().optional().describe("Stream service type"),
      streamServiceSettings: z.record(z.any()).optional().describe("Stream service settings"),
      recordDirectory: z.string().optional().describe("Record output directory"),
      confirm: z.boolean().optional().describe("Explicit confirmation required when OBS_PROTECT_DESTRUCTIVE is active"),
    },
    async (params) => {
      const { action, profileName, sceneCollectionName, categoryName, parameterName, parameterValue, realm, slotName, slotValue, videoSettings, streamServiceType, streamServiceSettings, recordDirectory, confirm } = params;
      try {
        let result: any;
        switch (action) {
          case "list_profiles":
            result = await client.sendRequest("GetProfileList");
            break;
          case "set_profile":
            if (!profileName) throw new Error("profileName is required");
            result = await client.sendRequest("SetCurrentProfile", { profileName });
            break;
          case "create_profile":
            if (!profileName) throw new Error("profileName is required");
            result = await client.sendRequest("CreateProfile", { profileName });
            break;
          case "remove_profile":
            if (!profileName) throw new Error("profileName is required");
            result = await client.sendRequest("RemoveProfile", { profileName, confirm });
            break;
          case "get_profile_parameter":
            if (!categoryName || !parameterName) throw new Error("categoryName and parameterName are required");
            result = await client.sendRequest("GetProfileParameter", { categoryName, parameterName });
            break;
          case "set_profile_parameter":
            if (!categoryName || !parameterName || parameterValue === undefined) throw new Error("categoryName, parameterName, and parameterValue are required");
            result = await client.sendRequest("SetProfileParameter", { categoryName, parameterName, parameterValue });
            break;
          case "list_scene_collections":
            result = await client.sendRequest("GetSceneCollectionList");
            break;
          case "set_scene_collection":
            if (!sceneCollectionName) throw new Error("sceneCollectionName is required");
            result = await client.sendRequest("SetCurrentSceneCollection", { sceneCollectionName, confirm });
            break;
          case "create_scene_collection":
            if (!sceneCollectionName) throw new Error("sceneCollectionName is required");
            result = await client.sendRequest("CreateSceneCollection", { sceneCollectionName });
            break;
          case "get_video_settings":
            result = await client.sendRequest("GetVideoSettings");
            break;
          case "set_video_settings":
            if (!videoSettings) throw new Error("videoSettings object is required");
            result = await client.sendRequest("SetVideoSettings", videoSettings);
            break;
          case "get_stream_service_settings":
            result = await client.sendRequest("GetStreamServiceSettings");
            break;
          case "set_stream_service_settings":
            if (!streamServiceType || !streamServiceSettings) throw new Error("streamServiceType and streamServiceSettings are required");
            result = await client.sendRequest("SetStreamServiceSettings", { streamServiceType, streamServiceSettings });
            break;
          case "get_record_directory":
            result = await client.sendRequest("GetRecordDirectory");
            break;
          case "set_record_directory":
            if (!recordDirectory) throw new Error("recordDirectory is required");
            result = await client.sendRequest("SetRecordDirectory", { recordDirectory });
            break;
          case "get_persistent_data":
            if (!realm || !slotName) throw new Error("realm and slotName are required");
            result = await client.sendRequest("GetPersistentData", { realm, slotName });
            break;
          case "set_persistent_data":
            if (!realm || !slotName || slotValue === undefined) throw new Error("realm, slotName, and slotValue are required");
            result = await client.sendRequest("SetPersistentData", { realm, slotName, slotValue });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed config action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing config action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 11. obs_manage_ui Compound Tool
  server.tool(
    "obs_manage_ui",
    "Consolidated tool for OBS UI, Studio Mode toggle, properties dialogs, monitors, and projectors",
    {
      action: z.enum([
        "get_studio_mode",
        "set_studio_mode",
        "open_input_properties",
        "open_input_filters",
        "open_input_interact",
        "list_monitors",
        "open_video_projector",
        "open_source_projector",
      ]).describe("UI action to perform"),
      studioModeEnabled: z.boolean().optional().describe("Studio mode enable state"),
      inputName: z.string().optional().describe("Input name for dialogs"),
      sourceName: z.string().optional().describe("Source name for dialogs or projectors"),
      videoMixType: z.string().optional().describe("OBS_WEBSOCKET_VIDEO_MIX_TYPE_PROGRAM, PREVIEW, etc."),
      monitorIndex: z.number().optional().describe("Monitor index (-1 for windowed)"),
      projectorGeometry: z.string().optional().describe("Geometry string for window"),
    },
    async ({ action, studioModeEnabled, inputName, sourceName, videoMixType, monitorIndex, projectorGeometry }) => {
      try {
        let result: any;
        switch (action) {
          case "get_studio_mode":
            result = await client.sendRequest("GetStudioModeEnabled");
            break;
          case "set_studio_mode":
            if (studioModeEnabled === undefined) throw new Error("studioModeEnabled is required");
            result = await client.sendRequest("SetStudioModeEnabled", { studioModeEnabled });
            break;
          case "open_input_properties":
            if (!inputName) throw new Error("inputName is required");
            result = await client.sendRequest("OpenInputPropertiesDialog", { inputName });
            break;
          case "open_input_filters":
            if (!inputName) throw new Error("inputName is required");
            result = await client.sendRequest("OpenInputFiltersDialog", { inputName });
            break;
          case "open_input_interact":
            if (!inputName) throw new Error("inputName is required");
            result = await client.sendRequest("OpenInputInteractDialog", { inputName });
            break;
          case "list_monitors":
            result = await client.sendRequest("GetMonitorList");
            break;
          case "open_video_projector":
            if (!videoMixType) throw new Error("videoMixType is required");
            result = await client.sendRequest("OpenVideoMixProjector", { videoMixType, monitorIndex, projectorGeometry });
            break;
          case "open_source_projector":
            if (!sourceName) throw new Error("sourceName is required");
            result = await client.sendRequest("OpenSourceProjector", { sourceName, monitorIndex, projectorGeometry });
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed UI action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing UI action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // 12. obs_manage_general Compound Tool
  server.tool(
    "obs_manage_general",
    "Consolidated tool for server status, version, session stats, hotkeys, custom events, and vendor requests",
    {
      action: z.enum([
        "status",
        "version",
        "stats",
        "test_connection",
        "list_hotkeys",
        "trigger_hotkey",
        "broadcast_custom_event",
        "call_vendor_request",
        "sleep",
        "execute_batch",
        "get_recent_events",
      ]).describe("General action to perform"),
      hotkeyName: z.string().optional().describe("Hotkey name to trigger"),
      eventData: z.record(z.any()).optional().describe("Custom event data payload to broadcast"),
      vendorName: z.string().optional().describe("Vendor name"),
      requestType: z.string().optional().describe("Vendor request type"),
      requestData: z.record(z.any()).optional().describe("Vendor request data"),
      sleepMillis: z.number().optional().describe("Milliseconds to sleep"),
      sleepFrames: z.number().optional().describe("Frames to sleep"),
      requests: z.array(z.object({
        requestType: z.string().describe("OBS request type"),
        requestId: z.string().optional().describe("Optional request id"),
        requestData: z.record(z.any()).optional().describe("Request payload parameters")
      })).optional().describe("Array of OBS requests for 'execute_batch'"),
      haltOnFailure: z.boolean().optional().describe("Whether to halt batch execution on failure"),
      executionType: z.enum(["SerialRealtime", "SerialFrame", "Parallel"]).optional().describe("Execution strategy for 'execute_batch'"),
      limit: z.number().optional().describe("Max events to return for 'get_recent_events' (default 20, max 100)"),
      eventType: z.string().optional().describe("Filter events by type substring for 'get_recent_events'"),
      confirm: z.boolean().optional().describe("Confirmation flag for destructive actions within execute_batch"),
    },
    async ({ action, hotkeyName, eventData, vendorName, requestType, requestData, sleepMillis, sleepFrames, requests, haltOnFailure, executionType, limit, eventType, confirm }) => {
      try {
        let result: any;
        switch (action) {
          case "status":
            result = {
              obsConnected: client.isConnected(),
              serverVersion: "1.0.1",
            };
            break;
          case "version":
            result = await client.sendRequest("GetVersion");
            break;
          case "stats":
            result = await client.sendRequest("GetStats");
            break;
          case "test_connection":
            result = {
              connected: client.isConnected(),
              timestamp: new Date().toISOString(),
            };
            break;
          case "list_hotkeys":
            result = await client.sendRequest("GetHotkeyList");
            break;
          case "trigger_hotkey":
            if (!hotkeyName) throw new Error("hotkeyName is required");
            result = await client.sendRequest("TriggerHotkeyByName", { hotkeyName });
            break;
          case "broadcast_custom_event":
            if (!eventData) throw new Error("eventData is required");
            result = await client.sendRequest("BroadcastCustomEvent", { eventData });
            break;
          case "call_vendor_request":
            if (!vendorName || !requestType) throw new Error("vendorName and requestType are required");
            result = await client.sendRequest("CallVendorRequest", { vendorName, requestType, requestData });
            break;
          case "sleep":
            result = await client.sendRequest("Sleep", { sleepMillis, sleepFrames });
            break;
          case "execute_batch":
            if (!requests || requests.length === 0) throw new Error("requests array is required for execute_batch");
            result = await client.sendRequestBatch(requests, { haltOnFailure, executionType, confirm });
            break;
          case "get_recent_events":
            {
              const evts = client.getRecentEvents(limit ?? 20, eventType);
              result = {
                total: evts.length,
                events: evts,
              };
            }
            break;
        }
        return {
          content: [{ type: "text", text: result ? JSON.stringify(result, null, 2) : `Successfully executed general action '${action}'` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing general action '${action}': ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
