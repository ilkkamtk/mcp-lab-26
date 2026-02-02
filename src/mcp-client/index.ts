import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fetchData from '@/utils/fetchData';

type OpenAiToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
};

type OpenAiChatResponse = {
  choices: Array<{
    message: OpenAiMessage;
  }>;
};

type OpenAiChatRequest = {
  model: string;
  messages: OpenAiMessage[];
  tools: ReturnType<typeof toOpenAiTools>;
  tool_choice: 'auto';
};

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

const toOpenAiTools = (tools: McpTool[]) =>
  tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? {},
    },
  }));

const toToolResultText = (
  content: Array<{ type: string } & Record<string, unknown>>,
) => {
  const textParts = content
    .filter((item) => item.type === 'text')
    .map((item) => String(item.text ?? ''))
    .filter((text) => text.length > 0);

  if (textParts.length > 0) {
    return textParts.join('\n');
  }

  return JSON.stringify(content);
};

const callOpenAiChat = async (
  baseUrl: string,
  model: string,
  messages: OpenAiMessage[],
  tools: ReturnType<typeof toOpenAiTools>,
): Promise<OpenAiChatResponse> => {
  const payload: OpenAiChatRequest = {
    model,
    messages,
    tools,
    tool_choice: 'auto',
  };

  return fetchData<OpenAiChatResponse>(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const runMcpClient = async (prompt: string) => {
  const mcpServerUrl = process.env.MCP_SERVER_URL;
  const openAiProxyUrl = process.env.OPENAI_PROXY_URL;
  if (!mcpServerUrl || !openAiProxyUrl) {
    throw new Error('env incomplete');
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const client = new Client({ name: 'mcp-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl));

  try {
    await client.connect(transport);

    const toolsResult = await client.listTools();
    const tools = toOpenAiTools(toolsResult.tools as McpTool[]);

    const systemPrompt = `
    You are a calendar assistant. Prefer MCP tools for all calendar actions.

    Tool usage:
    - If the user wants to list events, call listEvents.
    - If the user wants to create an event, call createEvent.

    Availability:
    - Always call listEvents to check availability before creating an event,
    unless the user explicitly allows overlaps.
    - If the time is unavailable, do not create the event.

    Time handling:
    - Interpret relative phrases such as “next Wednesday”, “tomorrow”, “at 17”, and locations like “in Helsinki”.
    - Do not perform date, time, or timezone calculations.
    - Do not localize or convert times.

    Time format rule:
    - If the user specifies a time (e.g. “at 17” or “17.00”),
    send the time to the tool exactly as YYYY-MM-DDT17:00:00Z.
    - Do not adjust the hour based on timezone or location.

    General rules:
    - Omit optional fields the user did not specify.
    - After MCP tool calls, your final response must be based only on tool output.

    `;

    const currentDateIso = new Date().toISOString();

    const messages: OpenAiMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'system',
        content: `Current date/time (ISO 8601): ${currentDateIso}`,
      },
      { role: 'user', content: prompt },
    ];

    const maxRounds = 6;
    let toolCallCount = 0;

    for (let round = 0; round < maxRounds; round += 1) {
      const response = await callOpenAiChat(
        openAiProxyUrl,
        model,
        messages,
        tools,
      );

      const assistantMessage = response.choices[0]?.message;
      const toolCalls = assistantMessage?.tool_calls ?? [];

      if (!assistantMessage || toolCalls.length === 0) {
        return {
          answer: assistantMessage?.content ?? '',
          toolCalls: toolCallCount,
        };
      }

      messages.push({
        role: 'assistant',
        content: assistantMessage.content ?? null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        let args: Record<string, unknown> = {};
        if (toolCall.function.arguments) {
          try {
            args = JSON.parse(toolCall.function.arguments) as Record<
              string,
              unknown
            >;
          } catch {
            args = {};
          }
        }

        const result = await client.callTool({
          name: toolCall.function.name,
          arguments: args,
        });

        toolCallCount += 1;

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toToolResultText(
            result.content as Array<{ type: string } & Record<string, unknown>>,
          ),
        });
      }
    }

    return {
      answer: 'Max tool-call rounds reached without completion.',
      toolCalls: toolCallCount,
    };
  } finally {
    try {
      await transport.close();
    } catch {
      // best-effort cleanup
    }
  }
};

export { runMcpClient };
