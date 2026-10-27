import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register structured MCP Prompts:
 * - go-live-checklist
 * - recording-setup
 * - emergency-brb
 * - audio-check
 */
export function registerPrompts(server: McpServer): void {
  // 1. go-live-checklist
  const goLiveHandler = async ({ targetScene, eventName }: { targetScene?: string; eventName?: string }) => {
    return {
      description: "Pre-stream verification checklist to validate OBS readiness before broadcasting",
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are the OBS Broadcast Director. Please execute the pre-stream "Go-Live Checklist" for broadcast "${eventName || "Live Stream"}" (Target Starting Scene: "${targetScene || "Starting Soon"}"):

1. **Connection & Health Check**: Read resource \`obs://state/summary\` to ensure OBS is connected, verify current FPS (aim for stable 60/30), check CPU usage, and confirm 0 dropped frames.
2. **Scene Setup**: Read resource \`obs://scenes/current\` to verify the program scene is properly staged. If not set to "${targetScene || "Starting Soon"}", offer to switch or preview it.
3. **Audio Mixer Verification**: Read resource \`obs://audio/mixer\` to confirm:
   - Primary microphone is UNMUTED and volume is calibrated between -12dB and -6dB.
   - Desktop/music audio is balanced between -24dB and -18dB.
   - Streaming audio track (Track 1) is assigned to the necessary inputs.
4. **Output Confirmation**: Check that recording/streaming output settings are clean.
5. **Final Sanity Confirmation**: Provide a structured summary table of the checks and explicitly ask the broadcaster for confirmation before triggering the stream via tool \`obs_manage_streaming\` (action: "start") or \`obs-start-stream\`.`,
          },
        },
      ],
    };
  };

  server.registerPrompt(
    "go-live-checklist",
    {
      title: "Go-Live Checklist",
      description: "Pre-stream checklist and automated sanity checks before going live",
      argsSchema: {
        targetScene: z.string().optional().describe("Intended starting scene (default: 'Starting Soon')"),
        eventName: z.string().optional().describe("Broadcast title or event description"),
      },
    },
    goLiveHandler
  );

  // 2. recording-setup
  const recordingSetupHandler = async ({ intendedScene, sessionTitle }: { intendedScene?: string; sessionTitle?: string }) => {
    return {
      description: "Local recording setup, multi-track audio validation, and video resolution checks",
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are the OBS Recording Engineer. Please perform the "Recording Setup & Validation" for session "${sessionTitle || "Local Recording"}" (Intended Scene: "${intendedScene || "Current Scene"}"):

1. **Storage & Settings**: Check the configured recording output directory using \`obs-get-record-directory\` (or \`obs_manage_config\`) and verify canvas/output video resolutions using \`obs-get-video-settings\`.
2. **Audio Track Isolation**: Read \`obs://audio/mixer\` to verify multi-track audio routing:
   - Ensure Microphone is routed to Track 1 (or dedicated track) for voice isolation.
   - Ensure Game/Desktop sound is routed to Track 2 (or dedicated track) to facilitate clean post-production editing.
3. **Visual Staging**: Read \`obs://scenes/current\` to check scene items, camera overlays, and ensure no unintended sources are disabled or hidden.
4. **Recording State**: Confirm recording is currently idle using \`obs://state/summary\`.
5. **Readiness Summary**: Output a concise preparation summary and offer to start the recording or insert opening chapter markers.`,
          },
        },
      ],
    };
  };

  server.registerPrompt(
    "recording-setup",
    {
      title: "Recording Setup",
      description: "Structured setup and validation workflow for local video recording",
      argsSchema: {
        intendedScene: z.string().optional().describe("Scene to record"),
        sessionTitle: z.string().optional().describe("Recording session title or topic"),
      },
    },
    recordingSetupHandler
  );

  // 3. emergency-brb
  const emergencyBrbHandler = async ({ brbScene, muteAllAudio }: { brbScene?: string; muteAllAudio?: string }) => {
    const shouldMute = muteAllAudio !== "false";
    return {
      description: "Immediate emergency privacy protocol: mute microphone inputs and switch to BRB scene",
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `EMERGENCY BROADCAST FAILSAFE TRIGGERED! Execute the following privacy and safeguard actions immediately:

1. **Mute Audio Immediately**: ${shouldMute ? "Mute all microphone, auxiliary, and headset inputs using tool `obs-set-input-mute` or `obs_manage_inputs` to ensure broadcaster privacy." : "Keep audio as-is."}
2. **Switch to Safe Scene**: Switch the current program scene immediately to "${brbScene || "BRB"}" (or "Be Right Back" / "Intermission") using tool \`obs-set-current-scene\` or \`obs_manage_scenes\`.
3. **Recording Protection**: Read \`obs://state/summary\` to see if recording is active. If recording is active, pause recording or insert a chapter marker "BRB Break" using \`obs-create-record-chapter\`.
4. **Privacy Status Confirmation**: Report to the user with a confirmation that privacy lockdown is active, listing which audio sources were muted and which scene is currently live on stream.`,
          },
        },
      ],
    };
  };

  server.registerPrompt(
    "emergency-brb",
    {
      title: "Emergency BRB",
      description: "Immediate emergency protocol: mute mic, switch to BRB scene, and protect recording",
      argsSchema: {
        brbScene: z.string().optional().describe("BRB scene name (default: 'BRB' or 'Be Right Back')"),
        muteAllAudio: z.string().optional().describe("Whether to mute microphone inputs ('true' or 'false', default: 'true')"),
      },
    },
    emergencyBrbHandler
  );

  // 4. audio-check
  const audioCheckHandler = async ({ targetInput }: { targetInput?: string }) => {
    return {
      description: "Complete audio diagnostic and calibration audit across all OBS audio sources",
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are the OBS Audio Engineer. Run a comprehensive "Audio Check" audit ${targetInput ? `specifically for input "${targetInput}"` : "across all active OBS audio sources"}:

1. **Mixer Snapshot**: Read the consolidated audio resource \`obs://audio/mixer\`.
2. **Mute & Signal Audit**: Check for unintended mute states (e.g. mic muted or desktop muted).
3. **Level Calibration**: Compare current volume dB settings against broadcast standards:
   - Voice / Host Dialogue: Peak target between -12dB and -6dB (comfortably in yellow zone).
   - Game / Desktop Audio: Peak target between -24dB and -18dB (ambient, below dialogue).
   - Alerts & Media: Target around -15dB.
4. **Sync & Latency Review**: Check sync offsets (especially on capture cards and webcams) to verify lip-sync timing.
5. **Routing & Monitor**: Check audio monitoring types (None, Monitor Only, Monitor & Output) to prevent echoes or missing stream audio.
6. **Diagnostic Report**: Present a clear Markdown audit table summarizing Input Name, Muted State, Volume (dB), Monitor Type, and Actionable Recommendations. Offer to adjust any miscalibrated inputs immediately.`,
          },
        },
      ],
    };
  };

  server.registerPrompt(
    "audio-check",
    {
      title: "Audio Check",
      description: "Comprehensive audio diagnostic and level calibration audit across all inputs",
      argsSchema: {
        targetInput: z.string().optional().describe("Specific input to check (audits all if omitted)"),
      },
    },
    audioCheckHandler
  );
}
