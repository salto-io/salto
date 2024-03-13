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
import {
  ActionName,
  ElemID,
  InstanceElement,
  ModificationChange,
  ReadOnlyElementsSource,
  getChangeData,
} from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, resolvePath, setPath, transformElement, walkOnValue } from '@salto-io/adapter-utils'
import { OPERATION_TO_ANNOTATION } from './annotations'

export const filterUndeployableValues = async (
  instance: InstanceElement,
  action: ActionName,
  elementsSource?: ReadOnlyElementsSource,
): Promise<InstanceElement> =>
  transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    elementsSource,
    transformFunc: ({ value, field }) => {
      // The === false is because if the value is undefined, we don't want to filter it out
      if (field?.annotations[OPERATION_TO_ANNOTATION[action]] === false) {
        return undefined
      }
      return value
    },
  })

export const filterIgnoredValues = async (
  instance: InstanceElement,
  fieldsToIgnore: string[] | ((path: ElemID) => boolean),
  configFieldsToIgnore: string[] = [],
  elementsSource?: ReadOnlyElementsSource,
): Promise<InstanceElement> => {
  const filteredInstance = _.isFunction(fieldsToIgnore)
    ? await transformElement({
        element: instance,
        strict: false,
        allowEmpty: true,
        elementsSource,
        transformFunc: ({ value, path }) => {
          if (path !== undefined && fieldsToIgnore(path)) {
            return undefined
          }
          return value
        },
      })
    : instance

  filteredInstance.value = _.omit(filteredInstance.value, [
    ...configFieldsToIgnore,
    ...(Array.isArray(fieldsToIgnore) ? fieldsToIgnore : []),
  ])

  return filteredInstance
}

/**
 * Transform removed change values to null, for APIs that require explicit null values
 */
export const transformRemovedValuesToNull = (
  change: ModificationChange<InstanceElement>,
  applyToPath?: string[],
): ModificationChange<InstanceElement> => {
  const { before, after } = change.data
  const elemId = applyToPath
    ? getChangeData(change).elemID.createNestedID(...applyToPath)
    : getChangeData(change).elemID
  walkOnValue({
    elemId,
    value: resolvePath(before, elemId),
    func: ({ value, path }) => {
      const valueInAfter = resolvePath(after, path)
      if (valueInAfter === undefined) {
        if (!_.isPlainObject(value)) {
          setPath(after, path, null)
          return WALK_NEXT_STEP.SKIP
        }
        // if value is an object, we want to recurse into it to set all its values to null
        return WALK_NEXT_STEP.RECURSE
      }
      // Arrays are being skipped to avoid setting null to removed array elements
      if (Array.isArray(value)) {
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return change
}
