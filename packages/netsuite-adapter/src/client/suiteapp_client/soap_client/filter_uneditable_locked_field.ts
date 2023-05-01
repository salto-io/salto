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
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { CRM_CUSTOM_FIELD, ENTITY_CUSTOM_FIELD, ITEM_CUSTOM_FIELD, NETSUITE, OTHER_CUSTOM_FIELD, SOAP_SCRIPT_ID } from '../../../constants'
import { WriteResponse, WriteResponseError, isWriteResponseSuccess } from './types'

const log = logger(module)
const { isDefined } = values

export type HasElemIDFunc = (elemID: ElemID) => Promise<boolean>

const INSUFFICIENT_PERMISSION_ERROR = 'INSUFFICIENT_PERMISSION'
const CUSTOM_FIELD_LIST = 'customFieldList'
const fieldNameRegex = new RegExp('You do not have permissions to set a value for element [\\w]+')

const extractFieldName = (errorMessage: string): string | undefined => {
  const matchedField = errorMessage.match(fieldNameRegex)
  if (matchedField?.length !== 1) {
    return undefined
  }
  return matchedField[0].split(' ').pop() as string
}

const getFieldFullName = (fieldName: string): string | undefined => {
  let dirName: string | undefined
  if (fieldName.startsWith('custrecord')) {
    dirName = OTHER_CUSTOM_FIELD
  } else if (fieldName.startsWith('custentity')) {
    dirName = ENTITY_CUSTOM_FIELD
  } else if (fieldName.startsWith('custitem')) {
    dirName = ITEM_CUSTOM_FIELD
  } else if (fieldName.startsWith('custevent')) {
    dirName = CRM_CUSTOM_FIELD
  }
  return isDefined(dirName) ? `${NETSUITE}.${dirName}.instance.${fieldName}` : undefined
}

const isLockedElement = async (fieldName: string, hasElemID: HasElemIDFunc) : Promise<boolean> => {
  const fieldFullName = getFieldFullName(fieldName)
  return (isDefined(fieldFullName) ? !(await hasElemID(ElemID.fromFullName(fieldFullName))) : false)
}

const removeUneditableLockedField = (
  instance: InstanceElement,
  fieldName: string
): InstanceElement | undefined => {
  const customFields = instance.value[CUSTOM_FIELD_LIST]
  if (_.isUndefined(customFields)) {
    return undefined
  }
  const validCustomFields = customFields['platformCore:customField']
    .filter((customField: { attributes: { [x: string]: string } }) =>
      customField.attributes[SOAP_SCRIPT_ID] !== fieldName)
  if (validCustomFields.length === customFields['platformCore:customField'].length) {
    return undefined
  }

  log.debug('Removing locked custom field: %s from instance: %s', fieldName, instance.elemID.getFullName())
  if (validCustomFields.length > 0) {
    customFields['platformCore:customField'] = validCustomFields
  } else {
    delete instance.value[CUSTOM_FIELD_LIST]
  }
  if (isDefined(instance.value['platformCore:nullFieldList']?.['platformCore:name'])) {
    instance.value['platformCore:nullFieldList']['platformCore:name'].push(fieldName)
  } else {
    instance.value['platformCore:nullFieldList'] = { 'platformCore:name': [fieldName] }
  }
  return instance
}

export const getModifiedInstance = async (
  writeResponse: WriteResponse,
  instance: InstanceElement,
  hasElemID: HasElemIDFunc,
): Promise<InstanceElement | undefined> => {
  if (isWriteResponseSuccess(writeResponse)
    || (writeResponse.status.statusDetail[0].code !== INSUFFICIENT_PERMISSION_ERROR)) {
    return undefined
  }
  const fieldName = extractFieldName((writeResponse as WriteResponseError).status.statusDetail[0].message)
  if (isDefined(fieldName) && await isLockedElement(fieldName, hasElemID)) {
    return removeUneditableLockedField(instance, fieldName)
  }
  return undefined
}
