import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OBSWebSocketClient } from "../client.js";
import { ToolFilterOptions, parseFilterOptions, isCategoryEnabled } from "../filter.js";

// Import specific tool modules
import * as general from "./general.js";
import * as scenes from "./scenes.js";
import * as sources from "./sources.js";
import * as sceneItems from "./scene-items.js";
import * as streaming from "./streaming.js";
import * as transitions from "./transitions.js";
import * as config from "./config.js";
import * as filters from "./filters.js";
import * as inputs from "./inputs.js";
import * as mediaInputs from "./media-inputs.js";
import * as outputs from "./outputs.js";
import * as record from "./record.js";
import * as ui from "./ui.js";
import * as compound from "./compound.js";

const logger = {
  log: (message: string) => console.error(message),
};

// Export the initialization function for tools with dynamic category filtering
export async function initialize(
  server: McpServer,
  client: OBSWebSocketClient,
  filterOptions?: ToolFilterOptions
): Promise<void> {
  const options = filterOptions ?? parseFilterOptions();

  const moduleInitializers: Array<{ name: string; category: Parameters<typeof isCategoryEnabled>[0]; init: () => Promise<void> }> = [
    { name: "general", category: "general", init: () => general.initialize(server, client) },
    { name: "scenes", category: "scenes", init: () => scenes.initialize(server, client) },
    { name: "sources", category: "sources", init: () => sources.initialize(server, client) },
    { name: "scene-items", category: "scene-items", init: () => sceneItems.initialize(server, client) },
    { name: "streaming", category: "streaming", init: () => streaming.initialize(server, client) },
    { name: "transitions", category: "transitions", init: () => transitions.initialize(server, client) },
    { name: "config", category: "config", init: () => config.initialize(server, client) },
    { name: "filters", category: "filters", init: () => filters.initialize(server, client) },
    { name: "inputs", category: "inputs", init: () => inputs.initialize(server, client) },
    { name: "media-inputs", category: "media-inputs", init: () => mediaInputs.initialize(server, client) },
    { name: "outputs", category: "outputs", init: () => outputs.initialize(server, client) },
    { name: "record", category: "record", init: () => record.initialize(server, client) },
    { name: "ui", category: "ui", init: () => ui.initialize(server, client) },
    { name: "compound", category: "compound", init: () => compound.initialize(server, client) },
  ];

  const activeInitializers = moduleInitializers.filter((m) => isCategoryEnabled(m.category, options));
  const activeNames = activeInitializers.map((m) => m.name);

  logger.log(`Active tool modules (${activeNames.length}/${moduleInitializers.length}): [${activeNames.join(", ")}]`);

  await Promise.all(activeInitializers.map((m) => m.init()));
}

// Export tool modules
export { 
  general, 
  scenes, 
  sources, 
  sceneItems, 
  streaming, 
  transitions,
  config,
  filters,
  inputs,
  mediaInputs,
  outputs,
  record,
  ui,
  compound
};
