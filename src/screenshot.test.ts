import { describe, it, expect, vi } from 'vitest';
import { formatScreenshotContent } from './screenshot-util.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OBSWebSocketClient } from './client.js';
import * as sources from './tools/sources.js';
import * as compound from './tools/compound.js';

describe('formatScreenshotContent (Multimodal Formatting)', () => {
  const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('strips data:image/png;base64 prefix and returns ImageContent', () => {
    const dataUri = `data:image/png;base64,${sampleBase64}`;
    const result = formatScreenshotContent(dataUri, 'Main Scene', 'png', 960);

    expect(result.length).toBe(2);
    // Text block
    expect(result[0].type).toBe('text');
    expect(result[0].text).toContain("Captured screenshot for 'Main Scene'");
    expect(result[0].text).toContain('960px width');

    // Image block
    expect(result[1].type).toBe('image');
    expect(result[1].data).toBe(sampleBase64);
    expect(result[1].mimeType).toBe('image/png');
  });

  it('handles raw Base64 without data URI prefix', () => {
    const result = formatScreenshotContent(sampleBase64, 'Webcam', 'jpeg', 640);

    expect(result.length).toBe(2);
    expect(result[1].type).toBe('image');
    expect(result[1].data).toBe(sampleBase64);
    expect(result[1].mimeType).toBe('image/jpeg');
  });

  it('normalizes jpg format to image/jpeg', () => {
    const result = formatScreenshotContent(sampleBase64, 'Game Capture', 'jpg', 960);
    expect(result[1].mimeType).toBe('image/jpeg');
  });
});

describe('Multimodal Screenshot Tools Integration', () => {
  const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('obs-get-source-screenshot returns native ImageContent and text summary', async () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    const client = new OBSWebSocketClient('ws://localhost:4455', null);

    vi.spyOn(client, 'isConnected').mockReturnValue(true);
    vi.spyOn(client, 'sendRequest').mockImplementation(async (req: string, params: any) => {
      if (req === 'GetCurrentProgramScene') {
        return { currentProgramSceneName: 'Live Gameplay' };
      }
      if (req === 'GetSourceScreenshot') {
        return {
          imageData: `data:image/png;base64,${mockBase64}`,
          imageWidth: params?.imageWidth || 960,
        };
      }
      return {};
    });

    const toolsMap: Record<string, Function> = {};
    vi.spyOn(server, 'tool').mockImplementation((name: string, _desc: any, _schema: any, cb: any) => {
      toolsMap[name] = cb;
      return {} as any;
    });

    await sources.initialize(server, client);

    const res = await toolsMap['obs-get-source-screenshot']({});
    expect(res.content.length).toBe(2);
    expect(res.content[0].type).toBe('text');
    expect(res.content[0].text).toContain('Live Gameplay');

    expect(res.content[1].type).toBe('image');
    expect(res.content[1].data).toBe(mockBase64);
    expect(res.content[1].mimeType).toBe('image/png');
  });

  it('obs_manage_sources compound tool returns native ImageContent for action: get_screenshot', async () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    const client = new OBSWebSocketClient('ws://localhost:4455', null);

    vi.spyOn(client, 'isConnected').mockReturnValue(true);
    vi.spyOn(client, 'sendRequest').mockImplementation(async (req: string, _params: any) => {
      if (req === 'GetSourceScreenshot') {
        return { imageData: mockBase64 };
      }
      return {};
    });

    const toolsMap: Record<string, Function> = {};
    vi.spyOn(server, 'tool').mockImplementation((name: string, _desc: any, _schema: any, cb: any) => {
      toolsMap[name] = cb;
      return {} as any;
    });

    await compound.initialize(server, client);

    const res = await toolsMap['obs_manage_sources']({
      action: 'get_screenshot',
      sourceName: 'Camera 1',
    });

    expect(res.content.length).toBe(2);
    expect(res.content[0].type).toBe('text');
    expect(res.content[0].text).toContain('Camera 1');

    expect(res.content[1].type).toBe('image');
    expect(res.content[1].data).toBe(mockBase64);
    expect(res.content[1].mimeType).toBe('image/png');
  });
});
