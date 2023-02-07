/*
*                      Copyright 2023 Salto Labs Ltd.
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
import {
  Change, getChangeData, InstanceElement, isAdditionChange, isModificationChange, Values,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { getZendeskError } from '../errors'
import ZendeskClient from '../client/client'

const BUSINESS_HOURS_SCHEDULE_TYPE_NAME = 'business_hours_schedule'

const log = logger(module)

type Interval = {
  // eslint-disable-next-line camelcase
  end_time: string
  // eslint-disable-next-line camelcase
  start_time: string
}

const isValidIntervals = (intervals: Values[]): intervals is Interval[] => (
  _.isArray(intervals)
    && _.every(
      intervals,
      interval => _.isPlainObject(interval) && ('end_time' in interval) && ('start_time' in interval)
    )
)

const shouldDeployIntervals = (change: Change<InstanceElement>): boolean => {
  if (isAdditionChange(change) && (getChangeData(change).value.intervals !== undefined)) {
    return true
  }
  if (isModificationChange(change)
    && (!_.isEqual(change.data.before.value.intervals, change.data.after.value.intervals))) {
    return true
  }
  return false
}

const deployIntervals = async (client: ZendeskClient, change: Change<InstanceElement>):
Promise<void> => {
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
        throw getZendeskError(changedElement.elemID.createNestedID('intervals'), e)
      }
    } else {
      log.error(`Failed to deploy intervals on ${changedElement.elemID.getFullName()} since the intervals were in invalid format`)
    }
  }
}

/**
 * Deploys business hours schedules and their intervals
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'businessHoursScheduleFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [scheduleChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === BUSINESS_HOURS_SCHEDULE_TYPE_NAME,
    )
    const deployResult = await deployChanges(
      scheduleChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions, ['holidays'])
        await deployIntervals(client, change)
      }
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
