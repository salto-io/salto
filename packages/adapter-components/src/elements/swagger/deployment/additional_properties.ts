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
import { ActionName, Change, InstanceElement, isObjectType, ObjectType, Values } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, transformElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { OPERATION_TO_ANNOTATION } from '../../../deployment/annotations'


const removeAdditionalPropertiesFlat = async (
  values: Values,
  type: ObjectType,
  action: ActionName
): Promise<void> => {
  const additionalPropertiesField = type.fields.additionalProperties
  if (additionalPropertiesField === undefined) {
    return
  }

  const deploymentAnnotationValue = additionalPropertiesField
    .annotations[OPERATION_TO_ANNOTATION[action]]
  if (deploymentAnnotationValue || deploymentAnnotationValue === undefined) {
    _.assign(values, values.additionalProperties ?? {})
  }
  delete values.additionalProperties
}

/**
 * Remove the additional properties value we added on fetch in normalizeElementValues before deploy
 * and adds the its values to to top level values if deployable
 */
export const flattenAdditionalProperties = async (change: Change<InstanceElement>)
: Promise<Change<InstanceElement>> =>
  applyFunctionToChangeData(
    change,
    async element =>
      transformElement({
        element,
        strict: false,
        allowEmpty: true,
        transformFunc: async ({ value, field, path }) => {
          const type = path?.isTopLevel() ? await element.getType() : await field?.getType()
          if (type !== undefined && isObjectType(type) && _.isPlainObject(value)) {
            await removeAdditionalPropertiesFlat(value, type, change.action)
          }

          return value
        },
      })
  )
