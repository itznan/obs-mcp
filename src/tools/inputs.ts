import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OBSWebSocketClient } from "../client.js";
import { z } from "zod";

export async function initialize(server: McpServer, client: OBSWebSocketClient): Promise<void> {
  // GetInputList tool
  server.tool(
    "obs-get-input-list",
    "Gets an array of all inputs in OBS",
    {
      inputKind: z.string().optional().describe("Restrict the array to only inputs of the specified kind")
    },
    async ({ inputKind }) => {
      try {
        const requestParams: Record<string, any> = {};
        if (inputKind !== undefined) {
          requestParams.inputKind = inputKind;
        }

        const response = await client.sendRequest("GetInputList", requestParams);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input list: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputKindList tool
  server.tool(
    "obs-get-input-kind-list",
    "Gets an array of all available input kinds in OBS",
    {
      unversioned: z.boolean().optional().describe("True to return all kinds as unversioned, False to return with version suffixes")
    },
    async ({ unversioned }) => {
      try {
        const requestParams: Record<string, any> = {};
        if (unversioned !== undefined) {
          requestParams.unversioned = unversioned;
        }

        const response = await client.sendRequest("GetInputKindList", requestParams);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input kind list: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSpecialInputs tool
  server.tool(
    "obs-get-special-inputs",
    "Gets the names of all special inputs",
    {},
    async () => {
      try {
        const response = await client.sendRequest("GetSpecialInputs");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting special inputs: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // CreateInput tool
  server.tool(
    "obs-create-input",
    "Creates a new input, adding it as a scene item to the specified scene",
    {
      sceneName: z.string().describe("Name of the scene to add the input to as a scene item"),
      inputName: z.string().describe("Name of the new input to created"),
      inputKind: z.string().describe("The kind of input to be created"),
      inputSettings: z.record(z.any()).optional().describe("Settings object to initialize the input with"),
      sceneItemEnabled: z.boolean().optional().describe("Whether to set the created scene item to enabled or disabled")
    },
    async ({ sceneName, inputName, inputKind, inputSettings, sceneItemEnabled }) => {
      try {
        const requestParams: Record<string, any> = { sceneName, inputName, inputKind };
        if (inputSettings !== undefined) {
          requestParams.inputSettings = inputSettings;
        }
        if (sceneItemEnabled !== undefined) {
          requestParams.sceneItemEnabled = sceneItemEnabled;
        }

        const response = await client.sendRequest("CreateInput", requestParams);
        return {
          content: [
            {
              type: "text",
              text: `Successfully created input '${inputName}' of kind '${inputKind}' with ID ${response.sceneItemId}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating input: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // RemoveInput tool
  server.tool(
    "obs-remove-input",
    "Removes an existing input",
    {
      inputName: z.string().describe("Name of the input to remove"),
      confirm: z.boolean().optional().describe("Explicit confirmation required when OBS_PROTECT_DESTRUCTIVE is active")
    },
    async ({ inputName, confirm }) => {
      try {
        await client.sendRequest("RemoveInput", { inputName, confirm });
        return {
          content: [
            {
              type: "text",
              text: `Successfully removed input: ${inputName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error removing input: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputName tool
  server.tool(
    "obs-set-input-name",
    "Sets the name of an input (rename)",
    {
      inputName: z.string().describe("Current input name"),
      newInputName: z.string().describe("New name for the input")
    },
    async ({ inputName, newInputName }) => {
      try {
        await client.sendRequest("SetInputName", { inputName, newInputName });
        return {
          content: [
            {
              type: "text",
              text: `Successfully renamed input '${inputName}' to '${newInputName}'`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error renaming input: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputDefaultSettings tool
  server.tool(
    "obs-get-input-default-settings",
    "Gets the default settings for an input kind",
    {
      inputKind: z.string().describe("Input kind to get the default settings for")
    },
    async ({ inputKind }) => {
      try {
        const response = await client.sendRequest("GetInputDefaultSettings", { inputKind });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input default settings: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputSettings tool
  server.tool(
    "obs-get-input-settings",
    "Gets the settings of an input",
    {
      inputName: z.string().describe("Name of the input to get the settings of")
    },
    async ({ inputName }) => {
      try {
        const response = await client.sendRequest("GetInputSettings", { inputName });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input settings: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputSettings tool
  server.tool(
    "obs-set-input-settings",
    "Sets the settings of an input",
    {
      inputName: z.string().describe("Name of the input to set the settings of"),
      inputSettings: z.record(z.any()).describe("Object of settings to apply"),
      overlay: z.boolean().optional().describe("True to apply settings on top of existing ones, False to reset to defaults first")
    },
    async ({ inputName, inputSettings, overlay }) => {
      try {
        const requestParams: Record<string, any> = { inputName, inputSettings };
        if (overlay !== undefined) {
          requestParams.overlay = overlay;
        }

        await client.sendRequest("SetInputSettings", requestParams);
        return {
          content: [
            {
              type: "text",
              text: `Successfully updated settings for input: ${inputName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting input settings: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputMute tool
  server.tool(
    "obs-get-input-mute",
    "Gets the audio mute state of an input",
    {
      inputName: z.string().describe("Name of input to get the mute state of")
    },
    async ({ inputName }) => {
      try {
        const response = await client.sendRequest("GetInputMute", { inputName });
        return {
          content: [
            {
              type: "text",
              text: `Input '${inputName}' is ${response.inputMuted ? "muted" : "unmuted"}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input mute state: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputMute tool
  server.tool(
    "obs-set-input-mute",
    "Sets the audio mute state of an input",
    {
      inputName: z.string().describe("Name of the input to set the mute state of"),
      inputMuted: z.boolean().describe("Whether to mute the input or not")
    },
    async ({ inputName, inputMuted }) => {
      try {
        await client.sendRequest("SetInputMute", { inputName, inputMuted });
        return {
          content: [
            {
              type: "text",
              text: `Successfully ${inputMuted ? "muted" : "unmuted"} input: ${inputName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting input mute state: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // ToggleInputMute tool
  server.tool(
    "obs-toggle-input-mute",
    "Toggles the audio mute state of an input",
    {
      inputName: z.string().describe("Name of the input to toggle the mute state of")
    },
    async ({ inputName }) => {
      try {
        const response = await client.sendRequest("ToggleInputMute", { inputName });
        return {
          content: [
            {
              type: "text",
              text: `Successfully toggled mute state for input '${inputName}', now ${response.inputMuted ? "muted" : "unmuted"}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error toggling input mute state: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputVolume tool
  server.tool(
    "obs-get-input-volume",
    "Gets the current volume setting of an input",
    {
      inputName: z.string().describe("Name of the input to get the volume of")
    },
    async ({ inputName }) => {
      try {
        const response = await client.sendRequest("GetInputVolume", { inputName });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input volume: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputVolume tool
  server.tool(
    "obs-set-input-volume",
    "Sets the volume setting of an input",
    {
      inputName: z.string().describe("Name of the input to set the volume of"),
      inputVolumeMul: z.number().min(0).max(20).optional().describe("Volume setting in mul (0-20)"),
      inputVolumeDb: z.number().min(-100).max(26).optional().describe("Volume setting in dB (-100 to 26)")
    },
    async ({ inputName, inputVolumeMul, inputVolumeDb }) => {
      try {
        if (inputVolumeMul === undefined && inputVolumeDb === undefined) {
          throw new Error("Either inputVolumeMul or inputVolumeDb must be provided");
        }

        const requestParams: Record<string, any> = { inputName };
        if (inputVolumeMul !== undefined) {
          requestParams.inputVolumeMul = inputVolumeMul;
        }
        if (inputVolumeDb !== undefined) {
          requestParams.inputVolumeDb = inputVolumeDb;
        }

        await client.sendRequest("SetInputVolume", requestParams);
        return {
          content: [
            {
              type: "text",
              text: `Successfully set volume for input: ${inputName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting input volume: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputAudioBalance tool
  server.tool(
    "obs-get-input-audio-balance",
    "Gets the audio balance of an input",
    {
      inputName: z.string().describe("Name of the input to get the audio balance of")
    },
    async ({ inputName }) => {
      try {
        const response = await client.sendRequest("GetInputAudioBalance", { inputName });
        return {
          content: [
            {
              type: "text",
              text: `Audio balance for input '${inputName}': ${response.inputAudioBalance}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input audio balance: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputAudioBalance tool
  server.tool(
    "obs-set-input-audio-balance",
    "Sets the audio balance of an input",
    {
      inputName: z.string().describe("Name of the input to set the audio balance of"),
      inputAudioBalance: z.number().min(0).max(1).describe("New audio balance value (0.0-1.0)")
    },
    async ({ inputName, inputAudioBalance }) => {
      try {
        await client.sendRequest("SetInputAudioBalance", { inputName, inputAudioBalance });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set audio balance to ${inputAudioBalance} for input: ${inputName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting input audio balance: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputAudioSyncOffset tool
  server.tool(
    "obs-get-input-audio-sync-offset",
    "Gets the audio sync offset of an input",
    {
      inputName: z.string().describe("Name of the input to get the audio sync offset of")
    },
    async ({ inputName }) => {
      try {
        const response = await client.sendRequest("GetInputAudioSyncOffset", { inputName });
        return {
          content: [
            {
              type: "text",
              text: `Audio sync offset for input '${inputName}': ${response.inputAudioSyncOffset}ms`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input audio sync offset: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputAudioSyncOffset tool
  server.tool(
    "obs-set-input-audio-sync-offset",
    "Sets the audio sync offset of an input",
    {
      inputName: z.string().describe("Name of the input to set the audio sync offset of"),
      inputAudioSyncOffset: z.number().min(-950).max(20000).describe("New audio sync offset in milliseconds")
    },
    async ({ inputName, inputAudioSyncOffset }) => {
      try {
        await client.sendRequest("SetInputAudioSyncOffset", { inputName, inputAudioSyncOffset });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set audio sync offset to ${inputAudioSyncOffset}ms for input: ${inputName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting input audio sync offset: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputAudioMonitorType tool
  server.tool(
    "obs-get-input-audio-monitor-type",
    "Gets the audio monitor type of an input",
    {
      inputName: z.string().describe("Name of the input to get the audio monitor type of")
    },
    async ({ inputName }) => {
      try {
        const response = await client.sendRequest("GetInputAudioMonitorType", { inputName });
        return {
          content: [
            {
              type: "text",
              text: `Audio monitor type for input '${inputName}': ${response.monitorType}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input audio monitor type: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputAudioMonitorType tool
  server.tool(
    "obs-set-input-audio-monitor-type",
    "Sets the audio monitor type of an input",
    {
      inputName: z.string().describe("Name of the input to set the audio monitor type of"),
      monitorType: z.string().describe("Audio monitor type (OBS_MONITORING_TYPE_NONE, OBS_MONITORING_TYPE_MONITOR_ONLY, OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT)")
    },
    async ({ inputName, monitorType }) => {
      try {
        await client.sendRequest("SetInputAudioMonitorType", { inputName, monitorType });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set audio monitor type to ${monitorType} for input: ${inputName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting input audio monitor type: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputAudioTracks tool
  server.tool(
    "obs-get-input-audio-tracks",
    "Gets the enable state of all audio tracks of an input",
    {
      inputName: z.string().optional().describe("Name of the input"),
      inputUuid: z.string().optional().describe("UUID of the input")
    },
    async ({ inputName, inputUuid }) => {
      try {
        const response = await client.sendRequest("GetInputAudioTracks", {
          inputName,
          inputUuid
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input audio tracks: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputAudioTracks tool
  server.tool(
    "obs-set-input-audio-tracks",
    "Sets the enable state of audio tracks of an input",
    {
      inputAudioTracks: z.record(z.boolean()).describe("Track settings to apply (e.g. {'1': true, '2': false, ...})"),
      inputName: z.string().optional().describe("Name of the input"),
      inputUuid: z.string().optional().describe("UUID of the input")
    },
    async ({ inputAudioTracks, inputName, inputUuid }) => {
      try {
        await client.sendRequest("SetInputAudioTracks", {
          inputAudioTracks,
          inputName,
          inputUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully updated audio tracks for input: ${inputName || inputUuid || "specified input"}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting input audio tracks: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputDeinterlaceMode tool
  server.tool(
    "obs-get-input-deinterlace-mode",
    "Gets the deinterlace mode of an input (restricted to async inputs only)",
    {
      inputName: z.string().optional().describe("Name of the input"),
      inputUuid: z.string().optional().describe("UUID of the input")
    },
    async ({ inputName, inputUuid }) => {
      try {
        const response = await client.sendRequest("GetInputDeinterlaceMode", {
          inputName,
          inputUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Input deinterlace mode: ${response.inputDeinterlaceMode}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input deinterlace mode: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputDeinterlaceMode tool
  server.tool(
    "obs-set-input-deinterlace-mode",
    "Sets the deinterlace mode of an input (restricted to async inputs only)",
    {
      deinterlaceMode: z.string().describe("Deinterlace mode (OBS_DEINTERLACE_MODE_DISABLE, OBS_DEINTERLACE_MODE_DISCARD, OBS_DEINTERLACE_MODE_RETRO, OBS_DEINTERLACE_MODE_BLEND, OBS_DEINTERLACE_MODE_BLEND_2X, OBS_DEINTERLACE_MODE_LINEAR, OBS_DEINTERLACE_MODE_LINEAR_2X, OBS_DEINTERLACE_MODE_YADIF, OBS_DEINTERLACE_MODE_YADIF_2X)"),
      inputName: z.string().optional().describe("Name of the input"),
      inputUuid: z.string().optional().describe("UUID of the input")
    },
    async ({ deinterlaceMode, inputName, inputUuid }) => {
      try {
        await client.sendRequest("SetInputDeinterlaceMode", {
          inputDeinterlaceMode: deinterlaceMode,
          inputName,
          inputUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set deinterlace mode to ${deinterlaceMode} for input: ${inputName || inputUuid || "specified input"}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting input deinterlace mode: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputDeinterlaceFieldOrder tool
  server.tool(
    "obs-get-input-deinterlace-field-order",
    "Gets the deinterlace field order of an input (restricted to async inputs only)",
    {
      inputName: z.string().optional().describe("Name of the input"),
      inputUuid: z.string().optional().describe("UUID of the input")
    },
    async ({ inputName, inputUuid }) => {
      try {
        const response = await client.sendRequest("GetInputDeinterlaceFieldOrder", {
          inputName,
          inputUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Input deinterlace field order: ${response.inputDeinterlaceFieldOrder}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input deinterlace field order: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetInputDeinterlaceFieldOrder tool
  server.tool(
    "obs-set-input-deinterlace-field-order",
    "Sets the deinterlace field order of an input (restricted to async inputs only)",
    {
      fieldOrder: z.string().describe("Deinterlace field order (OBS_DEINTERLACE_FIELD_ORDER_TOP, OBS_DEINTERLACE_FIELD_ORDER_BOTTOM)"),
      inputName: z.string().optional().describe("Name of the input"),
      inputUuid: z.string().optional().describe("UUID of the input")
    },
    async ({ fieldOrder, inputName, inputUuid }) => {
      try {
        await client.sendRequest("SetInputDeinterlaceFieldOrder", {
          inputDeinterlaceFieldOrder: fieldOrder,
          inputName,
          inputUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set deinterlace field order to ${fieldOrder} for input: ${inputName || inputUuid || "specified input"}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting input deinterlace field order: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetInputPropertiesListPropertyItems tool
  server.tool(
    "obs-get-input-properties-list-property-items",
    "Gets the items of a list property from an input's properties (e.g. display capture available displays)",
    {
      propertyName: z.string().describe("Name of the list property to get the items of"),
      inputName: z.string().optional().describe("Name of the input"),
      inputUuid: z.string().optional().describe("UUID of the input")
    },
    async ({ propertyName, inputName, inputUuid }) => {
      try {
        const response = await client.sendRequest("GetInputPropertiesListPropertyItems", {
          propertyName,
          inputName,
          inputUuid
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting input list property items: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // PressInputPropertiesButton tool
  server.tool(
    "obs-press-input-properties-button",
    "Presses a button in the properties of an input (e.g. 'refreshnocache' for browser sources)",
    {
      propertyName: z.string().describe("Name of the button property to press"),
      inputName: z.string().optional().describe("Name of the input"),
      inputUuid: z.string().optional().describe("UUID of the input")
    },
    async ({ propertyName, inputName, inputUuid }) => {
      try {
        await client.sendRequest("PressInputPropertiesButton", {
          propertyName,
          inputName,
          inputUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully pressed property button '${propertyName}' on input: ${inputName || inputUuid || "specified input"}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error pressing input property button: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

}
