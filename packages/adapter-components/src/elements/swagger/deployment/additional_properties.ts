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
  ActionName,
  Change,
  InstanceElement,
  isMapType,
  isObjectType,
  ObjectType,
  ReadOnlyElementsSource,
  Values,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData, transformElement } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { OPERATION_TO_ANNOTATION } from '../../../deployment/annotations'

const log = logger(module)

const removeAdditionalPropertiesFlat = async (
  values: Values,
  type: ObjectType,
  action: ActionName,
  elementsSource?: ReadOnlyElementsSource,
): Promise<void> => {
  const additionalPropertiesField = type.fields.additionalProperties
  if (additionalPropertiesField === undefined || !isMapType(await additionalPropertiesField.getType(elementsSource))) {
    return
  }

  const deploymentAnnotationValue = additionalPropertiesField.annotations[OPERATION_TO_ANNOTATION[action]]
  if (
    (deploymentAnnotationValue === true || deploymentAnnotationValue === undefined) &&
    values.additionalProperties !== undefined
  ) {
    const objectKeys = new Set(Object.keys(values))
    const commonKeys = Object.keys(values.additionalProperties).filter(key => objectKeys.has(key))
    if (commonKeys.length !== 0) {
      log.warn(
        `additional properties of type ${type.elemID.getFullName()} have common keys with the rest of the instance and will override them: ${commonKeys.join(', ')}`,
      )
    }
    _.assign(values, values.additionalProperties)
    delete values.additionalProperties
  }
}

/**
 * Remove the additional properties value we added on fetch in normalizeElementValues before deploy
 * and add its values to the top level values if deployable
 */
export const flattenAdditionalProperties = async (
  change: Change<InstanceElement>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<Change<InstanceElement>> =>
  applyFunctionToChangeData(change, async element =>
    transformElement({
      element,
      strict: false,
      allowEmpty: true,
      elementsSource,
      transformFunc: async ({ value, field, path }) => {
        const type = path?.isTopLevel() ? await element.getType(elementsSource) : await field?.getType(elementsSource)
        if (type !== undefined && isObjectType(type) && _.isPlainObject(value)) {
          await removeAdditionalPropertiesFlat(value, type, change.action, elementsSource)
        }

        return value
      },
    }),
  )
