import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OBSWebSocketClient } from "../client.js";
import { z } from "zod";
import { formatScreenshotContent } from "../screenshot-util.js";

export async function initialize(server: McpServer, client: OBSWebSocketClient): Promise<void> {
  // GetSourceActive tool
  server.tool(
    "obs-get-source-active",
    "Gets the active and show state of a source",
    {
      sourceName: z.string().optional().describe("Name of the source to get the active state of"),
      sourceUuid: z.string().optional().describe("UUID of the source to get the active state of")
    },
    async ({ sourceName, sourceUuid }) => {
      try {
        const response = await client.sendRequest("GetSourceActive", {
          sourceName,
          sourceUuid
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
              text: `Error getting source active state: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSourceScreenshot tool (Native MCP Multimodal ImageContent)
  server.tool(
    "obs-get-source-screenshot",
    "Gets a screenshot of a source or current scene as native MCP multimodal ImageContent for vision models",
    {
      sourceName: z.string().optional().describe("Name of the source or scene to screenshot (defaults to active program scene if omitted)"),
      sourceUuid: z.string().optional().describe("UUID of the source to take a screenshot of"),
      imageFormat: z.string().optional().default("png").describe("Image format ('png', 'jpg', 'jpeg', default: 'png')"),
      imageWidth: z.number().optional().default(960).describe("Width to scale screenshot to (default: 960 for vision token efficiency)"),
      imageHeight: z.number().optional().describe("Height to scale screenshot to (maintains aspect ratio if omitted)"),
      imageCompressionQuality: z.number().optional().default(80).describe("Compression quality 0-100 (default: 80)")
    },
    async ({ sourceName, sourceUuid, imageFormat = "png", imageWidth = 960, imageHeight, imageCompressionQuality = 80 }) => {
      try {
        let targetSourceName = sourceName;
        if (!targetSourceName && !sourceUuid) {
          try {
            const currentScene = await client.sendRequest("GetCurrentProgramScene");
            targetSourceName = currentScene.currentProgramSceneName || currentScene.sceneName;
          } catch {
            // fallback
          }
        }

        const response = await client.sendRequest("GetSourceScreenshot", {
          sourceName: targetSourceName,
          sourceUuid,
          imageFormat,
          imageWidth,
          imageHeight,
          imageCompressionQuality
        });
        
        const content = formatScreenshotContent(
          response.imageData,
          targetSourceName || sourceUuid,
          imageFormat,
          imageWidth
        );

        return {
          content
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting source screenshot: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SaveSourceScreenshot tool
  server.tool(
    "obs-save-source-screenshot",
    "Saves a screenshot of a source to the filesystem",
    {
      sourceName: z.string().optional().describe("Name of the source to take a screenshot of"),
      sourceUuid: z.string().optional().describe("UUID of the source to take a screenshot of"),
      imageFormat: z.string().describe("Image compression format to use"),
      imageFilePath: z.string().describe("Path to save the screenshot file to"),
      imageWidth: z.number().optional().describe("Width to scale the screenshot to"),
      imageHeight: z.number().optional().describe("Height to scale the screenshot to"),
      imageCompressionQuality: z.number().optional().describe("Compression quality to use (0-100, -1 for default)")
    },
    async ({ sourceName, sourceUuid, imageFormat, imageFilePath, imageWidth, imageHeight, imageCompressionQuality }) => {
      try {
        await client.sendRequest("SaveSourceScreenshot", {
          sourceName,
          sourceUuid,
          imageFormat,
          imageFilePath,
          imageWidth,
          imageHeight,
          imageCompressionQuality
        });
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully saved screenshot to: ${imageFilePath}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error saving source screenshot: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // GetSourcePrivateSettings tool
  server.tool(
    "obs-get-source-private-settings",
    "Gets the private settings of a source",
    {
      sourceName: z.string().optional().describe("Name of the source to get private settings from"),
      sourceUuid: z.string().optional().describe("UUID of the source to get private settings from")
    },
    async ({ sourceName, sourceUuid }) => {
      try {
        const response = await client.sendRequest("GetSourcePrivateSettings", {
          sourceName,
          sourceUuid
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
              text: `Error getting source private settings: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

  // SetSourcePrivateSettings tool
  server.tool(
    "obs-set-source-private-settings",
    "Sets the private settings of a source",
    {
      sourceSettings: z.record(z.any()).describe("Private settings object to apply to the source"),
      sourceName: z.string().optional().describe("Name of the source to set private settings for"),
      sourceUuid: z.string().optional().describe("UUID of the source to set private settings for"),
      overlay: z.boolean().optional().describe("Whether to overlay over the current settings or replace them (default true)")
    },
    async ({ sourceSettings, sourceName, sourceUuid, overlay }) => {
      try {
        await client.sendRequest("SetSourcePrivateSettings", {
          sourceSettings,
          sourceName,
          sourceUuid,
          overlay
        });
        return {
          content: [
            {
              type: "text",
              text: `Successfully updated private settings for source: ${sourceName || sourceUuid || "specified source"}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error setting source private settings: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    }
  );

}
