import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OBSWebSocketClient } from './client.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';

describe('MCP Resources', () => {
  it('registers all read-only resources without errors', () => {
    const server = new McpServer({ name: 'test-resources', version: '1.0.0' });
    const client = new OBSWebSocketClient('ws://localhost:4455', null);

    expect(() => registerResources(server, client)).not.toThrow();
  });

  it('generates expected snapshot content when client is connected', async () => {
    const server = new McpServer({ name: 'test-resources', version: '1.0.0' });
    const client = new OBSWebSocketClient('ws://localhost:4455', null);

    // Mock client.isConnected and client.sendRequest
    vi.spyOn(client, 'isConnected').mockReturnValue(true);
    vi.spyOn(client, 'sendRequest').mockImplementation(async (requestType: string, _params?: any) => {
      switch (requestType) {
        case 'GetVersion':
          return { obsVersion: '31.0.0', obsWebSocketVersion: '5.5.0', rpcVersion: 1 };
        case 'GetCurrentProgramScene':
          return { currentProgramSceneName: 'Live Game' };
        case 'GetCurrentPreviewScene':
          return { currentPreviewSceneName: 'BRB' };
        case 'GetStreamStatus':
          return { outputActive: true, outputTimecode: '01:23:45', outputDuration: 5025000, outputBytes: 987654321 };
        case 'GetRecordStatus':
          return { outputActive: false, outputPaused: false };
        case 'GetVirtualCamStatus':
          return { outputActive: true };
        case 'GetReplayBufferStatus':
          return { outputActive: true };
        case 'GetStats':
          return { cpuUsage: 3.5, memoryUsage: 650, activeFps: 60 };
        case 'GetSceneList':
          return { scenes: [{ sceneName: 'Live Game' }, { sceneName: 'BRB' }], currentProgramSceneName: 'Live Game' };
        case 'GetSceneItemList':
          return {
            sceneItems: [
              {
                sceneItemId: 1,
                sourceName: 'Game Capture',
                sceneItemEnabled: true,
                sceneItemLocked: true,
                sceneItemIndex: 0,
                sceneItemBlendMode: 'OBS_BLEND_NORMAL',
              },
            ],
          };
        case 'GetInputList':
          return { inputs: [{ inputName: 'Mic/Aux', inputKind: 'wasapi_input_capture' }] };
        case 'GetSpecialInputs':
          return { mic1: 'Mic/Aux' };
        case 'GetInputMute':
          return { inputMuted: false };
        case 'GetInputVolume':
          return { inputVolumeDb: -6.0, inputVolumeMul: 0.5 };
        case 'GetInputAudioBalance':
          return { inputAudioBalance: 0.5 };
        case 'GetInputAudioSyncOffset':
          return { inputAudioSyncOffset: 0 };
        case 'GetInputAudioMonitorType':
          return { monitorType: 'OBS_MONITORING_TYPE_NONE' };
        case 'GetInputAudioTracks':
          return { inputAudioTracks: { '1': true, '2': false } };
        default:
          return {};
      }
    });

    // Spy on registerResource
    const registered: Record<string, { uri: string; callback: Function }> = {};
    vi.spyOn(server, 'registerResource').mockImplementation((name: string, uri: string, _config: any, cb: any) => {
      registered[uri] = { uri, callback: cb };
      return {} as any;
    });

    registerResources(server, client);

    expect(registered['obs://state/summary']).toBeDefined();
    expect(registered['obs://scenes/current']).toBeDefined();
    expect(registered['obs://audio/mixer']).toBeDefined();

    // Verify obs://state/summary callback
    const summaryResult = await registered['obs://state/summary'].callback(new URL('obs://state/summary'));
    const summaryData = JSON.parse(summaryResult.contents[0].text);
    expect(summaryData.connection.connected).toBe(true);
    expect(summaryData.scenes.currentProgramScene).toBe('Live Game');
    expect(summaryData.streaming.outputActive).toBe(true);
    expect(summaryData.stats.activeFps).toBe(60);

    // Verify obs://scenes/current callback
    const scenesResult = await registered['obs://scenes/current'].callback(new URL('obs://scenes/current'));
    const scenesData = JSON.parse(scenesResult.contents[0].text);
    expect(scenesData.currentProgramScene).toBe('Live Game');
    expect(scenesData.items.length).toBe(1);
    expect(scenesData.items[0].sourceName).toBe('Game Capture');

    // Verify obs://audio/mixer callback
    const mixerResult = await registered['obs://audio/mixer'].callback(new URL('obs://audio/mixer'));
    const mixerData = JSON.parse(mixerResult.contents[0].text);
    expect(mixerData.inputs.length).toBe(1);
    expect(mixerData.inputs[0].inputName).toBe('Mic/Aux');
    expect(mixerData.inputs[0].muted).toBe(false);
    expect(mixerData.inputs[0].volumeDb).toBe(-6.0);
  });
});

describe('MCP Prompts', () => {
  it('registers all structured prompts and generates valid templates', async () => {
    const server = new McpServer({ name: 'test-prompts', version: '1.0.0' });

    const registeredPrompts: Record<string, { config: any; callback: Function }> = {};
    vi.spyOn(server, 'registerPrompt').mockImplementation((name: string, config: any, cb: any) => {
      registeredPrompts[name] = { config, callback: cb };
      return {} as any;
    });

    registerPrompts(server);

    expect(registeredPrompts['go-live-checklist']).toBeDefined();
    expect(registeredPrompts['recording-setup']).toBeDefined();
    expect(registeredPrompts['emergency-brb']).toBeDefined();
    expect(registeredPrompts['audio-check']).toBeDefined();

    // Test go-live-checklist prompt output
    const goLiveRes = await registeredPrompts['go-live-checklist'].callback({ targetScene: 'Intro' });
    expect(goLiveRes.messages[0].content.text).toContain('obs://state/summary');
    expect(goLiveRes.messages[0].content.text).toContain('Intro');

    // Test emergency-brb prompt output
    const brbRes = await registeredPrompts['emergency-brb'].callback({ brbScene: 'AFK' });
    expect(brbRes.messages[0].content.text).toContain('AFK');
    expect(brbRes.messages[0].content.text).toContain('Mute Audio Immediately');

    // Test audio-check prompt output
    const audioRes = await registeredPrompts['audio-check'].callback({});
    expect(audioRes.messages[0].content.text).toContain('obs://audio/mixer');
    expect(audioRes.messages[0].content.text).toContain('-12dB');
  });
});
