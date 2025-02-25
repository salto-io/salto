/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceElement,
  isModificationChange,
  Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { getZendeskError } from '../errors'
import ZendeskClient from '../client/client'
import { BUSINESS_HOUR_SCHEDULE_HOLIDAY } from '../constants'

const BUSINESS_HOURS_SCHEDULE_TYPE_NAME = 'business_hours_schedule'

const log = logger(module)

type Interval = {
  end_time: string
  start_time: string
}

const isValidIntervals = (intervals: Values[]): intervals is Interval[] =>
  _.isArray(intervals) &&
  _.every(intervals, interval => _.isPlainObject(interval) && 'end_time' in interval && 'start_time' in interval)

const shouldDeployIntervals = (change: Change<InstanceElement>): boolean => {
  if (isAdditionChange(change) && getChangeData(change).value.intervals !== undefined) {
    return true
  }
  if (
    isModificationChange(change) &&
    !_.isEqual(change.data.before.value.intervals, change.data.after.value.intervals)
  ) {
    return true
  }
  return false
}

const deployIntervals = async (client: ZendeskClient, change: Change<InstanceElement>): Promise<void> => {
  const changedElement = getChangeData(change)
  const { intervals } = changedElement.value
  if (shouldDeployIntervals(change)) {
    if (isValidIntervals(intervals)) {
      try {
        await client.put({
          url: `/api/v2/business_hours/schedules/${changedElement.value.id}/workweek`,
          data: { workweek: { intervals } },
        })
      } catch (e) {
        throw getZendeskError(changedElement.elemID.createNestedID('intervals'), e) // caught in deployChanges
      }
    } else {
      log.error(
        `Failed to deploy intervals on ${changedElement.elemID.getFullName()} since the intervals were in invalid format`,
      )
    }
  }
}

/**
 * Deploys business hours schedules and their intervals
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'businessHoursScheduleFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BUSINESS_HOUR_SCHEDULE_HOLIDAY)
      .forEach(holiday => {
        const startYear = holiday.value.start_date?.split('-')[0]
        const endYear = holiday.value.end_date?.split('-')[0]
        holiday.value.start_year = startYear
        holiday.value.end_year = endYear
      })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [scheduleChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BUSINESS_HOURS_SCHEDULE_TYPE_NAME,
    )
    const deployResult = await deployChanges(scheduleChanges, async change => {
      await deployChange({
        change,
        client,
        apiDefinitions: oldApiDefinitions,
        definitions,
        fieldsToIgnore: ['holidays'],
      })
      await deployIntervals(client, change)
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
