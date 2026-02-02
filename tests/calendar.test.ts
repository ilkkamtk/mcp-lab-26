import { icsToJson } from './../src/utils/ics-to-json';
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  deleteEvent,
  getAuthenticatedClient,
  createEvent,
  listEvents,
  getEventByUrl,
} from '../src/calDav/calendarClient';

describe('CalDAV Client', () => {
  let eventUrl: string;

  it('should connect to the CalDAV server and fetch calendars', async () => {
    const client = await getAuthenticatedClient();
    const calendars = await client.fetchCalendars();
    expect(calendars.length).toBeGreaterThan(0);
  });

  it('should create a new calendar event', async () => {
    const title = 'Test Event';
    const start = new Date(Date.now() + 3600000); // 1 hour from now
    const end = new Date(Date.now() + 7200000); // 2 hours from now
    const description = 'This is a test event.';
    const location = 'Virtual';

    eventUrl = await createEvent({
      title,
      start,
      end,
      description,
      location,
    });
    expect(eventUrl).toContain('.ics');
  });

  it('should list calendar events', async () => {
    const events = await listEvents();
    events.forEach((event) => {
      const eventJson = icsToJson(event.data);
      console.log('lol', eventJson, event.data);
      expect(eventJson).toBeDefined();
    });
    expect(events.length).toBeGreaterThan(0);
  });

  it('should delete test event', async () => {
    const event = await getEventByUrl(eventUrl);
    await deleteEvent(event);
    // Verify deletion by attempting to fetch the event again
    const checkEvent = await getEventByUrl(eventUrl);
    expect(checkEvent.data).toBeUndefined();
  });

  it('should delete all events', async () => {
    const events = await listEvents();
    for (const event of events) {
      await deleteEvent(event);
    }
    const remainingEvents = await listEvents();
    expect(remainingEvents.length).toBe(0);
  });
});
