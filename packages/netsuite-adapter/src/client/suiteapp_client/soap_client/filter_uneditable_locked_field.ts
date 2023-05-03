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

import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { CRM_CUSTOM_FIELD, CRM_CUSTOM_FIELD_PREFIX, CUSTOM_FIELD_LIST, ENTITY_CUSTOM_FIELD,
  ENTITY_CUSTOM_FIELD_PREFIX, ITEM_CUSTOM_FIELD, ITEM_CUSTOM_FIELD_PREFIX, NETSUITE, OTHER_CUSTOM_FIELD,
  OTHER_CUSTOM_FIELD_PREFIX, PLATFORM_CORE_CUSTOM_FIELD, PLATFORM_CORE_NAME, PLATFORM_CORE_NULL_FIELD_LIST, SOAP_SCRIPT_ID } from '../../../constants'
import { WriteResponse, isWriteResponseError } from './types'
import { HasElemIDFunc } from '../types'
import { getGroupItemFromRegex } from '../../utils'

const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)

const INSUFFICIENT_PERMISSION_ERROR = 'INSUFFICIENT_PERMISSION'
const FIELD_NAME = 'fieldName'
const fieldNameRegex = new RegExp(`You do not have permissions to set a value for element (?<${FIELD_NAME}>\\w+)`, 'g')

const extractFieldName = (errorMessage: string): string | undefined => {
  const errorFields = getGroupItemFromRegex(errorMessage, fieldNameRegex, FIELD_NAME)
  return errorFields.length === 1 ? errorFields[0] : undefined
}

const getFieldElemID = (fieldName: string): ElemID | undefined => {
  if (fieldName.startsWith(OTHER_CUSTOM_FIELD_PREFIX)) {
    return ElemID.fromFullName(`${NETSUITE}.${OTHER_CUSTOM_FIELD}.instance.${fieldName}`)
  }
  if (fieldName.startsWith(ENTITY_CUSTOM_FIELD_PREFIX)) {
    return ElemID.fromFullName(`${NETSUITE}.${ENTITY_CUSTOM_FIELD}.instance.${fieldName}`)
  }
  if (fieldName.startsWith(ITEM_CUSTOM_FIELD_PREFIX)) {
    return ElemID.fromFullName(`${NETSUITE}.${ITEM_CUSTOM_FIELD}.instance.${fieldName}`)
  }
  if (fieldName.startsWith(CRM_CUSTOM_FIELD_PREFIX)) {
    return ElemID.fromFullName(`${NETSUITE}.${CRM_CUSTOM_FIELD}.instance.${fieldName}`)
  }
  return undefined
}

const isLockedElement = async (fieldName: string, hasElemID: HasElemIDFunc): Promise<boolean> => {
  const fieldElemID = getFieldElemID(fieldName)
  return (isDefined(fieldElemID) ? !(await hasElemID(fieldElemID)) : false)
}

const removeUneditableLockedField = (
  originalInstance: InstanceElement,
  fieldName: string
): InstanceElement | undefined => {
  const instance = originalInstance.clone()
  const customFields = instance.value[CUSTOM_FIELD_LIST]
  if (customFields === undefined) {
    return undefined
  }
  const validCustomFields = customFields[PLATFORM_CORE_CUSTOM_FIELD]
    .filter((customField: { attributes: Record<string, string> }) =>
      customField.attributes[SOAP_SCRIPT_ID] !== fieldName)
  if (validCustomFields.length === customFields[PLATFORM_CORE_CUSTOM_FIELD].length) {
    log.debug('The field "%s" was suspected as a locked field of the instance "%s", but wasn\'t found in its custom fields.',
      fieldName, instance.elemID.getFullName())
    return undefined
  }

  log.debug('Removing locked custom field: %s from instance: %s', fieldName, instance.elemID.getFullName())

  if (validCustomFields.length > 0) {
    customFields[PLATFORM_CORE_CUSTOM_FIELD] = validCustomFields
  } else {
    delete instance.value[CUSTOM_FIELD_LIST]
  }

  const nullCustomFields = Array.isArray(instance.value[PLATFORM_CORE_NULL_FIELD_LIST]?.[PLATFORM_CORE_NAME])
    ? instance.value[PLATFORM_CORE_NULL_FIELD_LIST][PLATFORM_CORE_NAME]
    : []
  instance.value[PLATFORM_CORE_NULL_FIELD_LIST] = {
    [PLATFORM_CORE_NAME]: [...nullCustomFields, fieldName],
  }
  return instance
}

const getModifiedInstance = async (
  writeResponse: WriteResponse,
  instance: InstanceElement,
  hasElemID: HasElemIDFunc,
): Promise<InstanceElement | undefined> => {
  if (isWriteResponseError(writeResponse)
    && (writeResponse.status.statusDetail[0].code === INSUFFICIENT_PERMISSION_ERROR)) {
    const fieldName = extractFieldName(writeResponse.status.statusDetail[0].message)
    if (isDefined(fieldName) && await isLockedElement(fieldName, hasElemID)) {
      // we suspect this is an uneditable field, but since we can't say for sure
      // removeUneditableLockedField might return undefined.
      return removeUneditableLockedField(instance, fieldName)
    }
  }

  return undefined
}


export const getModifiedInstances = async (
  instances: InstanceElement[],
  writeResponseList: WriteResponse[],
  hasElemID: HasElemIDFunc,
): Promise<{
  modifiedInstances: InstanceElement[]
  allInstancesUpdated: InstanceElement[]
  indicesMap: Map<number, number>
}> => {
  const modifiedOrUndefinedInstances = await awu(writeResponseList)
    .map((writeResponse, index) => getModifiedInstance(writeResponse, instances[index], hasElemID))
    .toArray()
  const allInstancesUpdated = modifiedOrUndefinedInstances
    .map((modifiedInstance, index) => (isDefined(modifiedInstance) ? modifiedInstance : instances[index]))
  const indicesMap = new Map(modifiedOrUndefinedInstances
    .map((modifiedInstance, originalIdx) => (isDefined(modifiedInstance) ? originalIdx : undefined))
    .filter(isDefined)
    .map((originalIdx, reducedIdx) => [originalIdx, reducedIdx]))

  return {
    modifiedInstances: modifiedOrUndefinedInstances.filter(isDefined),
    allInstancesUpdated,
    indicesMap,
  }
}
