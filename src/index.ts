#!/usr/bin/env node

import { startServer } from "./server.js";
import { CANONICAL_CATEGORIES } from "./filter.js";

const logger = {
  log: (message: string) => console.log(message),
  error: (message: string) => console.error(message),
  debug: (message: string) => console.debug(message),
};

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
OBS Studio MCP Server

Usage:
  obs-mcp [options]

Options:
  --categories, --modules, -c <list>  Comma-separated list of tool categories to load
                                      Available: ${CANONICAL_CATEGORIES.join(", ")}
  --compound                          Load consolidated compound tools (solves context bloat)
  --mode <compound|granular|both>     Tool registration mode (default: granular)
  --read-only                         Enable read-only mode (blocks all state-modifying requests)
  --protect-destructive               Protect live broadcast and destructive actions
  --allow-live-stream                 Allow streaming actions without explicit confirmation
  --help, -h                          Show this help message

Environment Variables:
  OBS_WEBSOCKET_URL                   WebSocket URL (default: ws://localhost:4455)
  OBS_WEBSOCKET_PASSWORD              Password for OBS WebSocket authentication
  OBS_MCP_MODULES, OBS_MCP_CATEGORIES Filter categories (e.g. "scenes,inputs,record")
  OBS_MCP_MODE                        Tool registration mode ("compound", "granular", or "both")
  OBS_READ_ONLY                       Enable read-only guardrail ("true" or "false")
  OBS_PROTECT_DESTRUCTIVE             Protect destructive actions ("true" or "false")
  OBS_ALLOW_LIVE_STREAM               Allow live stream actions ("true" or "false")

Examples:
  npx obs-mcp --categories=scenes,inputs,record
  npx obs-mcp --compound
  OBS_READ_ONLY=true npx obs-mcp
  OBS_PROTECT_DESTRUCTIVE=true npx obs-mcp --compound
`);
  process.exit(0);
}

// Set up better error handling
process.on("uncaughtException", (error) => {
  logger.error(`Uncaught exception: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  logger.error(`Fatal error in main(): ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
