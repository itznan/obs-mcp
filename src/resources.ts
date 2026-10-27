import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OBSWebSocketClient } from "./client.js";

/**
 * Register read-only MCP Resources:
 * - obs://state/summary
 * - obs://scenes/current
 * - obs://audio/mixer
 * - obs://events/recent
 */
export function registerResources(server: McpServer, client: OBSWebSocketClient): void {
  // 1. obs://state/summary
  server.registerResource(
    "obs-state-summary",
    "obs://state/summary",
    {
      mimeType: "application/json",
      description: "Consolidated real-time snapshot of OBS connection, active scenes, streaming/recording, outputs, and performance stats",
    },
    async (uri) => {
      const isConnected = client.isConnected();
      if (!isConnected) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  connected: false,
                  timestamp: new Date().toISOString(),
                  message: "OBS WebSocket client is disconnected. Please ensure OBS is running with WebSocket enabled on port 4455.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Fetch snapshot data in parallel
      const [
        versionRes,
        programSceneRes,
        previewSceneRes,
        streamStatusRes,
        recordStatusRes,
        virtualCamRes,
        replayBufferRes,
        statsRes,
      ] = await Promise.allSettled([
        client.sendRequest("GetVersion"),
        client.sendRequest("GetCurrentProgramScene"),
        client.sendRequest("GetCurrentPreviewScene"),
        client.sendRequest("GetStreamStatus"),
        client.sendRequest("GetRecordStatus"),
        client.sendRequest("GetVirtualCamStatus"),
        client.sendRequest("GetReplayBufferStatus"),
        client.sendRequest("GetStats"),
      ]);

      const getValue = <T>(res: PromiseSettledResult<T>): T | null =>
        res.status === "fulfilled" ? res.value : null;

      const programScene = getValue(programSceneRes) as any;
      const previewScene = getValue(previewSceneRes) as any;
      const streamStatus = getValue(streamStatusRes) as any;
      const recordStatus = getValue(recordStatusRes) as any;
      const virtualCam = getValue(virtualCamRes) as any;
      const replayBuffer = getValue(replayBufferRes) as any;
      const stats = getValue(statsRes) as any;
      const version = getValue(versionRes) as any;

      const summary = {
        timestamp: new Date().toISOString(),
        connection: {
          connected: true,
          obsVersion: version?.obsVersion,
          obsWebSocketVersion: version?.obsWebSocketVersion,
          rpcVersion: version?.rpcVersion,
        },
        scenes: {
          currentProgramScene: programScene?.currentProgramSceneName || programScene?.sceneName || null,
          currentPreviewScene: previewScene?.currentPreviewSceneName || previewScene?.sceneName || null,
          studioMode: previewScene !== null,
        },
        streaming: streamStatus
          ? {
              outputActive: streamStatus.outputActive,
              outputReconnecting: streamStatus.outputReconnecting,
              outputTimecode: streamStatus.outputTimecode,
              outputDuration: streamStatus.outputDuration,
              outputBytes: streamStatus.outputBytes,
              outputSkippedFrames: streamStatus.outputSkippedFrames,
              outputTotalFrames: streamStatus.outputTotalFrames,
            }
          : null,
        recording: recordStatus
          ? {
              outputActive: recordStatus.outputActive,
              outputPaused: recordStatus.outputPaused,
              outputTimecode: recordStatus.outputTimecode,
              outputDuration: recordStatus.outputDuration,
              outputBytes: recordStatus.outputBytes,
            }
          : null,
        outputs: {
          virtualCamActive: virtualCam?.outputActive ?? null,
          replayBufferActive: replayBuffer?.outputActive ?? null,
        },
        stats: stats
          ? {
              cpuUsage: stats.cpuUsage,
              memoryUsage: stats.memoryUsage,
              activeFps: stats.activeFps,
              averageFrameRenderTime: stats.averageFrameRenderTime,
              renderSkippedFrames: stats.renderSkippedFrames,
              outputSkippedFrames: stats.outputSkippedFrames,
            }
          : null,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }
  );

  // 2. obs://scenes/current
  server.registerResource(
    "obs-scenes-current",
    "obs://scenes/current",
    {
      mimeType: "application/json",
      description: "Consolidated snapshot of active program scene, preview scene, available scenes, and current scene items with transform/visibility states",
    },
    async (uri) => {
      const isConnected = client.isConnected();
      if (!isConnected) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ connected: false, message: "OBS WebSocket client is disconnected." }, null, 2),
            },
          ],
        };
      }

      const [sceneListRes, programSceneRes, previewSceneRes] = await Promise.allSettled([
        client.sendRequest("GetSceneList"),
        client.sendRequest("GetCurrentProgramScene"),
        client.sendRequest("GetCurrentPreviewScene"),
      ]);

      const sceneList = sceneListRes.status === "fulfilled" ? (sceneListRes.value as any) : null;
      const programScene = programSceneRes.status === "fulfilled" ? (programSceneRes.value as any) : null;
      const previewScene = previewSceneRes.status === "fulfilled" ? (previewSceneRes.value as any) : null;

      const currentProgramSceneName = programScene?.currentProgramSceneName || programScene?.sceneName || sceneList?.currentProgramSceneName || null;

      // Fetch items for the active program scene if known
      let sceneItems: any[] = [];
      if (currentProgramSceneName) {
        try {
          const itemsRes = await client.sendRequest("GetSceneItemList", { sceneName: currentProgramSceneName });
          sceneItems = (itemsRes as any)?.sceneItems || [];
        } catch {
          sceneItems = [];
        }
      }

      const payload = {
        timestamp: new Date().toISOString(),
        currentProgramScene: currentProgramSceneName,
        currentPreviewScene: previewScene?.currentPreviewSceneName || previewScene?.sceneName || null,
        studioModeEnabled: previewScene !== null,
        availableScenes: sceneList?.scenes?.map((s: any) => s.sceneName) || [],
        itemCount: sceneItems.length,
        items: sceneItems.map((item: any) => ({
          sceneItemId: item.sceneItemId,
          sourceName: item.sourceName,
          sourceType: item.sourceType,
          inputKind: item.inputKind,
          sceneItemEnabled: item.sceneItemEnabled,
          sceneItemLocked: item.sceneItemLocked,
          sceneItemIndex: item.sceneItemIndex,
          sceneItemBlendMode: item.sceneItemBlendMode,
          sceneItemTransform: item.sceneItemTransform,
        })),
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );

  // 3. obs://audio/mixer
  server.registerResource(
    "obs-audio-mixer",
    "obs://audio/mixer",
    {
      mimeType: "application/json",
      description: "Consolidated audio mixer snapshot of all inputs, volume levels, mute states, sync offsets, monitor types, and track routing",
    },
    async (uri) => {
      const isConnected = client.isConnected();
      if (!isConnected) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ connected: false, message: "OBS WebSocket client is disconnected." }, null, 2),
            },
          ],
        };
      }

      const [inputListRes, specialInputsRes] = await Promise.allSettled([
        client.sendRequest("GetInputList"),
        client.sendRequest("GetSpecialInputs"),
      ]);

      const inputList = inputListRes.status === "fulfilled" ? (inputListRes.value as any)?.inputs || [] : [];
      const specialInputs = specialInputsRes.status === "fulfilled" ? (specialInputsRes.value as any) || {} : {};

      // For each input, fetch its mute, volume, balance, sync, monitor type, and tracks in parallel
      const inputAudios = await Promise.all(
        inputList.map(async (input: any) => {
          const inputName = input.inputName;
          const [muteRes, volRes, balRes, syncRes, monitorRes, tracksRes] = await Promise.allSettled([
            client.sendRequest("GetInputMute", { inputName }),
            client.sendRequest("GetInputVolume", { inputName }),
            client.sendRequest("GetInputAudioBalance", { inputName }),
            client.sendRequest("GetInputAudioSyncOffset", { inputName }),
            client.sendRequest("GetInputAudioMonitorType", { inputName }),
            client.sendRequest("GetInputAudioTracks", { inputName }),
          ]);

          const mute = muteRes.status === "fulfilled" ? (muteRes.value as any)?.inputMuted : null;
          const vol = volRes.status === "fulfilled" ? (volRes.value as any) : null;
          const bal = balRes.status === "fulfilled" ? (balRes.value as any)?.inputAudioBalance : null;
          const sync = syncRes.status === "fulfilled" ? (syncRes.value as any)?.inputAudioSyncOffset : null;
          const monitor = monitorRes.status === "fulfilled" ? (monitorRes.value as any)?.monitorType : null;
          const tracks = tracksRes.status === "fulfilled" ? (tracksRes.value as any)?.inputAudioTracks : null;

          return {
            inputName,
            inputKind: input.inputKind,
            unversionedInputKind: input.unversionedInputKind,
            muted: mute,
            volumeDb: vol?.inputVolumeDb ?? null,
            volumeMul: vol?.inputVolumeMul ?? null,
            balance: bal,
            syncOffsetMs: sync,
            monitorType: monitor,
            audioTracks: tracks,
          };
        })
      );

      const payload = {
        timestamp: new Date().toISOString(),
        specialInputs,
        totalInputs: inputAudios.length,
        inputs: inputAudios,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );

  // 4. obs://events/recent
  server.registerResource(
    "obs-events-recent",
    "obs://events/recent",
    {
      mimeType: "application/json",
      description: "Recent OBS WebSocket events captured in real-time (last 100 events ring buffer: scene switches, audio changes, stream/record alerts)",
    },
    async (uri) => {
      const events = client.getRecentEvents(100);
      const payload = {
        timestamp: new Date().toISOString(),
        totalCaptured: events.length,
        events,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );
}
