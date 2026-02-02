import { DateTime } from 'luxon';

export type ICalInput = {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  uid?: string;
  domain?: string;
};

/**
 * Escape special characters for iCal (RFC 5545) text values.
 * - Backslash, comma, semicolon are escaped with backslash
 * - Newlines are converted to literal \n
 */
const escapeText = (str: string): string =>
  str.replace(/[\\,;]/g, (match) => `\\${match}`).replace(/\n/g, '\\n');

/**
 * Format a Date as iCal local timestamp (TZID=timezone:YYYYMMDDTHHMMSS).
 */
const toCalDav = (date: Date): string => {
  // Always output UTC time
  return DateTime.fromJSDate(date).toUTC().toFormat("yyyyMMdd'T'HHmmss");
};

/**
 * Generate an iCal formatted string from the given input.
 *
 * @param input object containing event details
 * @returns iCal formatted string
 *
 */

const generateICal = (input: ICalInput): string => {
  const {
    title,
    start,
    end,
    description,
    location,
    uid,
    domain = 'example-domain.com',
  } = input;

  const finalUid = uid || `${crypto.randomUUID()}@${domain}`;
  const now = toCalDav(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Standardized ICal Lib//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${finalUid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toCalDav(start)}`,
    `DTEND:${toCalDav(end)}`,
    `SUMMARY:${escapeText(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeText(description)}`);
  }
  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`);
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  // Join with CRLF as required by RFC 5545
  return lines.join('\r\n');
};

export { generateICal };
