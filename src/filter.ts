/**
 * Dynamic Tool Filtering & Configuration
 * 
 * Supports CLI flags:
 *   --categories=scenes,inputs,record
 *   --categories scenes,inputs,record
 *   --modules=scenes,inputs,record
 *   --modules scenes inputs record
 *   -c scenes,inputs,record
 *   --compound (loads consolidated compound tools)
 *   --mode=compound|granular|both
 * 
 * Supports Environment Variables:
 *   OBS_MCP_MODULES=scenes,inputs,record
 *   OBS_MCP_CATEGORIES=scenes,inputs,record
 *   OBS_MCP_MODE=compound|granular|both
 */

export const CANONICAL_CATEGORIES = [
  "general",
  "scenes",
  "sources",
  "scene-items",
  "streaming",
  "transitions",
  "config",
  "filters",
  "inputs",
  "media-inputs",
  "outputs",
  "record",
  "ui",
  "compound",
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

const CATEGORY_ALIASES: Record<string, CanonicalCategory> = {
  general: "general",
  scenes: "scenes",
  scene: "scenes",
  sources: "sources",
  source: "sources",
  "scene-items": "scene-items",
  scene_items: "scene-items",
  sceneitems: "scene-items",
  items: "scene-items",
  streaming: "streaming",
  stream: "streaming",
  transitions: "transitions",
  transition: "transitions",
  config: "config",
  configuration: "config",
  profiles: "config",
  filters: "filters",
  filter: "filters",
  inputs: "inputs",
  input: "inputs",
  audio: "inputs",
  "media-inputs": "media-inputs",
  media_inputs: "media-inputs",
  mediainputs: "media-inputs",
  media: "media-inputs",
  outputs: "outputs",
  output: "outputs",
  record: "record",
  recording: "record",
  ui: "ui",
  compound: "compound",
};

export interface ToolFilterOptions {
  categories: Set<CanonicalCategory> | null; // null means all
  mode: "granular" | "compound" | "both";
}

export function normalizeCategory(name: string): CanonicalCategory | null {
  const lower = name.trim().toLowerCase();
  return CATEGORY_ALIASES[lower] || null;
}

export function parseFilterOptions(argv: string[] = process.argv.slice(2)): ToolFilterOptions {
  let rawCategoryStrings: string[] = [];
  let mode: "granular" | "compound" | "both" = "granular";

  // Check Environment Variables first
  const envModules = process.env.OBS_MCP_MODULES || process.env.OBS_MCP_CATEGORIES;
  if (envModules) {
    rawCategoryStrings.push(...envModules.split(","));
  }

  const envMode = process.env.OBS_MCP_MODE?.toLowerCase();
  if (envMode === "compound" || envMode === "both" || envMode === "granular") {
    mode = envMode;
  }

  // Parse CLI args (takes precedence or extends)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--compound") {
      mode = "compound";
    } else if (arg.startsWith("--mode=")) {
      const val = arg.split("=")[1].toLowerCase();
      if (val === "compound" || val === "both" || val === "granular") {
        mode = val;
      }
    } else if (arg === "--mode" && i + 1 < argv.length) {
      const val = argv[++i].toLowerCase();
      if (val === "compound" || val === "both" || val === "granular") {
        mode = val;
      }
    } else if (arg.startsWith("--categories=") || arg.startsWith("--modules=")) {
      const val = arg.split("=")[1];
      rawCategoryStrings.push(...val.split(","));
    } else if (arg === "--categories" || arg === "--modules" || arg === "-c") {
      // Collect subsequent non-flag arguments
      while (i + 1 < argv.length && !argv[i + 1].startsWith("-")) {
        const nextArg = argv[++i];
        rawCategoryStrings.push(...nextArg.split(","));
      }
    }
  }

  // Process category strings
  let categories: Set<CanonicalCategory> | null = null;
  if (rawCategoryStrings.length > 0) {
    categories = new Set<CanonicalCategory>();
    for (const raw of rawCategoryStrings) {
      const normalized = normalizeCategory(raw);
      if (normalized) {
        categories.add(normalized);
        if (normalized === "compound") {
          mode = "compound";
        }
      }
    }
  }

  // If compound mode is explicitly requested, make sure compound is active
  if (mode === "compound") {
    if (!categories) {
      categories = new Set<CanonicalCategory>(["compound"]);
    } else {
      categories.add("compound");
    }
  } else if (mode === "both") {
    if (categories) {
      categories.add("compound");
    }
  }

  return {
    categories,
    mode,
  };
}

export function isCategoryEnabled(
  category: CanonicalCategory,
  options: ToolFilterOptions
): boolean {
  // If compound category:
  if (category === "compound") {
    return options.mode === "compound" || options.mode === "both" || (options.categories?.has("compound") ?? false);
  }

  // If in pure compound mode without "both", regular granular categories are disabled unless explicitly selected
  if (options.mode === "compound" && (!options.categories || !options.categories.has(category))) {
    return false;
  }

  // If specific categories are configured, check membership
  if (options.categories !== null) {
    return options.categories.has(category);
  }

  // Default: all granular categories enabled
  return true;
}
