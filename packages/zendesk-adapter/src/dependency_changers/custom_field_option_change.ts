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
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isAdditionOrModificationChange,
  isRemovalOrModificationChange,
  DependencyChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import {
  isRelevantChange,
  RELEVANT_PARENT_AND_CHILD_TYPES,
  CHECKBOX_TYPE_NAME,
} from '../change_validators/duplicate_option_values'

const getRelevantValue = (instance: InstanceElement): string => {
  const instanceType = instance.elemID.typeName
  if (
    RELEVANT_PARENT_AND_CHILD_TYPES.some(types => types.parent === instanceType) &&
    instance.value.type === CHECKBOX_TYPE_NAME
  ) {
    return instance.value.tag
  }
  return instance.value.value
}

const getDependencies = (
  customFieldOptionChanges: { key: collections.set.SetId; change: Change<InstanceElement> }[],
): DependencyChange[] =>
  customFieldOptionChanges
    .map(({ change, key }) => {
      if (isRemovalOrModificationChange(change)) {
        const beforeValue = getRelevantValue(change.data.before)
        const instanceWithSameValue = customFieldOptionChanges.find(
          otherChange =>
            isAdditionOrModificationChange(otherChange.change) &&
            getRelevantValue(getChangeData(otherChange.change)) === beforeValue,
        )
        return instanceWithSameValue !== undefined ? dependencyChange('add', instanceWithSameValue.key, key) : undefined
      }
      return undefined
    })
    .filter(values.isDefined)

export const customFieldOptionDependencyChanger: DependencyChanger = async changes => {
  const relevantChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is { key: collections.set.SetId; change: Change<InstanceElement> } =>
      isInstanceChange(change.change),
    )
    .filter(({ change }) => isRelevantChange(change))

  return getDependencies(relevantChanges)
}
