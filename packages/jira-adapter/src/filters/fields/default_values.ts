/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { Change, compareSpecialValues, getChangeData, InstanceElement, isAdditionOrModificationChange, isObjectType, isRemovalChange, isRemovalOrModificationChange, ObjectType, Value } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { getParents, resolveChangeElement } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { getLookUpName } from '../../reference_mapping'
import { setDeploymentAnnotations } from '../../utils'

const EDITABLE_FIELD_NAMES = [
  'type',
  'optionId',
  'cascadingOptionId',
  'optionIds',
  'accountId',
  'userFilter',
  'accountIds',
  'groupId',
  'groupIds',
  'date',
  'useCurrent',
  'dateTime',
  'url',
  'projectId',
  'number',
  'labels',
  'text',
  'versionId',
  'versionOrder',
  'versionIds',
]

export const updateDefaultValues = async (
  contextChange: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(contextChange, getLookUpName)

  const beforeDefault = isRemovalOrModificationChange(resolvedChange)
    ? resolvedChange.data.before.value.defaultValue
    : undefined

  const afterDefault = isAdditionOrModificationChange(resolvedChange)
    ? resolvedChange.data.after.value.defaultValue
    : undefined

  if (isRemovalChange(contextChange)
      || _.isEqualWith(
        beforeDefault,
        afterDefault,
        compareSpecialValues
      )
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

  setDeploymentAnnotations(fieldContextType, 'defaultValue')

  EDITABLE_FIELD_NAMES.forEach((fieldName: string) => {
    if (fieldName in defaultValueType.fields) {
      setDeploymentAnnotations(defaultValueType, fieldName)
    }
  })
}
