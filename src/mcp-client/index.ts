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
        content: `
You are a calendar assistant that converts natural language requests into structured calendar actions.

You have access to tools to:
- list existing events
- list events by date range
- create new events

Current date and time (UTC): ${currentDateTime}

General rules:
- NEVER convert times to UTC yourself.
- NEVER perform timezone arithmetic.
- Always return local date, local time, and an explicit IANA timezone.
- Your job is interpretation, not calculation.

Intent handling:
- If the user wants to view or list events → use listEvents
- If the user wants to view or list events in a specific date range → use listEventsByRange
- If the user wants to create, add, or schedule an event → use createEvent

Date interpretation rules:
- If the year is missing, choose the next future date.
- "today", "tomorrow", "next week", etc. are relative to the current date.
- If a date is ambiguous, make a reasonable assumption and proceed.

Time interpretation rules:
- "at 17", "kello 19", "7 pm" → interpret as local time.
- If no time is specified, do NOT invent one; omit the time field.

Location and timezone rules:
- If a city or country is mentioned, infer the IANA timezone.
- "Helsinki" → "Europe/Helsinki"
- Locations imply timezone, NOT UTC conversion.

Conditions:
- Phrases like "if there is nothing else" or "if free" should be captured as conditions, not ignored.

Output rules:
- Use tools when required.
- Tool arguments MUST strictly follow the schema.
- Do not add extra fields.
- Do not explain your reasoning.
- After tool execution, respond only based on the tool result.

If the request is ambiguous:
- Make reasonable assumptions.
- Do NOT ask the user follow-up questions.
`,
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

        console.log('args', args);

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
