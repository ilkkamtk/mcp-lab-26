import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fetchData from '@/utils/fetchData';

if (!process.env.MCP_SERVER_URL) {
  throw new Error('MCP_SERVER_URL environment variable is required');
}

if (!process.env.OPENAI_PROXY_URL) {
  throw new Error('OPENAI_PROXY_URL environment variable is required');
}

// Minimal types for OpenAI chat completions
interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string; // for tool messages
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface FunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: FunctionTool[];
  tool_choice?: 'auto' | 'none';
}

interface ChatCompletionResponse {
  choices: {
    message: ChatMessage;
  }[];
}

export async function callMcpClient(
  prompt: string,
): Promise<{ answer: string; toolCalls: number }> {
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
    const openaiTools: FunctionTool[] = tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || 'No description',
        parameters: tool.inputSchema,
      },
    }));

    // Call OpenAI proxy
    const currentDateTime = new Date().toISOString();
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a calendar assistant that helps users manage their calendar events. You have access to tools to create new events and list existing events.

Current date and time: ${currentDateTime}

When users ask to:
- List or view events → use the listEvents tool
- Create, add, or schedule events → use the createEvent tool

Interpret relative dates and times:
- "next Wednesday" → calculate the next Wednesday from today
- "tomorrow" → tomorrow's date
- "at 17" or "5 PM" → 17:00 time
- "in Helsinki" → location "Helsinki"

Do not perform calculations yourself; let the tools handle date/time logic. After using tools, provide a final answer based only on the tool results, without assuming success.`,
      },
      { role: 'user', content: prompt },
    ];

    const maxRounds = 5;
    let round = 0;
    const toolCalls: string[] = [];

    while (round < maxRounds) {
      const requestBody: ChatCompletionRequest = {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        tools: openaiTools,
        tool_choice: 'auto',
      };

      const data: ChatCompletionResponse = await fetchData(
        `${process.env.OPENAI_PROXY_URL}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      const message = data.choices[0].message;
      messages.push(message);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        break;
      }

      for (const toolCall of message.tool_calls) {
        toolCalls.push(toolCall.function.name);

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (error) {
          // Invalid JSON, use empty args
          console.error(error);
          args = {};
        }

        const result = await client.callTool({
          name: toolCall.function.name,
          arguments: args,
        });

        const toolContent = (result.content as { text: string }[])
          .map((c) => c.text)
          .join('\n');

        messages.push({
          role: 'tool',
          content: toolContent,
          tool_call_id: toolCall.id,
        });
      }

      round++;
    }

    const finalMessage = messages[messages.length - 1];
    const answer = finalMessage.content || '';

    return { answer: answer.trim(), toolCalls: toolCalls.length };
  } finally {
    await transport.close();
  }
}
