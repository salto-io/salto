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
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isInstanceChange, isReferenceExpression,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { DEFAULT_CUSTOM_STATUSES_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)


const isValidDefault = async (inst: InstanceElement, elementSource: ReadOnlyElementsSource): Promise<boolean> => {
  const invalidKeys = await awu(Object.keys(inst.value))
    .filter(async key => {
      if (isReferenceExpression(inst.value[key])) {
        const statusInstance = await elementSource.get(inst.value[key].elemID)
        if (statusInstance === undefined) {
          log.error(`could not find status ${inst.value[key].elemID.getFullName()}`)
        }
        // it is invalid if the status is not active or it is not the right category
        return !statusInstance.value.active || !(statusInstance.value.status_category === key)
      }
      log.error(`the key ${key} in default_custom_statuses is not a reference expression`)
      return false
    }).toArray()

  return !_.isEmpty(invalidKeys) // if it is not empty then there is an invalid key
}

/**
 * this change validator checks that all default custom statuses are active and are default of the correct category
 */
export const defaultCustomStatusesValidator: ChangeValidator = async (
  changes, elementSource
) => {
  if (elementSource === undefined) {
    log.error('Failed to run defaultCustomStatusesValidator because no element source was provided')
    return []
  }

  const invalidDefault = await awu(changes)
    .filter(change => getChangeData(change).elemID.typeName === DEFAULT_CUSTOM_STATUSES_TYPE_NAME)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(inst => isValidDefault(inst, elementSource))
    .toArray()

  return invalidDefault
    .flatMap(instance => (
      [{
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Default custom statuses must be active and be defaults of the valid category',
        detailedMessage: 'Default custom statuses must be active and be defaults of the valid category',
      }]
    ))
}
