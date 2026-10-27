import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OBSWebSocketClient } from "../client.js";
import { z } from "zod";

export async function initialize(server: McpServer, client: OBSWebSocketClient): Promise<void> {
  // GetSceneList tool
  server.tool(
    "obs-get-scene-list",
    "Get a list of scenes in OBS",
    {},
    async () => {
      try {
        const sceneList = await client.sendRequest("GetSceneList");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(sceneList, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting scene list: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetCurrentProgramScene tool
  server.tool(
    "obs-get-current-scene",
    "Get the current active scene in OBS",
    {},
    async () => {
      try {
        const currentScene = await client.sendRequest("GetCurrentProgramScene");
        return {
          content: [
            {
              type: "text",
              text: `Current scene: ${currentScene.currentProgramSceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting current scene: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetCurrentProgramScene tool
  server.tool(
    "obs-set-current-scene",
    "Set the current active scene in OBS",
    {
      sceneName: z.string().describe("The name of the scene to set as current")
    },
    async ({ sceneName }) => {
      try {
        await client.sendRequest("SetCurrentProgramScene", { sceneName });
        return {
          content: [
            {
              type: "text",
              text: `Successfully switched to scene: ${sceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting current scene: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetCurrentPreviewScene tool (Studio Mode)
  server.tool(
    "obs-get-preview-scene",
    "Get the current preview scene in OBS Studio Mode",
    {},
    async () => {
      try {
        const previewScene = await client.sendRequest("GetCurrentPreviewScene");
        return {
          content: [
            {
              type: "text",
              text: `Preview scene: ${previewScene.currentPreviewSceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting preview scene: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetCurrentPreviewScene tool (Studio Mode)
  server.tool(
    "obs-set-preview-scene",
    "Set the current preview scene in OBS Studio Mode",
    {
      sceneName: z.string().describe("The name of the scene to set as preview")
    },
    async ({ sceneName }) => {
      try {
        await client.sendRequest("SetCurrentPreviewScene", { sceneName });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set preview scene to: ${sceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting preview scene: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // CreateScene tool
  server.tool(
    "obs-create-scene",
    "Create a new scene in OBS",
    {
      sceneName: z.string().describe("The name for the new scene")
    },
    async ({ sceneName }) => {
      try {
        await client.sendRequest("CreateScene", { sceneName });
        return {
          content: [
            {
              type: "text",
              text: `Successfully created scene: ${sceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating scene: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // RemoveScene tool
  server.tool(
    "obs-remove-scene",
    "Remove a scene from OBS",
    {
      sceneName: z.string().describe("The name of the scene to remove"),
      confirm: z.boolean().optional().describe("Explicit confirmation required when OBS_PROTECT_DESTRUCTIVE is active")
    },
    async ({ sceneName, confirm }) => {
      try {
        await client.sendRequest("RemoveScene", { sceneName, confirm });
        return {
          content: [
            {
              type: "text",
              text: `Successfully removed scene: ${sceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error removing scene: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // TriggerStudioModeTransition tool
  server.tool(
    "obs-trigger-studio-transition",
    "Trigger a transition from preview to program scene in Studio Mode",
    {},
    async () => {
      try {
        await client.sendRequest("TriggerStudioModeTransition");
        return {
          content: [
            {
              type: "text",
              text: "Successfully triggered studio mode transition"
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error triggering studio transition: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetGroupList tool
  server.tool(
    "obs-get-group-list",
    "Gets an array of all groups in OBS",
    {},
    async () => {
      try {
        const response = await client.sendRequest("GetGroupList");
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
              text: `Error getting group list: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetSceneName tool
  server.tool(
    "obs-set-scene-name",
    "Sets the name of a scene (rename)",
    {
      newSceneName: z.string().describe("New name for the scene"),
      sceneName: z.string().optional().describe("Current name of the scene to be renamed"),
      sceneUuid: z.string().optional().describe("UUID of the scene to be renamed")
    },
    async ({ newSceneName, sceneName, sceneUuid }) => {
      try {
        await client.sendRequest("SetSceneName", {
          newSceneName,
          sceneName,
          sceneUuid
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully renamed scene to: ${newSceneName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting scene name: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSceneSceneTransitionOverride tool
  server.tool(
    "obs-get-scene-transition-override",
    "Gets the scene transition overridden for a scene",
    {
      sceneName: z.string().optional().describe("Name of the scene"),
      sceneUuid: z.string().optional().describe("UUID of the scene")
    },
    async ({ sceneName, sceneUuid }) => {
      try {
        const response = await client.sendRequest("GetSceneSceneTransitionOverride", {
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
              text: `Error getting scene transition override: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetSceneSceneTransitionOverride tool
  server.tool(
    "obs-set-scene-transition-override",
    "Sets the scene transition overridden for a scene",
    {
      sceneName: z.string().optional().describe("Name of the scene"),
      sceneUuid: z.string().optional().describe("UUID of the scene"),
      transitionName: z.string().nullable().optional().describe("Name of the scene transition to use as override (null to remove)"),
      transitionDuration: z.number().nullable().optional().describe("Duration to use for overridden transition in ms (null to remove)")
    },
    async ({ sceneName, sceneUuid, transitionName, transitionDuration }) => {
      try {
        await client.sendRequest("SetSceneSceneTransitionOverride", {
          sceneName,
          sceneUuid,
          transitionName: transitionName === undefined ? undefined : transitionName,
          transitionDuration: transitionDuration === undefined ? undefined : transitionDuration
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set scene transition override for scene: ${sceneName || sceneUuid || "specified scene"}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting scene transition override: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

}
