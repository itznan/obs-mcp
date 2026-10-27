import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OBSWebSocketClient, EventRingBuffer } from './client.js';
import { setSafetyConfig, SafetyViolationError } from './safety.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as general from './tools/general.js';
import * as compound from './tools/compound.js';
import { registerResources } from './resources.js';

describe('EventRingBuffer', () => {
  it('stores events and preserves order', () => {
    const ring = new EventRingBuffer(10);
    expect(ring.size()).toBe(0);

    ring.push({ eventType: 'CurrentProgramSceneChanged', eventData: { sceneName: 'Scene 1' } });
    ring.push({ eventType: 'InputMuteStateChanged', eventData: { inputName: 'Mic', inputMuted: true } });

    expect(ring.size()).toBe(2);
    const events = ring.toArray();
    expect(events.length).toBe(2);
    expect(events[0].eventType).toBe('CurrentProgramSceneChanged');
    expect(events[1].eventType).toBe('InputMuteStateChanged');
    expect(events[0].id).toBeDefined();
    expect(events[0].timestamp).toBeDefined();
  });

  it('overwrites oldest events when capacity is exceeded', () => {
    const ring = new EventRingBuffer(3);
    ring.push({ eventType: 'Event 1' });
    ring.push({ eventType: 'Event 2' });
    ring.push({ eventType: 'Event 3' });
    expect(ring.size()).toBe(3);

    // Overwrite Event 1
    ring.push({ eventType: 'Event 4' });
    expect(ring.size()).toBe(3);

    const items = ring.toArray();
    expect(items.map(e => e.eventType)).toEqual(['Event 2', 'Event 3', 'Event 4']);

    // Overwrite Event 2
    ring.push({ eventType: 'Event 5' });
    expect(ring.toArray().map(e => e.eventType)).toEqual(['Event 3', 'Event 4', 'Event 5']);
  });

  it('supports getRecent with limit and eventType filtering', () => {
    const ring = new EventRingBuffer(10);
    ring.push({ eventType: 'SceneItemEnableStateChanged' });
    ring.push({ eventType: 'StreamStateChanged' });
    ring.push({ eventType: 'CurrentProgramSceneChanged' });
    ring.push({ eventType: 'RecordStateChanged' });

    const sceneEvents = ring.getRecent(10, 'Scene');
    expect(sceneEvents.length).toBe(2);
    expect(sceneEvents[0].eventType).toBe('SceneItemEnableStateChanged');
    expect(sceneEvents[1].eventType).toBe('CurrentProgramSceneChanged');

    const last2 = ring.getRecent(2);
    expect(last2.length).toBe(2);
    expect(last2[0].eventType).toBe('CurrentProgramSceneChanged');
    expect(last2[1].eventType).toBe('RecordStateChanged');
  });

  it('clears all recorded events', () => {
    const ring = new EventRingBuffer(5);
    ring.push({ eventType: 'Event 1' });
    ring.push({ eventType: 'Event 2' });
    expect(ring.size()).toBe(2);

    ring.clear();
    expect(ring.size()).toBe(0);
    expect(ring.toArray()).toEqual([]);
  });
});

describe('Batch Requests & Safety Integration', () => {
  const client = new OBSWebSocketClient('ws://localhost:4455', null);

  beforeEach(() => {
    setSafetyConfig(null);
  });

  afterEach(() => {
    setSafetyConfig(null);
  });

  it('throws SafetyViolationError if batch contains state-modifying requests in OBS_READ_ONLY mode', async () => {
    setSafetyConfig({ readOnly: true });

    await expect(
      client.sendRequestBatch([
        { requestType: 'GetVersion' },
        { requestType: 'SetCurrentProgramScene', requestData: { sceneName: 'Gaming' } },
      ])
    ).rejects.toThrow(SafetyViolationError);
  });

  it('throws SafetyViolationError if batch contains unconfirmed destructive request under OBS_PROTECT_DESTRUCTIVE', async () => {
    setSafetyConfig({ protectDestructive: true });

    await expect(
      client.sendRequestBatch([
        { requestType: 'GetVersion' },
        { requestType: 'RemoveScene', requestData: { sceneName: 'OldScene' } },
      ])
    ).rejects.toThrow(SafetyViolationError);
  });

  it('allows batch destructive request when confirmed via item parameter', async () => {
    setSafetyConfig({ protectDestructive: true });

    (client as any).connected = true;
    (client as any).identified = true;
    let sentPayload: any = null;
    (client as any).ws = {
      send: (data: string) => {
        sentPayload = JSON.parse(data);
        setTimeout(() => {
          (client as any).handleMessage({
            op: 9, // RequestBatchResponse
            d: {
              requestId: sentPayload.d.requestId,
              results: [
                {
                  requestType: 'RemoveScene',
                  requestId: sentPayload.d.requests[0].requestId,
                  requestStatus: { result: true, code: 100 },
                  responseData: {}
                }
              ]
            }
          });
        }, 10);
      }
    };

    const result = await client.sendRequestBatch([
      { requestType: 'RemoveScene', requestData: { sceneName: 'OldScene', confirm: true } }
    ]);

    expect(result.results.length).toBe(1);
    expect(result.results[0].requestStatus.result).toBe(true);
    expect(sentPayload.d.requests[0].requestData.confirm).toBeUndefined();
  });

  it('allows batch destructive request when confirmed via batch options', async () => {
    setSafetyConfig({ protectDestructive: true });

    (client as any).connected = true;
    (client as any).identified = true;
    let sentPayload: any = null;
    (client as any).ws = {
      send: (data: string) => {
        sentPayload = JSON.parse(data);
        setTimeout(() => {
          (client as any).handleMessage({
            op: 9,
            d: {
              requestId: sentPayload.d.requestId,
              results: [
                {
                  requestType: 'StartStream',
                  requestId: sentPayload.d.requests[0].requestId,
                  requestStatus: { result: true, code: 100 },
                  responseData: {}
                }
              ]
            }
          });
        }, 10);
      }
    };

    const result = await client.sendRequestBatch(
      [{ requestType: 'StartStream' }],
      { confirm: true, executionType: 'SerialRealtime', haltOnFailure: true }
    );

    expect(result.results[0].requestType).toBe('StartStream');
    expect(sentPayload.d.haltOnFailure).toBe(true);
    expect(sentPayload.d.executionType).toBe(0);
  });
});

describe('Recent Events Client & Resource Integration', () => {
  const client = new OBSWebSocketClient('ws://localhost:4455', null);

  it('records incoming Event messages into client ring buffer', () => {
    client.clearRecentEvents();

    (client as any).handleMessage({
      op: 5,
      d: {
        eventType: 'CurrentProgramSceneChanged',
        eventIntent: 4,
        eventData: { sceneName: 'Live Gameplay' }
      }
    });

    (client as any).handleMessage({
      op: 5,
      d: {
        eventType: 'RecordStateChanged',
        eventIntent: 64,
        eventData: { outputActive: true, outputPath: '/videos/rec.mp4' }
      }
    });

    const recent = client.getRecentEvents();
    expect(recent.length).toBe(2);
    expect(recent[0].eventType).toBe('CurrentProgramSceneChanged');
    expect(recent[1].eventType).toBe('RecordStateChanged');
    expect(recent[1].eventData.outputPath).toBe('/videos/rec.mp4');
  });

  it('serves obs://events/recent MCP resource with captured events', async () => {
    const server = new McpServer({ name: 'test-events', version: '1.0.0' });
    const registered: Record<string, { uri: string; callback: Function }> = {};
    vi.spyOn(server, 'registerResource').mockImplementation((_name: string, uri: string, _config: any, cb: any) => {
      registered[uri] = { uri, callback: cb };
      return {} as any;
    });

    registerResources(server, client);

    expect(registered['obs://events/recent']).toBeDefined();

    const response = await registered['obs://events/recent'].callback(new URL('obs://events/recent'));
    expect(response.contents).toHaveLength(1);
    expect(response.contents[0].mimeType).toBe('application/json');

    const parsed = JSON.parse(response.contents[0].text);
    expect(parsed.totalCaptured).toBe(2);
    expect(parsed.events.length).toBe(2);
  });
});
