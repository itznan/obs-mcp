import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateSafety,
  setSafetyConfig,
  getSafetyConfig,
  SafetyViolationError,
  DESTRUCTIVE_REQUESTS,
  isReadOnlyRequest,
} from './safety.js';
import { OBSWebSocketClient } from './client.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as streaming from './tools/streaming.js';
import * as compound from './tools/compound.js';

describe('Safety Guardrails - Core Validation', () => {
  beforeEach(() => {
    setSafetyConfig(null);
  });

  afterEach(() => {
    setSafetyConfig(null);
  });

  it('correctly identifies read-only vs state-modifying requests', () => {
    expect(isReadOnlyRequest('GetVersion')).toBe(true);
    expect(isReadOnlyRequest('GetSceneList')).toBe(true);
    expect(isReadOnlyRequest('GetRecordStatus')).toBe(true);
    expect(isReadOnlyRequest('GetInputVolume')).toBe(true);
    expect(isReadOnlyRequest('Sleep')).toBe(true);

    expect(isReadOnlyRequest('StartStream')).toBe(false);
    expect(isReadOnlyRequest('StopRecord')).toBe(false);
    expect(isReadOnlyRequest('SetCurrentProgramScene')).toBe(false);
    expect(isReadOnlyRequest('RemoveScene')).toBe(false);
    expect(isReadOnlyRequest('SetInputMute')).toBe(false);
    expect(isReadOnlyRequest('CreateInput')).toBe(false);
  });

  describe('OBS_READ_ONLY Mode', () => {
    it('allows read-only requests when readOnly is enabled', () => {
      expect(() => validateSafety('GetVersion', false, { readOnly: true })).not.toThrow();
      expect(() => validateSafety('GetSceneList', false, { readOnly: true })).not.toThrow();
      expect(() => validateSafety('GetRecordStatus', false, { readOnly: true })).not.toThrow();
    });

    it('blocks all state-modifying requests when readOnly is enabled', () => {
      const modifyingRequests = [
        'StartStream',
        'StopStream',
        'StartRecord',
        'StopRecord',
        'SetCurrentProgramScene',
        'CreateScene',
        'RemoveScene',
        'SetInputMute',
        'SetInputVolume',
        'SetSceneItemTransform',
        'TriggerStudioModeTransition',
      ];

      for (const req of modifyingRequests) {
        expect(() => validateSafety(req, false, { readOnly: true })).toThrowError(SafetyViolationError);
      }
    });
  });

  describe('OBS_PROTECT_DESTRUCTIVE Mode', () => {
    it('blocks destructive actions if confirm is not provided', () => {
      for (const req of DESTRUCTIVE_REQUESTS) {
        expect(() =>
          validateSafety(req, false, { protectDestructive: true, allowLiveStream: false })
        ).toThrowError(SafetyViolationError);
      }
    });

    it('allows destructive actions when confirm: true is passed', () => {
      for (const req of DESTRUCTIVE_REQUESTS) {
        expect(() =>
          validateSafety(req, true, { protectDestructive: true, allowLiveStream: false })
        ).not.toThrow();
      }
    });

    it('allows StartStream and StopStream without confirm if allowLiveStream is true', () => {
      expect(() =>
        validateSafety('StartStream', false, { protectDestructive: true, allowLiveStream: true })
      ).not.toThrow();

      expect(() =>
        validateSafety('StopStream', false, { protectDestructive: true, allowLiveStream: true })
      ).not.toThrow();

      // But non-stream destructive actions still require confirm
      expect(() =>
        validateSafety('RemoveScene', false, { protectDestructive: true, allowLiveStream: true })
      ).toThrowError(SafetyViolationError);
    });

    it('allows non-destructive state changes without needing confirmation', () => {
      expect(() =>
        validateSafety('SetCurrentProgramScene', false, { protectDestructive: true })
      ).not.toThrow();
      expect(() =>
        validateSafety('SetInputMute', false, { protectDestructive: true })
      ).not.toThrow();
      expect(() =>
        validateSafety('StartRecord', false, { protectDestructive: true })
      ).not.toThrow();
    });
  });
});

describe('Safety Guardrails - OBSWebSocketClient Integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    setSafetyConfig(null);
    delete process.env.OBS_READ_ONLY;
    delete process.env.OBS_PROTECT_DESTRUCTIVE;
    delete process.env.OBS_ALLOW_LIVE_STREAM;
  });

  afterEach(() => {
    setSafetyConfig(null);
    process.env = { ...originalEnv };
  });

  it('rejects state modifications before sending when OBS_READ_ONLY is active', async () => {
    setSafetyConfig({ readOnly: true, protectDestructive: false, allowLiveStream: false });
    const client = new OBSWebSocketClient('ws://localhost:4455', null);

    await expect(
      client.sendRequest('SetCurrentProgramScene', { sceneName: 'Scene 2' })
    ).rejects.toThrow(SafetyViolationError);
  });

  it('rejects destructive requests when OBS_PROTECT_DESTRUCTIVE is active and confirm is missing', async () => {
    setSafetyConfig({ readOnly: false, protectDestructive: true, allowLiveStream: false });
    const client = new OBSWebSocketClient('ws://localhost:4455', null);

    await expect(client.sendRequest('StartStream')).rejects.toThrow(SafetyViolationError);
    await expect(client.sendRequest('RemoveScene', { sceneName: 'Main' })).rejects.toThrow(
      SafetyViolationError
    );
  });

  it('permits destructive requests when confirm: true is provided in requestData', async () => {
    setSafetyConfig({ readOnly: false, protectDestructive: true, allowLiveStream: false });
    const client = new OBSWebSocketClient('ws://localhost:4455', null);

    // Mock client connected status so it doesn't fail on WebSocket state check
    (client as any).connected = true;
    (client as any).identified = true;
    (client as any).ws = { send: vi.fn() };

    // With confirm: true, safety validation passes (it will send to ws.send)
    const promise = client.sendRequest('StartStream', { confirm: true });
    // It creates a pending request (times out or succeeds), meaning it bypassed safety check
    expect((client as any).ws.send).toHaveBeenCalled();
  });
});

describe('Safety Guardrails - Granular and Compound Tools Integration', () => {
  afterEach(() => {
    setSafetyConfig(null);
  });

  it('guards granular obs-start-stream tool when protectDestructive is active', async () => {
    setSafetyConfig({ readOnly: false, protectDestructive: true, allowLiveStream: false });
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    const client = new OBSWebSocketClient('ws://localhost:4455', null);

    const toolsMap: Record<string, Function> = {};
    vi.spyOn(server, 'tool').mockImplementation((name: string, _desc: any, _schema: any, cb: any) => {
      toolsMap[name] = cb;
      return {} as any;
    });

    await streaming.initialize(server, client);

    // Call obs-start-stream without confirm
    const resWithoutConfirm = await toolsMap['obs-start-stream']({});
    expect(resWithoutConfirm.isError).toBe(true);
    expect(resWithoutConfirm.content[0].text).toContain('Action blocked by safety policy');

    // Call obs-start-stream with confirm: true (safety passes, then fails on connection mock)
    const resWithConfirm = await toolsMap['obs-start-stream']({ confirm: true });
    expect(resWithConfirm.content[0].text).not.toContain('Action blocked by safety policy');
  });

  it('guards compound obs_manage_streaming tool when protectDestructive is active', async () => {
    setSafetyConfig({ readOnly: false, protectDestructive: true, allowLiveStream: false });
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    const client = new OBSWebSocketClient('ws://localhost:4455', null);

    const toolsMap: Record<string, Function> = {};
    vi.spyOn(server, 'tool').mockImplementation((name: string, _desc: any, _schema: any, cb: any) => {
      toolsMap[name] = cb;
      return {} as any;
    });

    await compound.initialize(server, client);

    // Call obs_manage_streaming action: 'start' without confirm
    const resWithoutConfirm = await toolsMap['obs_manage_streaming']({ action: 'start' });
    expect(resWithoutConfirm.isError).toBe(true);
    expect(resWithoutConfirm.content[0].text).toContain('Action blocked by safety policy');

    // Call obs_manage_streaming action: 'start' with confirm: true
    const resWithConfirm = await toolsMap['obs_manage_streaming']({ action: 'start', confirm: true });
    expect(resWithConfirm.content[0].text).not.toContain('Action blocked by safety policy');
  });
});
