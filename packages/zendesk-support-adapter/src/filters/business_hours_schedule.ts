/*
*                      Copyright 2021 Salto Labs Ltd.
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
  Change, getChangeElement, InstanceElement, isAdditionChange, isModificationChange, Values,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange } from '../deployment'
import { getZendeskError } from '../errors'
import ZendeskClient from '../client/client'

const BUSINESS_HOURS_SCHEDULE_TYPE_NAME = 'business_hours_schedule'

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
  if (isAdditionChange(change) && (getChangeElement(change).value.intervals !== undefined)) {
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
  const changedElement = getChangeElement(change)
  const { intervals } = changedElement.value
  if (shouldDeployIntervals(change) && isValidIntervals(intervals)) {
    try {
      await client.put({
        url: `/business_hours/schedules/${changedElement.value.id}/workweek`,
        data: { workweek: { intervals } },
      })
    } catch (e) {
      throw getZendeskError(`${changedElement.elemID.getFullName()}.intervals`, e)
    }
  }
}

/**
 * Deploys business hours schedules and their intervals
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [scheduleChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeElement(change).elemID.typeName === BUSINESS_HOURS_SCHEDULE_TYPE_NAME,
    )
    const result = await Promise.all(
      scheduleChanges.map(async change => {
        try {
          await deployChange(change, client, config.apiDefinitions)
          await deployIntervals(client, change)
          return change
        } catch (err) {
          if (!_.isError(err)) {
            throw err
          }
          return err
        }
      })
    )

    const [errors, appliedChanges] = _.partition(result, _.isError)
    return {
      deployResult: { appliedChanges, errors },
      leftoverChanges,
    }
  },
})

export default filterCreator
