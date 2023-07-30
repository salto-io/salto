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

import { Change, ChangeDataType, ChangeError, getChangeData, isModificationChange, Values } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { NetsuiteChangeValidator } from './types'
import { FIELDS_TO_OMIT_PRE_DEPLOY, getFieldsToOmitByType } from '../filters/omit_fields'
import { getDifferentKeys } from '../filters/data_instances_diff'
import { getElementValueOrAnnotations } from '../types'

const { isDefined } = values

const getFieldsToOmit = (
  value: Values,
  typeName: string,
  fieldsToOmitByType: Record<string, string[]>
): string[] =>
  fieldsToOmitByType[typeName]
    .filter(fieldToOmit => fieldToOmit in value)

const getChangeError = (
  change: Change,
  fieldsToOmitByType: Record<string, string[]>,
  element: ChangeDataType,
): ChangeError => {
  if (isModificationChange(change) && getDifferentKeys(change).size === 1) {
    return {
      elemID: element.elemID,
      severity: 'Error',
      message: 'This element will be removed from deployment',
      detailedMessage: `This element will be removed from deployment because it only contains changes to the undeployable field '${fieldsToOmitByType[element.elemID.typeName].join(', ')}'.`,
    }
  }
  const wrappedFieldNames = fieldsToOmitByType[element.elemID.typeName].map(field => `'${field}'`).join(', ')
  return {
    elemID: element.elemID,
    severity: 'Warning',
    message: `This element will be deployed without the following fields: ${wrappedFieldNames}`,
    detailedMessage: `This element will be deployed without the following fields: ${wrappedFieldNames}, as NetSuite does not support deploying them.`,
  }
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const typeNames = FIELDS_TO_OMIT_PRE_DEPLOY.map(fieldToOmit => fieldToOmit.type)
  const fieldsToOmitByType = getFieldsToOmitByType(typeNames, FIELDS_TO_OMIT_PRE_DEPLOY)

  return changes
    .map(change => {
      const element = getChangeData(change)
      const { typeName } = element.elemID
      if (typeName in fieldsToOmitByType
        && getFieldsToOmit(getElementValueOrAnnotations(element), typeName, fieldsToOmitByType).length > 0) {
        return getChangeError(change, fieldsToOmitByType, element)
      }
      return undefined
    })
    .filter(isDefined)
}

export default changeValidator
