import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerPcbDrcTools(server: any, bridge: BridgeClient): void {
  // ── P2.3: 高级 DRC 与规则管理 ─────────────────────────────────────────────
  server.tool('pcb_create_net_class', '创建网络类（定义一组网络的走线规则）', {
    name: z.string().describe('网络类名称'),
    clearance: z.number().optional().describe('间距规则（mil）'),
    traceWidth: z.number().optional().describe('走线宽度（mil）'),
    viaSize: z.number().optional().describe('过孔尺寸（mil）'),
    viaDrill: z.number().optional().describe('过孔钻孔（mil）'),
  }, async (params: { name: string; [key: string]: any }) => {
    const data = await bridge.command('pcb_create_net_class', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_all_net_classes', '获取所有网络类定义', {}, async () => {
    const data = await bridge.command('pcb_get_all_net_classes');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_add_net_to_class', '将网络加入指定网络类', {
    className: z.string().describe('网络类名称'),
    net: z.string().describe('网络名称'),
  }, async ({ className, net }: { className: string; net: string }) => {
    const data = await bridge.command('pcb_add_net_to_class', { className, net });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_rule_configs', '获取所有 DRC 规则配置', {}, async () => {
    const data = await bridge.command('pcb_get_rule_configs');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_set_rule_config', '设置 DRC 规则配置', {
    ruleType: z.string().describe('规则类型（如 clearance、traceWidth 等）'),
    value: z.number().describe('规则值（mil）'),
    netClass: z.string().optional().describe('适用的网络类名称（不填则应用全局）'),
  }, async (params: Record<string, any>) => {
    const data = await bridge.command('pcb_set_rule_config', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_rules', '导出 DRC 规则配置为文本', {}, async () => {
    const data = await bridge.command('pcb_export_rules');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_import_rules', '从文本导入 DRC 规则配置', {
    content: z.string().describe('规则配置文本内容'),
  }, async ({ content }: { content: string }) => {
    const data = await bridge.command('pcb_import_rules', { content });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_net_rules', '查询指定网络适用的 DRC 规则', {
    net: z.string().optional().describe('网络名称（不填则查全局默认规则）'),
  }, async ({ net }: { net?: string }) => {
    const params: Record<string, unknown> = {};
    if (net) params.net = net;
    const data = await bridge.command('pcb_get_net_rules', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_create_pad_pair_group', '创建焊盘对组（用于最短走线长度约束）', {
    name: z.string().describe('焊盘对组名称'),
    pairs: z.array(z.object({
      pad1: z.string().describe('焊盘 1 ID'),
      pad2: z.string().describe('焊盘 2 ID'),
    })).describe('焊盘对列表'),
  }, async ({ name, pairs }: { name: string; pairs: Array<{ pad1: string; pad2: string }> }) => {
    const data = await bridge.command('pcb_create_pad_pair_group', { name, pairs });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_pad_pair_min_wire', '获取焊盘对组的最短走线长度', {
    name: z.string().describe('焊盘对组名称'),
  }, async ({ name }: { name: string }) => {
    const data = await bridge.command('pcb_get_pad_pair_min_wire', { name });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
