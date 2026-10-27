/**
 * Safety Guardrails for OBS Studio MCP Server
 * 
 * Supports:
 * - OBS_READ_ONLY=true: Blocks all state-modifying requests
 * - OBS_PROTECT_DESTRUCTIVE=true: Blocks high-risk and broadcast requests unless
 *   confirm: true is provided or OBS_ALLOW_LIVE_STREAM=true is set
 */

export interface SafetyConfig {
  readOnly: boolean;
  protectDestructive: boolean;
  allowLiveStream: boolean;
}

export class SafetyViolationError extends Error {
  public readonly requestType: string;
  public readonly reason: "READ_ONLY" | "DESTRUCTIVE_UNCONFIRMED";

  constructor(message: string, requestType: string, reason: "READ_ONLY" | "DESTRUCTIVE_UNCONFIRMED") {
    super(message);
    this.name = "SafetyViolationError";
    this.requestType = requestType;
    this.reason = reason;
  }
}

/**
 * Destructive / Live-broadcast requests protected under OBS_PROTECT_DESTRUCTIVE
 */
export const DESTRUCTIVE_REQUESTS = new Set<string>([
  "StartStream",
  "StopStream",
  "RemoveScene",
  "RemoveInput",
  "RemoveProfile",
  "SetCurrentSceneCollection",
]);

/**
 * Determine if a request is read-only.
 * Any request beginning with 'Get' is read-only.
 */
export function isReadOnlyRequest(requestType: string): boolean {
  if (requestType.startsWith("Get")) {
    return true;
  }
  // Safe sleep request is non-destructive
  if (requestType === "Sleep") {
    return true;
  }
  return false;
}

let globalSafetyConfig: SafetyConfig | null = null;

function parseBooleanEnv(val: string | undefined): boolean {
  if (!val) return false;
  const lower = val.trim().toLowerCase();
  return lower === "true" || lower === "1" || lower === "yes";
}

export function getSafetyConfig(argv: string[] = process.argv.slice(2)): SafetyConfig {
  if (globalSafetyConfig) {
    return globalSafetyConfig;
  }

  let readOnly = parseBooleanEnv(process.env.OBS_READ_ONLY);
  let protectDestructive = parseBooleanEnv(process.env.OBS_PROTECT_DESTRUCTIVE);
  let allowLiveStream = parseBooleanEnv(process.env.OBS_ALLOW_LIVE_STREAM);

  for (const arg of argv) {
    if (arg === "--read-only") {
      readOnly = true;
    } else if (arg === "--protect-destructive") {
      protectDestructive = true;
    } else if (arg === "--allow-live-stream") {
      allowLiveStream = true;
    }
  }

  return {
    readOnly,
    protectDestructive,
    allowLiveStream,
  };
}

export function setSafetyConfig(config: Partial<SafetyConfig> | null): void {
  if (config === null) {
    globalSafetyConfig = null;
  } else {
    globalSafetyConfig = {
      readOnly: config.readOnly ?? false,
      protectDestructive: config.protectDestructive ?? false,
      allowLiveStream: config.allowLiveStream ?? false,
    };
  }
}

/**
 * Validate request against active safety guardrails.
 * Throws SafetyViolationError if blocked.
 */
export function validateSafety(
  requestType: string,
  isConfirmed: boolean = false,
  customConfig?: Partial<SafetyConfig>
): void {
  const config = customConfig
    ? { ...getSafetyConfig(), ...customConfig }
    : getSafetyConfig();

  // 1. Check Read-Only Guardrail
  if (config.readOnly && !isReadOnlyRequest(requestType)) {
    throw new SafetyViolationError(
      `Action blocked by safety policy: OBS_READ_ONLY mode is enabled. State-modifying request '${requestType}' is prohibited.`,
      requestType,
      "READ_ONLY"
    );
  }

  // 2. Check Destructive / Live Broadcast Guardrail
  if (config.protectDestructive && DESTRUCTIVE_REQUESTS.has(requestType)) {
    const isLiveStreamAction = requestType === "StartStream" || requestType === "StopStream";

    // If live streaming is explicitly allowed via environment, bypass stream confirmation
    if (isLiveStreamAction && config.allowLiveStream) {
      return;
    }

    // Otherwise, require explicit confirmation
    if (!isConfirmed) {
      const liveStreamHelp = isLiveStreamAction
        ? " or set OBS_ALLOW_LIVE_STREAM=true in the environment"
        : "";
      throw new SafetyViolationError(
        `Action blocked by safety policy: '${requestType}' is protected under OBS_PROTECT_DESTRUCTIVE. To execute this action, provide 'confirm: true' in the tool parameters${liveStreamHelp}.`,
        requestType,
        "DESTRUCTIVE_UNCONFIRMED"
      );
    }
  }
}
