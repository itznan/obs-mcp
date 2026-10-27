import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OBSWebSocketClient } from "../client.js";
import { z } from "zod";

export async function initialize(server: McpServer, client: OBSWebSocketClient): Promise<void> {
  // GetTransitionList tool
  server.tool(
    "obs-get-transition-list",
    "Get a list of available transitions in OBS",
    {},
    async () => {
      try {
        const transitions = await client.sendRequest("GetSceneTransitionList");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(transitions, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting transition list: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetCurrentTransition tool
  server.tool(
    "obs-get-current-transition",
    "Get the name of the currently active transition",
    {},
    async () => {
      try {
        const transition = await client.sendRequest("GetCurrentSceneTransition");
        return {
          content: [
            {
              type: "text",
              text: `Current transition: ${transition.transitionName} (${transition.transitionKind}) with duration: ${transition.transitionDuration}ms`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting current transition: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetCurrentTransition tool
  server.tool(
    "obs-set-current-transition",
    "Set the current transition in OBS",
    {
      transitionName: z.string().describe("The name of the transition to set as current")
    },
    async ({ transitionName }) => {
      try {
        await client.sendRequest("SetCurrentSceneTransition", { transitionName });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set current transition to: ${transitionName}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting current transition: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetTransitionDuration tool
  server.tool(
    "obs-get-transition-duration",
    "Get the duration of the current transition in milliseconds",
    {},
    async () => {
      try {
        const transition = await client.sendRequest("GetCurrentSceneTransition");
        return {
          content: [
            {
              type: "text",
              text: `Current transition duration: ${transition.transitionDuration}ms`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting transition duration: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetTransitionDuration tool
  server.tool(
    "obs-set-transition-duration",
    "Set the duration of the current transition in milliseconds",
    {
      duration: z.number().min(0).describe("The duration to set in milliseconds")
    },
    async ({ duration }) => {
      try {
        await client.sendRequest("SetCurrentSceneTransitionDuration", { transitionDuration: duration });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set transition duration to: ${duration}ms`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting transition duration: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetTransitionKind tool
  server.tool(
    "obs-get-transition-kind",
    "Get the kind/type of the current transition",
    {},
    async () => {
      try {
        const transition = await client.sendRequest("GetCurrentSceneTransition");
        return {
          content: [
            {
              type: "text",
              text: `Current transition kind: ${transition.transitionKind}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting transition kind: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetTransitionSettings tool
  server.tool(
    "obs-set-transition-settings",
    "Set the settings of the current transition",
    {
      transitionSettings: z.record(z.any()).describe("The settings to apply to the transition")
    },
    async ({ transitionSettings }) => {
      try {
        await client.sendRequest("SetCurrentSceneTransitionSettings", { transitionSettings });
        return {
          content: [
            {
              type: "text",
              text: "Successfully updated current transition settings"
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting transition settings: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetTransitionSettings tool
  server.tool(
    "obs-get-transition-settings",
    "Get the settings of the current transition",
    {},
    async () => {
      try {
        const transition = await client.sendRequest("GetCurrentSceneTransition");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(transition.transitionSettings, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting transition settings: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // TriggerStudioModeTransition tool
  server.tool(
    "obs-trigger-transition",
    "Trigger a scene transition in OBS (Studio Mode must be enabled)",
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
              text: `Error triggering transition: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetTransitionKindList tool
  server.tool(
    "obs-get-transition-kind-list",
    "Gets an array of all available transition kinds in OBS",
    {},
    async () => {
      try {
        const response = await client.sendRequest("GetTransitionKindList");
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
              text: `Error getting transition kind list: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetCurrentSceneTransitionCursor tool
  server.tool(
    "obs-get-transition-cursor",
    "Gets the cursor position of the current scene transition (0.0 to 1.0, 1.0 when inactive)",
    {},
    async () => {
      try {
        const response = await client.sendRequest("GetCurrentSceneTransitionCursor");
        return {
          content: [
            {
              type: "text",
              text: `Current scene transition cursor: ${response.transitionCursor}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting transition cursor: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetTBarPosition tool
  server.tool(
    "obs-set-tbar-position",
    "Sets the position of the TBar",
    {
      position: z.number().min(0.0).max(1.0).describe("New position between 0.0 and 1.0"),
      release: z.boolean().optional().describe("Whether to release the TBar (default true)")
    },
    async ({ position, release }) => {
      try {
        await client.sendRequest("SetTBarPosition", {
          position,
          release
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully set TBar position to: ${position}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting TBar position: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

}
