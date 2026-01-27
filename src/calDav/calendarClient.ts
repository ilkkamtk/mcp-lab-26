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
  // TODO: use getPrimaryCalendar to get the client and calendar
  const { client, calendar } = await getPrimaryCalendar();
  // generate the iCal string using generateICal
  const iCalString = generateICal(eventData);
  // create the calendar object using client.createCalendarObject
  const response = await client.createCalendarObject({
    calendar,
    filename: `${Date.now()}.ics`,
    iCalString,
  });
  // return the URL of the created event
  return response.url;
};

const getEventByUrl = async (eventUrl: string) => {
  // TODO: use getPrimaryCalendar to get the client and calendar
  // fetch the calendar object using client.fetchCalendarObjects with the eventUrl
  // if no calendar object found, throw an error
  // return the found calendar object
};

const listEvents = async () => {
  // TODO: use getPrimaryCalendar to get the client and calendar
  // fetch all calendar objects using client.fetchCalendarObjects
  // return the list of events, or an empty array if none found
};

const deleteEvent = async (calObj: DAVObject) => {
  // TODO: get client like in other functions
  // delete the calendar object using client.deleteCalendarObject
  // handle errors appropriately
};

export {
  getAuthenticatedClient,
  getPrimaryCalendar,
  getEventByUrl,
  createEvent,
  listEvents,
  deleteEvent,
};
