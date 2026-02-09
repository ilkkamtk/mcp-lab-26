import { z } from 'zod';
import {
  createEvent,
  getEventByUrl,
  listEvents,
  listEventsByDateRange,
} from '@/calDav/calendarClient';
import { icsToJson } from '@/utils/ics-to-json';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { toUtc } from '@/utils/ical-lib';

// tool schemas
const createEventInputSchema = z
  .object({
    title: z.string().min(1),

    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

    time: z
      .string()
      .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
      .describe('Local start time (HH:MM)'),

    endTime: z
      .string()
      .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .describe('Optional local end time (HH:MM)'),

    timezone: z.string().min(1),

    description: z.string().optional(),
    location: z.string().optional(),
  })
  .strict();

// input types
type CreateEventInput = z.infer<typeof createEventInputSchema>;

const listEventsByRangeInputSchema = z.object({
  start: z.string().describe('Start date and time as ISO 8601 string (e.g., 2026-02-10T00:00:00Z)'),
  end: z.string().describe('End date and time as ISO 8601 string (e.g., 2026-02-10T23:59:59Z)'),
});

type ListEventsByRangeInput = z.infer<typeof listEventsByRangeInputSchema>;

const mcpServer = new McpServer({
  name: 'calendar-server',
  version: '1.0.0',
});

mcpServer.registerTool(
  'createEvent',
  {
    title: 'Create a new Calendar Event',
    description:
      'Creates a new event in the calendar with the provided details.',
    inputSchema: createEventInputSchema,
  },
  async (input: CreateEventInput) => {
    const { title, date, time, endTime, timezone, description, location } =
      input;

    try {
      const startUtc = toUtc(date, time, timezone);

      const endUtc = endTime
        ? toUtc(date, endTime, timezone)
        : new Date(startUtc.getTime() + 60 * 60 * 1000); // default 1h

      if (endUtc <= startUtc) {
        throw new Error('Event end time must be after start time');
      }

      const eventUrl = await createEvent({
        start: startUtc,
        end: endUtc,
        title,
        description,
        location,
      });

      const newEvent = await getEventByUrl(eventUrl);
      const newEventObject = icsToJson(newEvent.data);

      if (!newEventObject[0]?.startDate || !newEventObject[0]?.endDate) {
        throw new Error('Event not created');
      }

      return {
        content: [
          {
            type: 'text',
            text: `Event created successfully for "${title}" from ${newEventObject[0].startDate} to ${newEventObject[0].endDate}.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to create event: ${(error as Error).message}`,
          },
        ],
      };
    }
  },
);

mcpServer.registerTool(
  'listEvents',
  {
    title: 'List Calendar Events',
    description:
      'Lists all events from CalDav calendar. Returns parsed event data including title, start/end times, location, and description as JSON. Example: [{"summary":"Meeting","startDate":"2024-10-01T10:00:00Z","endDate":"2024-10-01T11:00:00Z","location":"Office","description":"Discuss project status."}]',
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const rawEvents = await listEvents();
      const parsedEvents = rawEvents.map((event) => icsToJson(event.data));

      return {
        content: [
          {
            type: 'text',
            text: `Events retrieved successfully: ${JSON.stringify(parsedEvents)}`,
          },
        ],
      };
    } catch (error) {
      console.error('Error listing events:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list events: ${(error as Error).message}`,
          },
        ],
      };
    }
  },
);

mcpServer.registerTool(
  'listEventsByRange',
  {
    title: 'List Calendar Events by Date Range',
    description:
      'Lists events from the calendar within a specific date range. Provide start and end dates as ISO 8601 strings. Returns parsed event data including title, start/end times, location, and description as JSON.',
    inputSchema: listEventsByRangeInputSchema,
  },
  async (input: ListEventsByRangeInput) => {
    try {
      const { start, end } = input;
      const rawEvents = await listEventsByDateRange(new Date(start), new Date(end));
      const parsedEvents = rawEvents.map((event) => icsToJson(event.data));

      return {
        content: [
          {
            type: 'text',
            text: `Events in range retrieved successfully: ${JSON.stringify(parsedEvents)}`,
          },
        ],
      };
    } catch (error) {
      console.error('Error listing events by range:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list events by range: ${(error as Error).message}`,
          },
        ],
      };
    }
  },
);

export { mcpServer };
