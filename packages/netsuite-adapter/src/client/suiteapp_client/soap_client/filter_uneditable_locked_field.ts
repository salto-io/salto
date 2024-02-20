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

import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { isCustomRecordType } from '../../../types'
import {
  CRM_CUSTOM_FIELD,
  CRM_CUSTOM_FIELD_PREFIX,
  CUSTOM_FIELD_LIST,
  ENTITY_CUSTOM_FIELD,
  ENTITY_CUSTOM_FIELD_PREFIX,
  ITEM_CUSTOM_FIELD,
  ITEM_CUSTOM_FIELD_PREFIX,
  NETSUITE,
  OTHER_CUSTOM_FIELD,
  OTHER_CUSTOM_FIELD_PREFIX,
  SOAP_SCRIPT_ID,
} from '../../../constants'
import { WriteResponse, isWriteResponseError } from './types'
import { HasElemIDFunc } from '../types'
import { getGroupItemFromRegex } from '../../utils'
import { INSUFFICIENT_PERMISSION_ERROR, PLATFORM_CORE_CUSTOM_FIELD } from '../constants'

const { isDefined } = values
const log = logger(module)

const FIELD_NAME = 'fieldName'
const fieldNameRegex = new RegExp(`You do not have permissions to set a value for element (?<${FIELD_NAME}>\\w+)`, 'g')

const extractFieldName = (errorMessage: string): string | undefined => {
  const errorFields = getGroupItemFromRegex(errorMessage, fieldNameRegex, FIELD_NAME)
  return errorFields.length === 1 ? errorFields[0] : undefined
}

const getFieldElemID = (fieldName: string): ElemID | undefined => {
  if (fieldName.startsWith(OTHER_CUSTOM_FIELD_PREFIX)) {
    return new ElemID(NETSUITE, OTHER_CUSTOM_FIELD, 'instance', fieldName)
  }
  if (fieldName.startsWith(ENTITY_CUSTOM_FIELD_PREFIX)) {
    return new ElemID(NETSUITE, ENTITY_CUSTOM_FIELD, 'instance', fieldName)
  }
  if (fieldName.startsWith(ITEM_CUSTOM_FIELD_PREFIX)) {
    return new ElemID(NETSUITE, ITEM_CUSTOM_FIELD, 'instance', fieldName)
  }
  if (fieldName.startsWith(CRM_CUSTOM_FIELD_PREFIX)) {
    return new ElemID(NETSUITE, CRM_CUSTOM_FIELD, 'instance', fieldName)
  }
  log.warn(
    'The field "%s" was suspected as a locked custom field,' +
      " but its prefix didn't match any of the known custom fields prefixes",
    fieldName,
  )
  return undefined
}

const isLockedElement = async (fieldName: string, hasElemID: HasElemIDFunc): Promise<boolean> => {
  const fieldElemID = getFieldElemID(fieldName)
  return fieldElemID !== undefined && !(await hasElemID(fieldElemID))
}

const removeCustomField = (instance: InstanceElement, fieldName: string): boolean => {
  const customFields = instance.value[CUSTOM_FIELD_LIST]
  if (customFields === undefined) {
    log.warn(
      'The field "%s" was suspected as a locked field of the instance "%s", but it has no custom fields.',
      fieldName,
      instance.elemID.getFullName(),
    )
    return false
  }
  const validCustomFields = customFields[PLATFORM_CORE_CUSTOM_FIELD].filter(
    (customField: { attributes: Record<string, string> }) => customField.attributes[SOAP_SCRIPT_ID] !== fieldName,
  )
  if (validCustomFields.length === customFields[PLATFORM_CORE_CUSTOM_FIELD].length) {
    log.warn(
      'The field "%s" was suspected as a locked field of the instance "%s", but wasn\'t found in its custom fields.',
      fieldName,
      instance.elemID.getFullName(),
    )
    return false
  }

  log.debug('Removing locked custom field: %s from instance: %s', fieldName, instance.elemID.getFullName())

  if (validCustomFields.length > 0) {
    customFields[PLATFORM_CORE_CUSTOM_FIELD] = validCustomFields
  } else {
    delete instance.value[CUSTOM_FIELD_LIST]
  }
  return true
}

export const removeUneditableLockedField = async (
  instance: InstanceElement,
  writeResponse: WriteResponse,
  hasElemID: HasElemIDFunc,
): Promise<boolean> => {
  if (
    !isCustomRecordType(await instance.getType()) &&
    isWriteResponseError(writeResponse) &&
    writeResponse.status.statusDetail[0].code === INSUFFICIENT_PERMISSION_ERROR
  ) {
    const fieldName = extractFieldName(writeResponse.status.statusDetail[0].message)
    if (isDefined(fieldName) && (await isLockedElement(fieldName, hasElemID))) {
      // we suspect this is an uneditable field, but since we can't say for sure
      // removeCustomField might return false indicating no change ocurred.
      return removeCustomField(instance, fieldName)
    }
  }

  return false
}
