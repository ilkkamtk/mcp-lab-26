import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

if (!process.env.MCP_SERVER_URL) {
  throw new Error('MCP_SERVER_URL environment variable is required');
}

if (!process.env.OPENAI_PROXY_URL) {
  throw new Error('OPENAI_PROXY_URL environment variable is required');
}

export async function callMcpClient(
  prompt: string,
): Promise<{ answer: string; toolCalls: string[] }> {
  const transport = new StreamableHTTPClientTransport(
    new URL(process.env.MCP_SERVER_URL!),
  );

  const client = new Client({
    name: 'mcp-client',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);

    // List available tools
    const toolsResponse = await client.listTools();
    const tools = toolsResponse.tools;

    // Prepare tools for OpenAI
    const openaiTools = tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    // Call OpenAI proxy
    const openaiResponse = await fetch(process.env.OPENAI_PROXY_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Assuming the proxy supports model selection
        messages: [{ role: 'user', content: prompt }],
        tools: openaiTools,
        tool_choice: 'auto',
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI proxy error: ${openaiResponse.statusText}`);
    }

    const data = await openaiResponse.json();
    const message = data.choices[0].message;

    let answer = '';
    const toolCalls: string[] = [];

    if (message.content) {
      answer = message.content;
    }

    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        toolCalls.push(toolCall.function.name);

        const args = JSON.parse(toolCall.function.arguments);
        const result = await client.callTool({
          name: toolCall.function.name,
          arguments: args,
        });

        // Append tool result to answer
        answer +=
          (result.content as { text: string }[]).map((c) => c.text).join('\n') +
          '\n';
      }
    }

    return { answer: answer.trim(), toolCalls };
  } finally {
    await transport.close();
  }
}
