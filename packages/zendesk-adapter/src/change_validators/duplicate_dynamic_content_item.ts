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
import {
  Change,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

const isRelevantChange = (change: Change<InstanceElement>): boolean => {
  const instance = getChangeData(change)
  return instance.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME
}

export const duplicateDynamicContentItemValidator: ChangeValidator = async (changes, elementSource) => {
  const relevantChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(isRelevantChange)
  if (_.isEmpty(relevantChanges) || elementSource === undefined) {
    return []
  }
  const relevantInstances = await getInstancesFromElementSource(elementSource, [DYNAMIC_CONTENT_ITEM_TYPE_NAME])
  return awu(relevantChanges)
    .map(async change => {
      const instance = getChangeData(change)
      const conflictedInstanceNames = relevantInstances
        .filter(relevantInstance => relevantInstance.value.name.toLowerCase() === instance.value.name.toLowerCase())
        .filter(relevantInstance => relevantInstance.elemID.getFullName() !== instance.elemID.getFullName())
        .map(relevantInstance => relevantInstance.elemID.getFullName())
      if (conflictedInstanceNames.length > 0) {
        return {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Cannot do this change since this dynamic content item name is already in use',
          detailedMessage: `The dynamic content item name '${instance.value.name}' is already used by the following elements:
${conflictedInstanceNames.join(', ')}. Please change the name of the dynamic content item and try again.`,
        }
      }
      return []
    })
    .flat()
    .toArray()
}
