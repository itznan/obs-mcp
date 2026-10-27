#!/usr/bin/env python3

import asyncio
import os
import logging
import sys
from pathlib import Path

# Add directories to sys.path
parent_dir = str(Path(__file__).resolve().parent.parent)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
py_src_dir = str(Path(__file__).resolve().parent)
if py_src_dir not in sys.path:
    sys.path.insert(0, py_src_dir)

# Configure logging to stderr to prevent corrupting stdio transport
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger("obs_mcp")

# Import server and client
try:
    from py_src.server import mcp, obs_client, loop
    from py_src.safety import get_safety_config
except ImportError:
    from server import mcp, obs_client, loop
    from safety import get_safety_config

# Check mode: compound vs granular
mode = os.environ.get("OBS_MCP_MODE", "").lower()
is_compound = ("--compound" in sys.argv) or (mode == "compound")

safety_cfg = get_safety_config()
logger.info(f"Safety guardrails: read_only={safety_cfg.read_only}, protect_destructive={safety_cfg.protect_destructive}, allow_live_stream={safety_cfg.allow_live_stream}")

if is_compound:
    logger.info("Registering Compound Tools mode (12 consolidated tools)")
    try:
        import py_src.compound
    except ImportError:
        import compound
else:
    # Granular tools registration
    cat_env = os.environ.get("OBS_MCP_MODULES") or os.environ.get("OBS_MCP_CATEGORIES")
    enabled_categories = None
    if cat_env:
        enabled_categories = set(c.strip().lower() for c in cat_env.split(",") if c.strip())
    for arg in sys.argv[1:]:
        if arg.startswith("--categories=") or arg.startswith("--modules="):
            vals = arg.split("=", 1)[1]
            enabled_categories = set(c.strip().lower() for c in vals.split(",") if c.strip())

    def is_cat_active(name: str) -> bool:
        if enabled_categories is None:
            return True
        return name.lower() in enabled_categories

    logger.info("Registering granular tool modules...")
    if is_cat_active("general"):
        try: import py_src.general
        except ImportError: import general
    if is_cat_active("scenes"):
        try: import py_src.scenes
        except ImportError: import scenes
    if is_cat_active("sources"):
        try: import py_src.sources
        except ImportError: import sources
    if is_cat_active("scene_items") or is_cat_active("scene-items"):
        try: import py_src.scene_items
        except ImportError: import scene_items
    if is_cat_active("streaming"):
        try: import py_src.streaming
        except ImportError: import streaming
    if is_cat_active("transitions"):
        try: import py_src.transitions
        except ImportError: import transitions

# Always register resources
try:
    import py_src.resources
except ImportError:
    import resources

async def startup():
    """Connect to OBS WebSocket server on startup"""
    try:
        await obs_client.connect()
        logger.info("Connected to OBS WebSocket server")
    except Exception as e:
        logger.error(f"Failed to connect to OBS WebSocket server on startup: {e}")
        logger.error("Make sure OBS is running and WebSocket server is enabled. Will connect on first tool request.")

async def shutdown():
    """Close connection to OBS WebSocket server on shutdown"""
    await obs_client.close()
    logger.info("Disconnected from OBS WebSocket server")

if __name__ == "__main__":
    try:
        loop.run_until_complete(startup())
    except Exception as e:
        logger.warning(f"Startup connection warning: {e}")

    try:
        mcp.run(transport='stdio')
    finally:
        try:
            loop.run_until_complete(shutdown())
        except Exception:
            pass
