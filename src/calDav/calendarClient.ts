import { generateICal, ICalInput } from '@/utils/ical-lib';
import { DAVClient, DAVObject } from 'tsdav';

const CALDAV_SERVER_URL =
  process.env.CALDAV_SERVER_URL ?? 'http://localhost:5232/';
const CALDAV_USERNAME = process.env.CALDAV_USERNAME ?? 'username';
const CALDAV_PASSWORD = process.env.CALDAV_PASSWORD ?? 'password';

// Singleton DAV client instance to reuse across calls
let clientPromise: Promise<DAVClient> | null = null;

const getAuthenticatedClient = () => {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    try {
      const client = new DAVClient({
        serverUrl: CALDAV_SERVER_URL,
        credentials: {
          username: CALDAV_USERNAME,
          password: CALDAV_PASSWORD,
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
      });

      await client.login();
      return client;
    } catch (error) {
      clientPromise = null; // varmista, että epäonnistunut yritys nollataan
      throw error;
    }
  })();
  return clientPromise;
};

const getPrimaryCalendar = async () => {
  const client = await getAuthenticatedClient();
  const calendars = await client.fetchCalendars();
  if (calendars.length === 0) {
    throw new Error('No calendars found');
  }
  return { client, calendar: calendars[0] };
};

const createEvent = async (eventData: Omit<ICalInput, 'uid' | 'domain'>) => {
  const { client, calendar } = await getPrimaryCalendar();
  const iCalString = generateICal(eventData);
  const response = await client.createCalendarObject({
    calendar,
    filename: `${Date.now()}.ics`,
    iCalString,
  });
  return response.url;
};

const getEventByUrl = async (eventUrl: string) => {
  const { client, calendar } = await getPrimaryCalendar();
  const calendarObjects = await client.fetchCalendarObjects({
    calendar,
    objectUrls: [eventUrl],
  });
  if (calendarObjects.length === 0) {
    throw new Error('Event not found');
  }
  return calendarObjects[0];
};

const listEvents = async () => {
  const { client, calendar } = await getPrimaryCalendar();
  const calendarObjects = await client.fetchCalendarObjects({
    calendar,
  });
  return calendarObjects || [];
};

const listEventsByDateRange = async (startDate: Date, endDate: Date) => {
  const { client, calendar } = await getPrimaryCalendar();
  const calendarObjects = await client.fetchCalendarObjects({
    calendar,
    timeRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  });
  return calendarObjects || [];
};

const deleteEvent = async (calObj: DAVObject) => {
  const { client } = await getPrimaryCalendar();
  await client.deleteCalendarObject({
    calendarObject: calObj,
  });
  // handle errors appropriately
};

export {
  getAuthenticatedClient,
  getPrimaryCalendar,
  getEventByUrl,
  createEvent,
  listEvents,
  listEventsByDateRange,
  deleteEvent,
};
