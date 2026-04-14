import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerLibraryTools(server: any, bridge: BridgeClient): void {
  // ── P3.1: 元件库管理 ──────────────────────────────────────────────────────
  server.tool('lib_search_device', '搜索器件库（含封装/符号/3D模型）', {
    keyword: z.string().describe('搜索关键词（型号、描述等）'),
    limit: z.number().optional().default(20).describe('返回数量上限，默认 20'),
  }, async ({ keyword, limit }: { keyword: string; limit?: number }) => {
    const data = await bridge.command('lib_search_device', { keyword, limit: limit ?? 20 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_get_device', '通过 UUID 获取器件详情', {
    uuid: z.string().describe('器件 UUID'),
  }, async ({ uuid }: { uuid: string }) => {
    const data = await bridge.command('lib_get_device', { uuid });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_get_by_lcsc', '通过 LCSC 编号批量获取器件信息（含封装/符号）', {
    lcscIds: z.array(z.string()).describe('LCSC 编号列表'),
  }, async ({ lcscIds }: { lcscIds: string[] }) => {
    const data = await bridge.command('lib_get_by_lcsc', { lcscIds });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_search_footprint', '搜索封装库', {
    keyword: z.string().describe('搜索关键词'),
    limit: z.number().optional().default(20).describe('返回数量上限，默认 20'),
  }, async ({ keyword, limit }: { keyword: string; limit?: number }) => {
    const data = await bridge.command('lib_search_footprint', { keyword, limit: limit ?? 20 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_get_footprint', '通过 UUID 获取封装详情', {
    uuid: z.string().describe('封装 UUID'),
  }, async ({ uuid }: { uuid: string }) => {
    const data = await bridge.command('lib_get_footprint', { uuid });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_render_footprint', '获取封装渲染预览图（base64）', {
    uuid: z.string().describe('封装 UUID'),
  }, async ({ uuid }: { uuid: string }) => {
    const data = await bridge.command('lib_render_footprint', { uuid });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_search_symbol', '搜索原理图符号库', {
    keyword: z.string().describe('搜索关键词'),
    limit: z.number().optional().default(20).describe('返回数量上限，默认 20'),
  }, async ({ keyword, limit }: { keyword: string; limit?: number }) => {
    const data = await bridge.command('lib_search_symbol', { keyword, limit: limit ?? 20 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_get_symbol', '通过 UUID 获取符号详情', {
    uuid: z.string().describe('符号 UUID'),
  }, async ({ uuid }: { uuid: string }) => {
    const data = await bridge.command('lib_get_symbol', { uuid });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_render_symbol', '获取符号渲染预览图（base64）', {
    uuid: z.string().describe('符号 UUID'),
  }, async ({ uuid }: { uuid: string }) => {
    const data = await bridge.command('lib_render_symbol', { uuid });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_search_3dmodel', '搜索 3D 模型库', {
    keyword: z.string().describe('搜索关键词'),
    limit: z.number().optional().default(20).describe('返回数量上限，默认 20'),
  }, async ({ keyword, limit }: { keyword: string; limit?: number }) => {
    const data = await bridge.command('lib_search_3dmodel', { keyword, limit: limit ?? 20 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_get_libraries_list', '获取所有可用器件库列表', {}, async () => {
    const data = await bridge.command('lib_get_libraries_list');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_get_classification', '获取器件分类树（用于按类别浏览器件）', {}, async () => {
    const data = await bridge.command('lib_get_classification');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
