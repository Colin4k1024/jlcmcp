import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BridgeClient } from './bridge-client.js';
import { registerStateTools } from './tools/state.js';
import { registerComponentTools } from './tools/components.js';
import { registerRoutingTools } from './tools/routing.js';
import { registerCopperKeepoutTools } from './tools/copper-keepout.js';
import { registerSilkscreenTools } from './tools/silkscreen.js';
import { registerAdvancedTools } from './tools/advanced.js';
import { registerSchematicTools } from './tools/schematic.js';
import { registerAgentTools } from './tools/agent.js';
import { registerCalculatorTools } from './tools/calculators.js';
import { registerLayerTools } from './tools/layer.js';
import { registerManufactureTools } from './tools/manufacture.js';
import { registerProjectTools } from './tools/project.js';
import { registerPcbPrimitivesTools } from './tools/pcb-primitives.js';
import { registerPcbNetTools } from './tools/pcb-net.js';
import { registerPcbDrcTools } from './tools/pcb-drc.js';
import { registerPcbDocumentTools } from './tools/pcb-document.js';
import { registerLibraryTools } from './tools/library.js';
import { registerEditorTools } from './tools/editor.js';
import { registerSystemTools } from './tools/system.js';

async function main() {
  const bridge = new BridgeClient();

  const server = new McpServer({
    name: 'jlceda',
    version: '0.1.0',
  });

  // Register all tool groups
  registerStateTools(server, bridge);
  registerComponentTools(server, bridge);
  registerRoutingTools(server, bridge);
  registerCopperKeepoutTools(server, bridge);
  registerSilkscreenTools(server, bridge);
  registerAdvancedTools(server, bridge);
  registerSchematicTools(server, bridge);
  registerAgentTools(server, bridge);
  registerCalculatorTools(server);
  registerLayerTools(server, bridge);
  registerManufactureTools(server, bridge);
  registerProjectTools(server, bridge);
  registerPcbPrimitivesTools(server, bridge);
  registerPcbNetTools(server, bridge);
  registerPcbDrcTools(server, bridge);
  registerPcbDocumentTools(server, bridge);
  registerLibraryTools(server, bridge);
  registerEditorTools(server, bridge);
  registerSystemTools(server, bridge);

  // Connect bridge (lazy — will connect on first command)
  // Start MCP stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await bridge.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
