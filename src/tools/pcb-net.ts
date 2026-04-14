import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerPcbNetTools(server: any, bridge: BridgeClient): void {
  // ── P2.2: 网络管理完善 ────────────────────────────────────────────────────
  // pcb_get_all_nets 已在 state.ts 中注册，此处添加补齐工具

  server.tool('pcb_get_net_length', '查询指定网络的总走线长度', {
    net: z.string().describe('网络名称'),
  }, async ({ net }: { net: string }) => {
    const data = await bridge.command('pcb_get_net_length', { net });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_highlight_net', '高亮显示指定网络', {
    net: z.string().describe('网络名称'),
  }, async ({ net }: { net: string }) => {
    const data = await bridge.command('pcb_highlight_net', { net });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_unhighlight_all', '取消所有网络的高亮', {}, async () => {
    const data = await bridge.command('pcb_unhighlight_all');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_select_net', '选中指定网络的所有图元', {
    net: z.string().describe('网络名称'),
  }, async ({ net }: { net: string }) => {
    const data = await bridge.command('pcb_select_net', { net });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_set_net_color', '设置网络高亮颜色', {
    net: z.string().describe('网络名称'),
    color: z.string().describe('颜色值，如 #FF0000 或 rgb(255,0,0)'),
  }, async ({ net, color }: { net: string; color: string }) => {
    const data = await bridge.command('pcb_set_net_color', { net, color });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_netlist_data', '获取 PCB 完整网表数据（元件-引脚-网络映射）', {}, async () => {
    const data = await bridge.command('pcb_get_netlist_data');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
