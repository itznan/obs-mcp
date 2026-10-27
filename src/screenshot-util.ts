/**
 * Formats a raw Base64 screenshot from OBS WebSocket into native MCP Multimodal content:
 * - A descriptive text summary block
 * - A native MCP image content block ({ type: "image", data: base64Data, mimeType: "image/png" })
 */
export function formatScreenshotContent(
  imageData: string,
  sourceName?: string,
  imageFormat: string = "png",
  imageWidth: number = 960
): [
  { type: "text"; text: string },
  { type: "image"; data: string; mimeType: string }
] {
  let rawBase64 = imageData;
  let mimeType = `image/${imageFormat.toLowerCase()}`;
  if (mimeType === "image/jpg") {
    mimeType = "image/jpeg";
  }

  // Strip Data URI prefix if present (e.g. "data:image/png;base64,...")
  if (rawBase64.startsWith("data:")) {
    const match = rawBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      rawBase64 = match[2];
    } else {
      const commaIndex = rawBase64.indexOf(",");
      if (commaIndex !== -1) {
        rawBase64 = rawBase64.substring(commaIndex + 1);
      }
    }
  }

  return [
    {
      type: "text",
      text: `Captured screenshot for '${sourceName || "active scene"}' (${imageWidth}px width, ${mimeType}). Multimodal image payload attached for vision inspection.`,
    },
    {
      type: "image",
      data: rawBase64.trim(),
      mimeType,
    },
  ];
}
