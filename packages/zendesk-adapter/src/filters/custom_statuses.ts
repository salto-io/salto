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
import {
  BuiltinTypes,
  Change, DeployResult,
  Element, ElemID,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  CUSTOM_STATUS_TYPE_NAME,
  DEFAULT_CUSTOM_STATUSES_TYPE_NAME, HOLD_CATEGORY, OPEN_CATEGORY,
  PENDING_CATEGORY,
  SOLVED_CATEGORY,
  ZENDESK,
} from '../constants'
import { deployChange, deployChanges } from '../deployment'

const { RECORDS_PATH } = elementsUtils
const log = logger(module)

/**
 * since end_user_label and agent_label must be in deploy and only the raw fields appear in the nacl, the values of the
 * non-raw fields need to be updated to have the same value of the raw fields.
 */
const alignNonRawWithRaw = (change: Change<InstanceElement>): void => {
  const { value } = getChangeData(change)
  value.end_user_label = value.raw_end_user_label
  value.agent_label = value.raw_agent_label
  value.description = value.raw_description
  value.end_user_description = value.raw_end_user_description
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'customStatus',
  onFetch: async (elements: Element[]): Promise<void> => {
    const defaultCustomStatuses = elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
      .filter(inst => inst.value.default)

    const pending = defaultCustomStatuses.find(inst => inst.value.status_category === PENDING_CATEGORY)
    const solved = defaultCustomStatuses.find(inst => inst.value.status_category === SOLVED_CATEGORY)
    const open = defaultCustomStatuses.find(inst => inst.value.status_category === OPEN_CATEGORY)
    const hold = defaultCustomStatuses.find(inst => inst.value.status_category === HOLD_CATEGORY)

    if (pending === undefined || solved === undefined || open === undefined || hold === undefined) {
      log.error('could not find default status for one or more of the status categories')
      return
    }

    const defaultCustomStatusesType = new ObjectType(
      {
        elemID: new ElemID(ZENDESK, DEFAULT_CUSTOM_STATUSES_TYPE_NAME),
        fields: {
          [PENDING_CATEGORY]: { refType: BuiltinTypes.NUMBER },
          [SOLVED_CATEGORY]: { refType: BuiltinTypes.NUMBER },
          [OPEN_CATEGORY]: { refType: BuiltinTypes.NUMBER },
          [HOLD_CATEGORY]: { refType: BuiltinTypes.NUMBER },
        },
        isSettings: true,
        path: [ZENDESK, elementsUtils.TYPES_PATH, DEFAULT_CUSTOM_STATUSES_TYPE_NAME],
      }
    )

    const defaultCustomStatusesInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      defaultCustomStatusesType,
      {
        [PENDING_CATEGORY]: pending.value.id,
        [SOLVED_CATEGORY]: solved.value.id,
        [OPEN_CATEGORY]: open.value.id,
        [HOLD_CATEGORY]: hold.value.id,
      },
      [ZENDESK, RECORDS_PATH, DEFAULT_CUSTOM_STATUSES_TYPE_NAME, defaultCustomStatusesType.elemID.name],
    )
    elements.push(defaultCustomStatusesType, defaultCustomStatusesInstance)
  },
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
      .filter(isInstanceChange)
      .forEach(alignNonRawWithRaw)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [customStatusChanges, firstLeftoverChanges] = _.partition(
      changes,
      change => CUSTOM_STATUS_TYPE_NAME === getChangeData(change).elemID.typeName,
    )
    const CustomStatusesDeployResult = await deployChanges(
      customStatusChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions)
      }
    )
    const [defaultCustomStatusChanges, leftoverChanges] = _.partition(
      firstLeftoverChanges,
      change => DEFAULT_CUSTOM_STATUSES_TYPE_NAME === getChangeData(change).elemID.typeName,
    )
    if (_.isEmpty(defaultCustomStatusChanges)) {
      // since the custom statuses and the default are in different change groups
      return { deployResult: CustomStatusesDeployResult, leftoverChanges: firstLeftoverChanges }
    }
    const defaultCustomStatusChange = defaultCustomStatusChanges
      .map(getChangeData)
      .find(inst => DEFAULT_CUSTOM_STATUSES_TYPE_NAME === inst.elemID.typeName)
    const error = []
    if (defaultCustomStatusChange !== undefined) {
      const defaults = Object.values(defaultCustomStatusChange.value).toString()
      try {
        await client.put({
          url: '/api/v2/custom_status/default',
          data: { ids: defaults },
        })
      } catch (e) {
        error.push(new Error(e))
      }
    }
    const appliedChanges = _.isEmpty(error) ? defaultCustomStatusChanges : []
    const deployResult: DeployResult = {
      appliedChanges: CustomStatusesDeployResult.appliedChanges.concat(appliedChanges),
      errors: CustomStatusesDeployResult.errors.concat(error),
    }
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
