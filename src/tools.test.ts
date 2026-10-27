import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as tools from './tools/index.js';
import { OBSWebSocketClient } from './client.js';
import { parseFilterOptions, isCategoryEnabled, normalizeCategory } from './filter.js';

describe('Tools Registration & Dynamic Filtering', () => {
  const client = new OBSWebSocketClient('ws://localhost:4455', null);

  it('registers all default granular tools without errors', async () => {
    const server = new McpServer({ name: 'obs-mcp-test', version: '1.0.0' });
    await expect(tools.initialize(server, client)).resolves.not.toThrow();
  });

  it('registers only filtered categories when specified', async () => {
    const server = new McpServer({ name: 'obs-mcp-test', version: '1.0.0' });
    const options = {
      categories: new Set<'scenes' | 'record'>(['scenes', 'record']),
      mode: 'granular' as const,
    };
    await expect(tools.initialize(server, client, options)).resolves.not.toThrow();
  });

  it('registers compound tools when compound mode is active', async () => {
    const server = new McpServer({ name: 'obs-mcp-test', version: '1.0.0' });
    const options = {
      categories: new Set<'compound'>(['compound']),
      mode: 'compound' as const,
    };
    await expect(tools.initialize(server, client, options)).resolves.not.toThrow();
  });
});

describe('Filter Options Parser', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OBS_MCP_MODULES;
    delete process.env.OBS_MCP_CATEGORIES;
    delete process.env.OBS_MCP_MODE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('parses --categories=scenes,inputs,record', () => {
    const options = parseFilterOptions(['--categories=scenes,inputs,record']);
    expect(options.categories).not.toBeNull();
    expect(options.categories?.has('scenes')).toBe(true);
    expect(options.categories?.has('inputs')).toBe(true);
    expect(options.categories?.has('record')).toBe(true);
    expect(options.categories?.has('streaming')).toBe(false);
  });

  it('parses --modules flag with separate arguments', () => {
    const options = parseFilterOptions(['--modules', 'scenes', 'record']);
    expect(options.categories?.has('scenes')).toBe(true);
    expect(options.categories?.has('record')).toBe(true);
  });

  it('parses --compound flag', () => {
    const options = parseFilterOptions(['--compound']);
    expect(options.mode).toBe('compound');
    expect(isCategoryEnabled('compound', options)).toBe(true);
    expect(isCategoryEnabled('scenes', options)).toBe(false);
  });

  it('normalizes aliases correctly', () => {
    expect(normalizeCategory('scene_items')).toBe('scene-items');
    expect(normalizeCategory('sceneitems')).toBe('scene-items');
    expect(normalizeCategory('audio')).toBe('inputs');
    expect(normalizeCategory('stream')).toBe('streaming');
    expect(normalizeCategory('recording')).toBe('record');
  });

  it('reads OBS_MCP_MODULES environment variable', () => {
    process.env.OBS_MCP_MODULES = 'scenes,streaming';
    const options = parseFilterOptions([]);
    expect(options.categories?.has('scenes')).toBe(true);
    expect(options.categories?.has('streaming')).toBe(true);
    expect(options.categories?.has('record')).toBe(false);
  });

  it('reads OBS_MCP_MODE environment variable', () => {
    process.env.OBS_MCP_MODE = 'compound';
    const options = parseFilterOptions([]);
    expect(options.mode).toBe('compound');
    expect(isCategoryEnabled('compound', options)).toBe(true);
  });
});
