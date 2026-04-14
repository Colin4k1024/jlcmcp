import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerSchematicTools(server: any, bridge: BridgeClient) {
  server.tool('sch_get_state', '读取原理图状态', {}, async () => {
    const data = await bridge.command('get_schematic_state');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_get_netlist', '导出网表', {
    type: z.string().optional().describe('网表格式'),
  }, async ({ type }: { type?: string }) => {
    const params: Record<string, unknown> = {};
    if (type) params.type = type;
    const data = await bridge.command('get_netlist', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_run_drc', '运行原理图 DRC', {
    strict: z.boolean().optional().describe('是否严格模式'),
  }, async ({ strict }: { strict?: boolean }) => {
    const params: Record<string, unknown> = {};
    if (strict !== undefined) params.strict = strict;
    const data = await bridge.command('run_sch_drc', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_open_document', '切换到指定文档（原理图或 PCB）', {
    uuid: z.string().describe('文档 UUID'),
  }, async ({ uuid }: { uuid: string }) => {
    const data = await bridge.command('open_document', { uuid });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data ?? { success: true }, null, 2) }] };
  });

  // ── Schematic creation tools ────────────────────────────────────────────────

  server.tool('sch_explore_api', '探查 EDA 原理图 API 表面（调试用）', {
    prefix: z.string().optional().describe('探查的 EDA API 对象前缀，如 sch_PrimitiveComponent'),
  }, async ({ prefix }: { prefix?: string }) => {
    const data = await bridge.command('explore_eda_api', { prefix });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_search_library', '通过 LCSC 编号搜索 EDA 器件库', {
    lcsc: z.string().describe('LCSC 编号，如 C2913202'),
  }, async ({ lcsc }: { lcsc: string }) => {
    const data = await bridge.command('sch_search_library', { lcsc });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_create_component', '在原理图中放置元件', {
    lcsc: z.string().optional().describe('LCSC 编号（优先）'),
    libraryUuid: z.string().optional().describe('库 UUID（lcsc 不可用时使用）'),
    componentUuid: z.string().optional().describe('元件 UUID（lcsc 不可用时使用）'),
    x: z.number().describe('X 坐标（mil）'),
    y: z.number().describe('Y 坐标（mil）'),
    rotation: z.number().optional().describe('旋转角度，默认 0'),
  }, async (params: any) => {
    const data = await bridge.command('sch_create_component', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_create_wire', '在原理图中绘制导线', {
    x1: z.number().describe('起点 X（mil）'),
    y1: z.number().describe('起点 Y（mil）'),
    x2: z.number().describe('终点 X（mil）'),
    y2: z.number().describe('终点 Y（mil）'),
  }, async (params: any) => {
    const data = await bridge.command('sch_create_wire', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_create_net_label', '在原理图中添加网络标签', {
    x: z.number().describe('X 坐标（mil）'),
    y: z.number().describe('Y 坐标（mil）'),
    name: z.string().describe('网络名称，如 GND、3V3、VBAT'),
    rotation: z.number().optional().describe('旋转角度，默认 0'),
  }, async (params: any) => {
    const data = await bridge.command('sch_create_net_label', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_create_power_port', '在原理图中添加电源端口（VCC/GND 符号）', {
    x: z.number().describe('X 坐标（mil）'),
    y: z.number().describe('Y 坐标（mil）'),
    name: z.string().describe('电源名称，如 GND、3V3、VBAT、VBUS'),
    rotation: z.number().optional().describe('旋转角度，默认 0'),
  }, async (params: any) => {
    const data = await bridge.command('sch_create_power_port', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  // ── P0.1: 已有 bridge 动作的 MCP 工具注册 ─────────────────────────────────

  server.tool('sch_get_all_pins', '获取所有元件的引脚信息（含位置坐标）', {}, async () => {
    const data = await bridge.command('sch_get_all_pins');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_get_page_info', '获取原理图页面信息（当前页、所有页、原理图元数据）', {}, async () => {
    const data = await bridge.command('sch_page_info');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_save', '保存当前原理图', {}, async () => {
    const data = await bridge.command('sch_save');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_set_title_block', '修改原理图标题栏字段', {
    pageUuid: z.string().describe('原理图页面 UUID'),
    fields: z.record(z.string()).describe('标题栏字段，如 { Company: "xxx", Drawed: "xxx" }'),
  }, async ({ pageUuid, fields }: { pageUuid: string; fields: Record<string, string> }) => {
    const data = await bridge.command('sch_set_title_block', { pageUuid, fields });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_modify_component', '修改原理图元件位号', {
    primitiveId: z.string().describe('元件图元 ID'),
    designator: z.string().describe('新位号，如 R1, U2'),
  }, async ({ primitiveId, designator }: { primitiveId: string; designator: string }) => {
    const data = await bridge.command('sch_set_designator', { primitiveId, designator });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_delete_all_wires', '删除原理图中所有导线', {}, async () => {
    const data = await bridge.command('sch_delete_all_wires');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_auto_route', '原理图自动布线', {}, async () => {
    const data = await bridge.command('sch_auto_route');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_zoom_all', '缩放至显示所有原理图图元', {}, async () => {
    const data = await bridge.command('sch_zoom_all');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_navigate', '导航到原理图指定坐标或区域', {
    x: z.number().optional().describe('目标 X 坐标（mil），与 y 配合定点导航'),
    y: z.number().optional().describe('目标 Y 坐标（mil）'),
    x1: z.number().optional().describe('区域左上角 X（mil），与 y1/x2/y2 配合区域导航'),
    y1: z.number().optional().describe('区域左上角 Y（mil）'),
    x2: z.number().optional().describe('区域右下角 X（mil）'),
    y2: z.number().optional().describe('区域右下角 Y（mil）'),
  }, async (params: any) => {
    const data = await bridge.command('sch_navigate', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sch_get_primitive', '通过图元 ID 获取原理图图元详情', {
    primitiveId: z.string().describe('图元 ID'),
  }, async ({ primitiveId }: { primitiveId: string }) => {
    const data = await bridge.command('sch_get_primitive', { primitiveId });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('lib_device_lookup', '通过 LCSC 编号批量查询器件库详情', {
    lcsc: z.string().optional().describe('单个 LCSC 编号，如 C2913202'),
    lcscIds: z.array(z.string()).optional().describe('LCSC 编号数组，批量查询'),
  }, async ({ lcsc, lcscIds }: { lcsc?: string; lcscIds?: string[] }) => {
    const params: Record<string, unknown> = {};
    if (lcscIds) params.lcscIds = lcscIds;
    else if (lcsc) params.lcsc = lcsc;
    const data = await bridge.command('lib_device_lookup', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
