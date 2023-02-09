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

import { Change, CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionOrModificationChange, isEqualValues, isObjectType, isReferenceExpression, isRemovalChange, isRemovalOrModificationChange, ObjectType, ReadOnlyElementsSource, Value } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData, getParents, resolveChangeElement, resolvePath, resolveValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { getLookUpName } from '../../reference_mapping'
import { addAnnotationRecursively, setFieldDeploymentAnnotations } from '../../utils'


const resolveDefaultOption = (
  contextChange: Change<InstanceElement>,
): Promise<Change<InstanceElement>> =>
  applyFunctionToChangeData<Change<InstanceElement>>(
    contextChange,
    instance => {
      const clonedInstance = instance.clone();

      ['optionId', 'cascadingOptionId']
        .filter(fieldName => isReferenceExpression(clonedInstance.value.defaultValue?.[fieldName]))
        .forEach(fieldName => {
          // We resolve this values like this and not with resolveChangeElement
          // is because if we just created these options, the options under instance.value will
          // include the new option ids while the copied options under the references
          // resValues won't
          clonedInstance.value.defaultValue[fieldName] = resolvePath(
            clonedInstance,
            clonedInstance.value.defaultValue[fieldName].elemID
          ).id
        })
      return clonedInstance
    }
  )

export const updateDefaultValues = async (
  contextChange: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface,
  elementsSource?: ReadOnlyElementsSource,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(
    await resolveDefaultOption(contextChange),
    getLookUpName,
    resolveValues,
    elementsSource,
  )

  const beforeDefault = isRemovalOrModificationChange(resolvedChange)
    ? resolvedChange.data.before.value.defaultValue
    : undefined

  const afterDefault = isAdditionOrModificationChange(resolvedChange)
    ? resolvedChange.data.after.value.defaultValue
    : undefined

  if (isRemovalChange(contextChange)
      || isEqualValues(beforeDefault, afterDefault)
  ) {
    return
  }

  const defaultValueToUpdate = afterDefault ?? _.mapValues(
    beforeDefault,
    // The way to delete a default value is to set its values to null
    (value: Value, key: string) => (['contextId', 'type'].includes(key) ? value : null)
  )

  const contextInstance = getChangeData(resolvedChange)
  const parentId = getParents(contextInstance)[0].id

  await client.put({
    url: `/rest/api/3/field/${parentId}/context/defaultValue`,
    data: {
      defaultValues: [{
        ...defaultValueToUpdate,
        contextId: contextInstance.value.id,
      }],
    },
  })
}

export const setDefaultValueTypeDeploymentAnnotations = async (
  fieldContextType: ObjectType,
): Promise<void> => {
  const defaultValueType = await fieldContextType.fields.defaultValue?.getType()
  if (!isObjectType(defaultValueType)) {
    throw new Error(`type ${defaultValueType.elemID.getFullName()} of ${fieldContextType.fields.defaultValue?.elemID.getFullName()} is not an object type`)
  }

  setFieldDeploymentAnnotations(fieldContextType, 'defaultValue')
  await addAnnotationRecursively(defaultValueType, CORE_ANNOTATIONS.CREATABLE)
  await addAnnotationRecursively(defaultValueType, CORE_ANNOTATIONS.UPDATABLE)
}
