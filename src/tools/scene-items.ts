import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OBSWebSocketClient } from "../client.js";
import { z } from "zod";

export async function initialize(server: McpServer, client: OBSWebSocketClient): Promise<void> {
  // GetSceneItemList tool
  server.tool(
    "obs-get-scene-items",
    "Get a list of all scene items in a scene",
    {
      sceneName: z.string().describe("The name of the scene to get items from")
    },
    async ({ sceneName }) => {
      try {
        const sceneItems = await client.sendRequest("GetSceneItemList", { sceneName });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(sceneItems, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting scene items: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // CreateSceneItem tool
  server.tool(
    "obs-create-scene-item",
    "Create a scene item for a source in a scene",
    {
      sceneName: z.string().describe("The scene to add the source to"),
      sourceName: z.string().describe("The name of the source to add"),
      enabled: z.boolean().optional().describe("Whether the scene item is enabled/visible (default: true)")
    },
    async ({ sceneName, sourceName, enabled = true }) => {
      try {
        const response = await client.sendRequest("CreateSceneItem", {
          sceneName,
          sourceName,
          sceneItemEnabled: enabled
        });

        return {
          content: [
            {
              type: "text",
              text: `Successfully added ${sourceName} to ${sceneName} with ID: ${response.sceneItemId}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating scene item: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // RemoveSceneItem tool
  server.tool(
    "obs-remove-scene-item",
    "Remove a scene item from a scene",
    {
      sceneName: z.string().describe("The scene to remove the item from"),
      sceneItemId: z.number().describe("The ID of the scene item to remove")
    },
    async ({ sceneName, sceneItemId }) => {
      try {
        await client.sendRequest("RemoveSceneItem", { sceneName, sceneItemId });

        return {
          content: [
            {
              type: "text",
              text: `Successfully removed item with ID ${sceneItemId} from ${sceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error removing scene item: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetSceneItemEnabled tool
  server.tool(
    "obs-set-scene-item-enabled",
    "Show or hide a scene item",
    {
      sceneName: z.string().describe("The scene that the source belongs to"),
      sceneItemId: z.number().describe("The ID of the scene item"),
      enabled: z.boolean().describe("Whether to show (true) or hide (false) the item")
    },
    async ({ sceneName, sceneItemId, enabled }) => {
      try {
        await client.sendRequest("SetSceneItemEnabled", {
          sceneName,
          sceneItemId,
          sceneItemEnabled: enabled
        });

        return {
          content: [
            {
              type: "text",
              text: `Successfully ${enabled ? "showed" : "hid"} item with ID ${sceneItemId} in ${sceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting scene item visibility: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSceneItemTransform tool
  server.tool(
    "obs-get-scene-item-transform",
    "Get the position, rotation, scale, or crop of a scene item",
    {
      sceneName: z.string().describe("The scene the item is in"),
      sceneItemId: z.number().describe("The ID of the scene item")
    },
    async ({ sceneName, sceneItemId }) => {
      try {
        const response = await client.sendRequest("GetSceneItemTransform", { sceneName, sceneItemId });
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
              text: `Error getting scene item transform: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetSceneItemTransform tool
  server.tool(
    "obs-set-scene-item-transform",
    "Set the position, rotation, scale, or crop of a scene item",
    {
      sceneName: z.string().describe("The scene the item is in"),
      sceneItemId: z.number().describe("The ID of the scene item"),
      positionX: z.number().optional().describe("The x position"),
      positionY: z.number().optional().describe("The y position"),
      rotation: z.number().optional().describe("The rotation in degrees"),
      scaleX: z.number().optional().describe("The x scale factor"),
      scaleY: z.number().optional().describe("The y scale factor"),
      cropTop: z.number().optional().describe("The number of pixels cropped off the top"),
      cropBottom: z.number().optional().describe("The number of pixels cropped off the bottom"),
      cropLeft: z.number().optional().describe("The number of pixels cropped off the left"),
      cropRight: z.number().optional().describe("The number of pixels cropped off the right")
    },
    async (params) => {
      try {
        const { sceneName, sceneItemId, ...transformParams } = params;

        // Build the transform object
        const sceneItemTransform: Record<string, any> = {};

        if (transformParams.positionX !== undefined || transformParams.positionY !== undefined) {
          sceneItemTransform.positionX = transformParams.positionX;
          sceneItemTransform.positionY = transformParams.positionY;
        }

        if (transformParams.rotation !== undefined) {
          sceneItemTransform.rotation = transformParams.rotation;
        }

        if (transformParams.scaleX !== undefined || transformParams.scaleY !== undefined) {
          sceneItemTransform.scaleX = transformParams.scaleX;
          sceneItemTransform.scaleY = transformParams.scaleY;
        }

        if (transformParams.cropTop !== undefined || transformParams.cropBottom !== undefined ||
          transformParams.cropLeft !== undefined || transformParams.cropRight !== undefined) {
          if (transformParams.cropTop !== undefined) sceneItemTransform.cropTop = transformParams.cropTop;
          if (transformParams.cropBottom !== undefined) sceneItemTransform.cropBottom = transformParams.cropBottom;
          if (transformParams.cropLeft !== undefined) sceneItemTransform.cropLeft = transformParams.cropLeft;
          if (transformParams.cropRight !== undefined) sceneItemTransform.cropRight = transformParams.cropRight;
        }

        await client.sendRequest("SetSceneItemTransform", {
          sceneName,
          sceneItemId,
          sceneItemTransform
        });

        return {
          content: [
            {
              type: "text",
              text: `Successfully updated transform for item with ID ${sceneItemId} in ${sceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting scene item transform: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSceneItemIdByName tool
  server.tool(
    "obs-get-scene-item-id",
    "Get the ID of a scene item by its source name",
    {
      sceneName: z.string().describe("The scene name to search in"),
      sourceName: z.string().describe("The source name to find")
    },
    async ({ sceneName, sourceName }) => {
      try {
        const response = await client.sendRequest("GetSceneItemId", {
          sceneName,
          sourceName
        });

        return {
          content: [
            {
              type: "text",
              text: `Scene item ID for ${sourceName} in ${sceneName}: ${response.sceneItemId}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting scene item ID: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetGroupSceneItemList tool
  server.tool(
    "obs-get-group-scene-items",
    "Get a list of all scene items in a group",
    {
      sceneName: z.string().optional().describe("The name of the group to get items from"),
      sceneUuid: z.string().optional().describe("The UUID of the group to get items from")
    },
    async ({ sceneName, sceneUuid }) => {
      try {
        const response = await client.sendRequest("GetGroupSceneItemList", {
          sceneName,
          sceneUuid
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
              text: `Error getting group scene items: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSceneItemSource tool
  server.tool(
    "obs-get-scene-item-source",
    "Gets the source associated with a scene item",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, sceneName, sceneUuid }) => {
      try {
        const response = await client.sendRequest("GetSceneItemSource", {
          sceneItemId,
          sceneName,
          sceneUuid
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
              text: `Error getting scene item source: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // DuplicateSceneItem tool
  server.tool(
    "obs-duplicate-scene-item",
    "Duplicates a scene item, copying all transform and crop info",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item to duplicate"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in"),
      destinationSceneName: z.string().optional().describe("Name of the scene to create the duplicated item in"),
      destinationSceneUuid: z.string().optional().describe("UUID of the scene to create the duplicated item in")
    },
    async ({ sceneItemId, sceneName, sceneUuid, destinationSceneName, destinationSceneUuid }) => {
      try {
        const response = await client.sendRequest("DuplicateSceneItem", {
          sceneItemId,
          sceneName,
          sceneUuid,
          destinationSceneName,
          destinationSceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully duplicated scene item. New scene item ID: ${response.sceneItemId}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error duplicating scene item: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSceneItemEnabled tool
  server.tool(
    "obs-get-scene-item-enabled",
    "Gets the enable/visibility state of a scene item",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, sceneName, sceneUuid }) => {
      try {
        const response = await client.sendRequest("GetSceneItemEnabled", {
          sceneItemId,
          sceneName,
          sceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Scene item ${sceneItemId} enabled: ${response.sceneItemEnabled}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting scene item enabled state: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSceneItemLocked tool
  server.tool(
    "obs-get-scene-item-locked",
    "Gets the lock state of a scene item",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, sceneName, sceneUuid }) => {
      try {
        const response = await client.sendRequest("GetSceneItemLocked", {
          sceneItemId,
          sceneName,
          sceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Scene item ${sceneItemId} locked: ${response.sceneItemLocked}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting scene item locked state: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetSceneItemLocked tool
  server.tool(
    "obs-set-scene-item-locked",
    "Sets the lock state of a scene item",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      locked: z.boolean().describe("New lock state of the scene item (true to lock, false to unlock)"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, locked, sceneName, sceneUuid }) => {
      try {
        await client.sendRequest("SetSceneItemLocked", {
          sceneItemId,
          sceneItemLocked: locked,
          sceneName,
          sceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully ${locked ? "locked" : "unlocked"} item with ID ${sceneItemId}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting scene item locked state: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSceneItemIndex tool
  server.tool(
    "obs-get-scene-item-index",
    "Gets the index position of a scene item in a scene (0 is bottom of the source list)",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, sceneName, sceneUuid }) => {
      try {
        const response = await client.sendRequest("GetSceneItemIndex", {
          sceneItemId,
          sceneName,
          sceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Scene item ${sceneItemId} index position: ${response.sceneItemIndex}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting scene item index: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetSceneItemIndex tool
  server.tool(
    "obs-set-scene-item-index",
    "Sets the index position of a scene item in a scene (0 is bottom of the source list)",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      sceneItemIndex: z.number().min(0).describe("New index position of the scene item (>= 0)"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, sceneItemIndex, sceneName, sceneUuid }) => {
      try {
        await client.sendRequest("SetSceneItemIndex", {
          sceneItemId,
          sceneItemIndex,
          sceneName,
          sceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set index position of item with ID ${sceneItemId} to ${sceneItemIndex}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting scene item index: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSceneItemBlendMode tool
  server.tool(
    "obs-get-scene-item-blend-mode",
    "Gets the blend mode of a scene item",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, sceneName, sceneUuid }) => {
      try {
        const response = await client.sendRequest("GetSceneItemBlendMode", {
          sceneItemId,
          sceneName,
          sceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Scene item ${sceneItemId} blend mode: ${response.sceneItemBlendMode}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting scene item blend mode: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetSceneItemBlendMode tool
  server.tool(
    "obs-set-scene-item-blend-mode",
    "Sets the blend mode of a scene item (OBS_BLEND_NORMAL, OBS_BLEND_ADDITIVE, OBS_BLEND_SUBTRACT, OBS_BLEND_SCREEN, OBS_BLEND_MULTIPLY, OBS_BLEND_LIGHTEN, OBS_BLEND_DARKEN)",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      blendMode: z.string().describe("New blend mode (OBS_BLEND_NORMAL, OBS_BLEND_ADDITIVE, OBS_BLEND_SUBTRACT, OBS_BLEND_SCREEN, OBS_BLEND_MULTIPLY, OBS_BLEND_LIGHTEN, OBS_BLEND_DARKEN)"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, blendMode, sceneName, sceneUuid }) => {
      try {
        await client.sendRequest("SetSceneItemBlendMode", {
          sceneItemId,
          sceneItemBlendMode: blendMode,
          sceneName,
          sceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set blend mode of item ${sceneItemId} to ${blendMode}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting scene item blend mode: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSceneItemPrivateSettings tool
  server.tool(
    "obs-get-scene-item-private-settings",
    "Gets the private settings of a scene item",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, sceneName, sceneUuid }) => {
      try {
        const response = await client.sendRequest("GetSceneItemPrivateSettings", {
          sceneItemId,
          sceneName,
          sceneUuid
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
              text: `Error getting scene item private settings: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetSceneItemPrivateSettings tool
  server.tool(
    "obs-set-scene-item-private-settings",
    "Sets the private settings of a scene item",
    {
      sceneItemId: z.number().describe("Numeric ID of the scene item"),
      sceneItemSettings: z.record(z.any()).describe("Private settings object to apply to the scene item"),
      overlay: z.boolean().optional().describe("Whether to overlay over the current settings or replace them (default true)"),
      sceneName: z.string().optional().describe("Name of the scene the item is in"),
      sceneUuid: z.string().optional().describe("UUID of the scene the item is in")
    },
    async ({ sceneItemId, sceneItemSettings, overlay, sceneName, sceneUuid }) => {
      try {
        await client.sendRequest("SetSceneItemPrivateSettings", {
          sceneItemId,
          sceneItemSettings,
          overlay,
          sceneName,
          sceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully updated private settings for scene item ${sceneItemId}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting scene item private settings: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

}
