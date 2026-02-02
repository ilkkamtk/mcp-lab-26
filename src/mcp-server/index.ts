import { z } from 'zod';
import { createEvent, getEventByUrl } from '@/calDav/calendarClient';
import { icsToJson } from '@/utils/ics-to-json';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// tool schemas
const createEventInputSchema = z.object({
  start: z.iso
    .datetime()
    .describe(
      'Start date and time of the event as ISO 8601 datetime (YYYY-MM-DDTHH:MM:SSZ) in UTC',
    ),
  end: z.iso
    .datetime()
    .optional()
    .describe(
      'End date and time of the event as ISO 8601 datetime (YYYY-MM-DDTHH:MM:SSZ) in UTC. If not provided, defaults to one hour after start time',
    ),
  title: z.string().describe('Short title of the event'),
  description: z.string().optional().describe('Optional detailed description'),
  location: z.string().optional().describe('Optional location of the event'),
});

// input types
type CreateEventInput = z.infer<typeof createEventInputSchema>;

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
    const { start, end, title, description, location } = input;
    const eventEnd = end
      ? new Date(end)
      : new Date(new Date(start).getTime() + 60 * 60 * 1000);
    try {
      const eventUrl = await createEvent({
        start: new Date(start),
        end: eventEnd,
        title,
        description,
        location,
      });
      const newEvent = await getEventByUrl(eventUrl);
      const newEventObject = icsToJson(newEvent.data);
      if (!newEventObject[0].startDate || !newEventObject[0].endDate) {
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
      console.error('Error creating event:', error);
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

export { mcpServer };
