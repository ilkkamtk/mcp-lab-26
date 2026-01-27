import { generateICal, ICalInput } from '@/utils/ical-lib';
import { DAVClient, DAVObject } from 'tsdav';

const CALDAV_SERVER_URL =
  process.env.CALDAV_SERVER_URL ?? 'http://localhost:5232/';
const CALDAV_USERNAME = process.env.CALDAV_USERNAME ?? 'username';
const CALDAV_PASSWORD = process.env.CALDAV_PASSWORD ?? 'password';

// Singleton DAV client instance to reuse across calls
let clientPromise: Promise<DAVClient> | null = null;

const getAuthenticatedClient = () => {
  // If a login is already in progress or finished, return that same promise
  if (clientPromise) return clientPromise;

  // TODO: create clientPromise, it is an IIFE that creates
  // and logs in the client and returns the client, on error it resets clientPromise to null
  // see https://tsdav.vercel.app/docs/intro#basic-usage for reference
  clientPromise = (async () => {
    const client = new DAVClient({
      serverUrl: CALDAV_SERVER_URL,
      credentials: {
        username: CALDAV_USERNAME,
        password: CALDAV_PASSWORD,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    try {
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
  // TODO: use getAuthenticatedClient to get the client
  const client = await getAuthenticatedClient();
  // fetch the calendars for the user
  const calendars = await client.fetchCalendars();
  // if no calendars found, throw an error
  if (calendars.length === 0) {
    throw new Error('No calendars found');
  }
  // return the client and the first calendar found
  return { client, calendar: calendars[0] };
};

const createEvent = async (eventData: Omit<ICalInput, 'uid' | 'domain'>) => {
  // TODO: use getPrimaryCalendar to get the client and calendar
  // generate the iCal string using generateICal
  // create the calendar object using client.createCalendarObject
  // return the URL of the created event
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
