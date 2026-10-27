# OBS MCP Server

An MCP server for OBS Studio that provides tools, resources, structured prompts, multimodal vision inspection, atomic batch macros, event capturing, and safety guardrails to monitor and control OBS via the OBS WebSocket protocol. Available in both TypeScript and Python.

## Features

- Connect to OBS WebSocket server with auto-reconnection and SHA-256 authentication
- **Atomic Batch Macros (`RequestBatch` OpCode 8/9)**: Execute multi-step broadcast macros atomically in a single network round-trip with `haltOnFailure` and execution type options (`SerialRealtime`, `SerialFrame`, `Parallel`)
- **Real-Time Event Ring Buffer**: Capture incoming OBS WebSocket events (OpCode 5) in a 100-event circular buffer; exposed via `obs-get-recent-events` and `obs://events/recent`
- **Native Multimodal ImageContent**: Vision model screenshot inspection returning native `{ type: "image", data: base64, mimeType: "image/png" }` blocks
- **Safety Guardrails**: Production protection with `OBS_READ_ONLY=true` and `OBS_PROTECT_DESTRUCTIVE=true`
- **Read-Only MCP Resources**: Instant consolidated state snapshots (`obs://state/summary`, `obs://scenes/current`, `obs://audio/mixer`, `obs://events/recent`) to eliminate multi-call round trips
- **Structured MCP Prompts**: Pre-flight checklists and workflow templates (`go-live-checklist`, `recording-setup`, `emergency-brb`, `audio-check`)
- **Dynamic Tool Filtering**: Load only the modules you need to save LLM context window tokens
- **Consolidated Compound Tools**: Optional compound tool mode (`--compound`) reducing 156 tools to 12 unified tools with action enums
- **Full Engine Parity**: Both TypeScript (`build/index.js`) and Python FastMCP (`py_src/`) support batch requests, circular event buffering, compound tools, and safety guardrails
- Comprehensive coverage of the **OBS WebSocket v5 Protocol** (100% official protocol requests implemented)

---

## Atomic Request Batching (OpCode 8 RequestBatch)

Execute multi-step broadcast macros atomically in a single network call using `obs-execute-batch` or `obs_manage_general` (action: `execute_batch`):

```json
{
  "name": "obs-execute-batch",
  "arguments": {
    "executionType": "SerialRealtime",
    "haltOnFailure": true,
    "requests": [
      {
        "requestType": "SetCurrentProgramScene",
        "requestData": { "sceneName": "Intro" }
      },
      {
        "requestType": "SetInputMute",
        "requestData": { "inputName": "Mic/Aux", "inputMuted": false }
      },
      {
        "requestType": "Sleep",
        "requestData": { "sleepMillis": 500 }
      },
      {
        "requestType": "StartRecord"
      }
    ]
  }
}
```

- **Execution Types**:
  - `SerialRealtime` (0): Executes sequentially in real time (respects `Sleep` pauses).
  - `SerialFrame` (1): Executes sequentially, advancing one request per frame tick.
  - `Parallel` (2): Executes requests simultaneously.
- **Safety Integration**: Every subrequest in the batch is pre-validated against active safety policies (`OBS_READ_ONLY` and `OBS_PROTECT_DESTRUCTIVE`) before transmission.

---

## Real-Time Event Subscription & Ring Buffer

`OBSWebSocketClient` automatically subscribes to all OBS WebSocket events (`eventSubscriptions: All`). Incoming events (OpCode 5) are stored in an in-memory 100-event circular ring buffer with millisecond-precision timestamps:

- **Tool**: `obs-get-recent-events` (with `limit` and `eventType` filter)
- **MCP Resource**: `obs://events/recent` (returns the full real-time snapshot)

Enables LLMs and agents to inspect recent asynchronous OBS activity without polling:
- User manually switched scenes or muted audio in OBS GUI
- Stream dropped frames or network reconnection alerts
- Media source playback completed or loop restarted
- Recording file split or output state changed

---

## Native Multimodal Screenshot Inspection

Both `obs-get-source-screenshot` and `obs_manage_sources` (action: `get_screenshot`) return native MCP **ImageContent** objects alongside a concise text summary block. Vision models (Claude 3.5 Sonnet, Claude 3.7 Sonnet, Gemini 2.0/3.0, GPT-4o) can visually analyze scene layout, camera framing, lower-third overlays, and black screen detection directly.

- **Data URI Stripping**: Automatically extracts pure Base64 and proper MIME types (`image/png`, `image/jpeg`).
- **Context-Friendly Default Resolution**: Defaults to `imageWidth: 960` (and default `imageCompressionQuality: 80`) to balance visual clarity with context window token limits.
- **Auto Active Scene Target**: If no `sourceName` or `sourceUuid` is provided, it automatically captures the active Program scene.

```json
// Example: Simply call without parameters to inspect current program scene
{
  "name": "obs-get-source-screenshot",
  "arguments": {}
}
```

---

## Safety Guardrails (Production Protection)

To prevent accidental deletions or unintended live broadcasts, two layers of safety middleware can be enabled:

### 1. Read-Only Mode (`OBS_READ_ONLY=true` or `--read-only`)
Blocks **all state-modifying requests** (e.g., scene switches, volume changes, creating/removing items, recording, streaming). Only inspection and status requests (`Get*`) are permitted:

```json
{
  "mcpServers": {
    "obs": {
      "command": "npx",
      "args": ["-y", "obs-mcp@latest", "--read-only"],
      "env": {
        "OBS_WEBSOCKET_PASSWORD": "<password_from_obs>"
      }
    }
  }
}
```

### 2. Destructive & Live-Broadcast Guardrail (`OBS_PROTECT_DESTRUCTIVE=true` or `--protect-destructive`)
Protects critical operations:
- `StartStream`
- `StopStream`
- `RemoveScene`
- `RemoveInput`
- `RemoveProfile`
- `SetCurrentSceneCollection`

When enabled, these actions will be blocked unless:
- The caller explicitly supplies `"confirm": true` in the tool arguments, OR
- `OBS_ALLOW_LIVE_STREAM=true` is set in the environment (applies to streaming actions).

Example:
```json
{
  "mcpServers": {
    "obs": {
      "command": "npx",
      "args": ["-y", "obs-mcp@latest", "--protect-destructive"],
      "env": {
        "OBS_WEBSOCKET_PASSWORD": "<password_from_obs>"
      }
    }
  }
}
```

---

## MCP Resources (Consolidated Snapshots)

Read-only resources provide immediate, comprehensive context to the AI assistant without requiring multiple tool calls:

| Resource URI | Description | Contents |
| :--- | :--- | :--- |
| `obs://state/summary` | Live broadcast & system status | Connection, OBS version, active program & preview scenes, streaming/recording status (timecode, bytes, duration), virtual cam, replay buffer, and CPU/FPS stats |
| `obs://scenes/current` | Active scenes & visual hierarchy | Program scene, preview scene, available scenes, and complete scene item list with transform matrices, visibility, lock states, and blend modes |
| `obs://audio/mixer` | Complete audio calibration | All inputs, volume levels (dB and multiplier), mute states, sync offsets, audio monitor types, and audio track routing (tracks 1-6) |
| `obs://events/recent` | Real-time event activity buffer | Last 100 OBS events captured in real-time with eventType, eventData, and ISO 8601 timestamps |

---

## MCP Prompts (Workflow Templates)

Structured prompts guide the AI assistant through standardized operational procedures:

| Prompt | Description | Key Workflow |
| :--- | :--- | :--- |
| `go-live-checklist` | Pre-stream sanity verification | Audits connection, stage readiness, audio levels, and stream output settings, and asks for final confirmation before starting broadcast |
| `recording-setup` | Local video recording setup | Validates record folder, canvas/output video resolutions, FPS, and multi-track audio isolation (e.g. separating mic vs desktop audio) |
| `emergency-brb` | Privacy lockdown & failsafe | Instantly mutes all microphone/auxiliary inputs, switches to a safe BRB scene, and pauses recording / adds chapter marker |
| `audio-check` | Comprehensive audio audit | Analyzes volume levels against broadcast standards (-12dB to -6dB voice, -24dB to -18dB background), audits mute states and lip-sync delays |

---

## Solving "Context Bloat"

Registering 156 separate tools can consume a large amount of an LLM's context window. You can optimize this using either **Dynamic Module Filtering** or **Compound Tools Mode**:

### Option 1: Dynamic Module Filtering (Selective Loading)
Load only the specific categories you need using the `--categories` CLI argument or the `OBS_MCP_MODULES` environment variable:

```json
{
  "mcpServers": {
    "obs": {
      "command": "npx",
      "args": ["-y", "obs-mcp@latest", "--categories=scenes,inputs,record"],
      "env": {
        "OBS_WEBSOCKET_PASSWORD": "<password_from_obs>"
      }
    }
  }
}
```

### Option 2: Compound Tools Mode (Maximum Context Efficiency)
In compound mode, operations are grouped into **12 consolidated tools** (e.g., `obs_manage_recording`, `obs_manage_scenes`, `obs_manage_inputs`, `obs_manage_general`) with action enums:

```json
{
  "mcpServers": {
    "obs": {
      "command": "npx",
      "args": ["-y", "obs-mcp@latest", "--compound"],
      "env": {
        "OBS_WEBSOCKET_PASSWORD": "<password_from_obs>"
      }
    }
  }
}
```

---

## Python Engine (`py_src/`)

A native Python server is included in `py_src/` with complete feature parity:
- Run with compound mode: `python py_src/obs-mcp.py --compound`
- Run with safety guardrails: `python py_src/obs-mcp.py --protect-destructive`
- Supports batch requests (`send_request_batch`), event circular ring buffer, and FastMCP resources (`obs://events/recent`).

---

## Usage

1. Make sure OBS Studio is running with WebSocket server enabled (**Tools > WebSocket Server Settings**).
2. Set your WebSocket password in your MCP client config or environment.
3. Configure your MCP client (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "obs": {
      "command": "npx",
      "args": ["-y", "obs-mcp@latest"],
      "env": {
        "OBS_WEBSOCKET_PASSWORD": "<password_from_obs>"
      }
    }
  }
}
```

---

## Environment Variables & CLI Flags

| Setting | Flag / Variable | Description |
| :--- | :--- | :--- |
| **WebSocket URL** | `OBS_WEBSOCKET_URL` | WebSocket URL (default: `ws://localhost:4455`) |
| **Password** | `OBS_WEBSOCKET_PASSWORD` | Password for OBS WebSocket authentication |
| **Read-Only** | `--read-only`, `OBS_READ_ONLY` | Prohibits all state modifications |
| **Protect Destructive**| `--protect-destructive`, `OBS_PROTECT_DESTRUCTIVE` | Blocks destructive/stream actions unless `confirm: true` is passed |
| **Allow Live Stream** | `--allow-live-stream`, `OBS_ALLOW_LIVE_STREAM` | Permits stream start/stop without confirmation |
| **Module Filter** | `--categories=<list>`, `OBS_MCP_MODULES` | Comma-separated list of categories to load |
| **Compound Mode** | `--compound`, `OBS_MCP_MODE=compound` | Enables consolidated compound tools |
| **Help** | `--help`, `-h` | Prints command line usage and options |

---

## License & Attribution

This project is licensed under the **GNU General Public License v2.0 (GPL-2.0)**. See the [LICENSE](LICENSE) file for the complete license terms and notices.

### Upstream Attribution & Acknowledgments
This project is an enhanced and architecturally expanded fork of [**obs-mcp**](https://github.com/royshil/obs-mcp), originally created by [Roy Shilkrot](https://github.com/royshil). We gratefully acknowledge Roy Shilkrot and contributors for creating the initial Model Context Protocol bridge for OBS Studio.

### Copyright Notices
- **Original Work**: Copyright (c) Roy Shilkrot ([https://github.com/royshil/obs-mcp](https://github.com/royshil/obs-mcp)), licensed under GPL-2.0.
- **Modifications and Expansions (2026)**: Copyright (c) Itznan ([https://github.com/itznan/obs-mcp](https://github.com/itznan/obs-mcp)), licensed under GPL-2.0.

### Key Enhancements Added in this Version
- **100% OBS WebSocket v5 Protocol Parity**: Closed the protocol gap, expanding granular tools from 127 to 156 requests (including scene item blend modes, group hierarchies, transform matrices, and locking controls).
- **Dynamic Tool Filtering**: Solves LLM context bloat via selective loading (`--categories` / `OBS_MCP_MODULES`).
- **Compound Tools Mode**: 12 consolidated tools (`--compound`) using action enums to optimize token usage.
- **Native Multimodal ImageContent**: Returns native MCP image content blocks for live vision model scene inspection.
- **Production Safety Guardrails**: Prohibits accidental deletions or unintended live streams via `OBS_READ_ONLY` and `OBS_PROTECT_DESTRUCTIVE`.
- **Consolidated MCP Resources & Workflow Prompts**: Read-only snapshots (`obs://state/summary`, `obs://scenes/current`, `obs://audio/mixer`, `obs://events/recent`) and standardized operational prompts.
- **Atomic Batch Macros**: Full support for OBS WebSocket v5 native `RequestBatch` (OpCode 8/9) with `haltOnFailure` and execution strategies (`SerialRealtime`, `SerialFrame`, `Parallel`).
- **Real-Time Event Ring Buffer**: Circular 100-event buffer capturing live OBS events with timestamps.
- **Complete Python Engine Parity**: Both TypeScript (`build/index.js`) and Python FastMCP (`py_src/`) engines share complete feature parity.
