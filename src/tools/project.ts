import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerProjectTools(server: any, bridge: BridgeClient): void {
  // ── P1.1: 项目管理 ─────────────────────────────────────────────────────────
  server.tool('project_get_info', '获取当前工程信息（名称、UUID、路径等）', {}, async () => {
    const data = await bridge.command('dmt_project_get_info');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('project_get_all', '获取所有工程的 UUID 列表', {}, async () => {
    const data = await bridge.command('dmt_project_get_all');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('project_create', '创建新工程', {
    name: z.string().describe('工程名称'),
    description: z.string().optional().describe('工程描述'),
  }, async ({ name, description }: { name: string; description?: string }) => {
    const data = await bridge.command('dmt_project_create', { name, description });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('project_open', '打开指定 UUID 的工程', {
    uuid: z.string().describe('工程 UUID'),
  }, async ({ uuid }: { uuid: string }) => {
    const data = await bridge.command('dmt_project_open', { uuid });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  // ── 原理图文档管理 ─────────────────────────────────────────────────────────
  server.tool('schematic_get_all', '获取所有原理图信息', {}, async () => {
    const data = await bridge.command('dmt_schematic_get_all');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('schematic_create_page', '在指定原理图中创建新页面', {
    schematicUuid: z.string().describe('原理图 UUID'),
    name: z.string().optional().describe('页面名称，默认 Sheet1'),
  }, async ({ schematicUuid, name }: { schematicUuid: string; name?: string }) => {
    const data = await bridge.command('dmt_schematic_create_page', { schematicUuid, name: name || 'Sheet1' });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('schematic_get_pages', '获取原理图所有页面信息', {
    schematicUuid: z.string().optional().describe('原理图 UUID（不填则获取当前）'),
  }, async ({ schematicUuid }: { schematicUuid?: string }) => {
    const data = await bridge.command('dmt_schematic_get_pages', { schematicUuid });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('board_get_all', '获取所有 PCB 板信息', {}, async () => {
    const data = await bridge.command('dmt_board_get_all');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
