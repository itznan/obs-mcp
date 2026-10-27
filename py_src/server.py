#!/usr/bin/env python3

import asyncio
import logging

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    from mcp.server.mcpserver import MCPServer as FastMCP

from .client import OBSWebSocketClient

# Setup logging
logger = logging.getLogger("obs_server")

# Dedicated event loop
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

# Server instance
try:
    mcp = FastMCP("obs_mcp", description="OBS Studio MCP Server")
except TypeError:
    mcp = FastMCP("obs_mcp")

obs_client = OBSWebSocketClient(loop=loop)

logger.debug("OBS MCP server created with dedicated event loop")
