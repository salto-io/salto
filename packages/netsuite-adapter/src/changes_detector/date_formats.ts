/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import moment from 'moment-timezone'
import { ConfigRecord } from '../client/suiteapp_client/types'
import { DateRange } from './types'
import { getConfigRecordsFieldValue } from '../client/utils'

const log = logger(module)

export const SUITEQL_DATE_FORMAT = 'YYYY-MM-DD'
export const SUITEQL_TIME_FORMAT = 'HH:MI:SS'
export const TIMEZONE = 'TIMEZONE'
export const TIMEFORMAT = 'TIMEFORMAT'
export const DATEFORMAT = 'DATEFORMAT'
export type TimeZoneAndFormat = {
  timeZone?: string
  format?: string
}
const suiteQLDateFormatRegex = /(?<year>\d+)-(?<month>\d+)-(?<day>\d+) (?<hour>\d+):(?<minute>\d+):(?<second>\d+)/
const savedSearchDateFormatRegex = /(?<month>\d+)\/(?<day>\d+)\/(?<year>\d+) (?<hour>\d+):(?<minute>\d+) (?<ampm>\w+)/

export const toSuiteQLWhereDateString = (date: Date): string =>
  `TO_DATE('${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}', '${SUITEQL_DATE_FORMAT}')`

export const toSuiteQLSelectDateString = (param: string): string =>
  `TO_CHAR(${param}, '${SUITEQL_DATE_FORMAT} ${SUITEQL_TIME_FORMAT}')`

export const convertSuiteQLStringToDate = (rawDate: string, fallback: Date): Date => {
  const match = suiteQLDateFormatRegex.exec(rawDate)
  if (match === null || match.groups === undefined) {
    log.error(`Failed to parse SuiteQL date: ${rawDate}`)
    return fallback
  }
  return new Date(
    Date.UTC(
      parseInt(match.groups.year, 10),
      parseInt(match.groups.month, 10) - 1,
      parseInt(match.groups.day, 10),
      parseInt(match.groups.hour, 10),
      parseInt(match.groups.minute, 10),
      parseInt(match.groups.second, 10),
    ),
  )
}

const toSavedSearchWhereDateString = (date: Date, timeDateFormat: string): string =>
  moment(date).utc().format(timeDateFormat)

const parseHour = (groups: Record<string, string>): number => {
  const rawHour = parseInt(groups.hour, 10)
  if (groups.ampm === 'pm' && rawHour !== 12) {
    return rawHour + 12
  }

  if (groups.ampm === 'am' && rawHour === 12) {
    return 0
  }
  return rawHour
}

export const getTimeDateFormat = (configRecords: ConfigRecord[]): TimeZoneAndFormat => {
  const userPreferences = configRecords.find(configRecord => configRecord.configType === 'USER_PREFERENCES')
  const dateFormat = getConfigRecordsFieldValue(userPreferences, DATEFORMAT)
  const timeFormat = getConfigRecordsFieldValue(userPreferences, TIMEFORMAT)
  const timeZone = getConfigRecordsFieldValue(userPreferences, TIMEZONE)
  const format =
    _.isString(dateFormat) && _.isString(timeFormat)
      ? // replace 'Month' with 'MMMM' since moment.tz doesn't support the 'D Month, YYYY' netsuite date format
        [dateFormat.replace('Month', 'MMMM'), timeFormat.toLowerCase()].join(' ')
      : undefined
  return { timeZone: _.isString(timeZone) ? timeZone : undefined, format }
}

export const convertSavedSearchStringToDate = (rawDate: string, fallback: Date): Date => {
  const match = savedSearchDateFormatRegex.exec(rawDate)
  if (match === null || match.groups === undefined) {
    log.error(`Failed to parse Saved Search date: ${rawDate}`)
    return fallback
  }

  return new Date(
    Date.UTC(
      parseInt(match.groups.year, 10),
      parseInt(match.groups.month, 10) - 1,
      parseInt(match.groups.day, 10),
      parseHour(match.groups),
      parseInt(match.groups.minute, 10) + 1,
    ),
  )
}

export const createDateRange = (start: Date, end: Date, timeDateFormat: string): DateRange => ({
  start,
  end,
  toSuiteQLRange: () => {
    const endDate = new Date(end)
    endDate.setDate(endDate.getDate() + 1)
    return [toSuiteQLWhereDateString(start), toSuiteQLWhereDateString(endDate)]
  },
  toSavedSearchRange: () => {
    const endDate = new Date(end)
    endDate.setMinutes(endDate.getMinutes() + 1)
    return [toSavedSearchWhereDateString(start, timeDateFormat), toSavedSearchWhereDateString(endDate, timeDateFormat)]
  },
})
