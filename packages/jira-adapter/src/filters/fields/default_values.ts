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

import { Change, compareSpecialValues, getChangeData, InstanceElement, isModificationChange, isObjectType, ObjectType, Value, Values } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { resolveChangeElement } from '@salto-io/adapter-utils'
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


const generateDefaultValuesList = (fieldInstance: InstanceElement): Values[] =>
  Object.values(fieldInstance.value.contexts ?? {})
    .filter((context: Value) => context.defaultValue !== undefined)
    .map((context: Value) => ({
      ...(context.defaultValue),
      contextId: context.id,
    }))

const mergeDefaultValueLists = (beforeList: Values[], afterList: Values[]): Values[] => {
  const afterIds = new Set(afterList.map(defaultValue => defaultValue.contextId))

  return [
    ...afterList,
    ...beforeList
      .filter(defaultValue => !afterIds.has(defaultValue.contextId))
      .map(defaultValue => _.mapValues(
        defaultValue,
        // The way to delete a default value is to set its values to null
        (value: Value, key: string) => (['contextId', 'type'].includes(key) ? value : null)
      )),
  ]
}

export const updateDefaultValues = async (
  fieldChange: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(fieldChange, getLookUpName)

  const fieldInstance = getChangeData(resolvedChange)

  const afterValues = generateDefaultValuesList(fieldInstance)
  const beforeValues = isModificationChange(resolvedChange)
    ? generateDefaultValuesList(resolvedChange.data.before)
    : []

  if (_.isEqualWith(beforeValues, afterValues, compareSpecialValues)) {
    return
  }

  const mergedValues = mergeDefaultValueLists(beforeValues, afterValues)

  const afterContextIds = new Set(
    Object.values(fieldInstance.value.contexts ?? {}).map((context: Value) => context.id)
  )
  // Removing from the list defaults values that were deleted because the whole context
  // was deleted and thus can't be updated
  const valuesToSet = mergedValues.filter(
    defaultValue => afterContextIds.has(defaultValue.contextId),
  )

  if (valuesToSet.length === 0) {
    return
  }

  await client.put({
    url: `/rest/api/3/field/${fieldInstance.value.id}/context/defaultValue`,
    data: {
      defaultValues: valuesToSet,
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
