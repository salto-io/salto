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
import _ from 'lodash'
import {
  ChangeError, Field, getChangeData,
  ChangeValidator, isRemovalChange, ChangeDataType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { RECORD_TYPE_METADATA_TYPE } from '../constants'

const { awu } = collections.asynciterable

const isRecordTypeChange = (changedElement: ChangeDataType): changedElement is Field => (
  (changedElement.elemID.typeName === RECORD_TYPE_METADATA_TYPE)
)

const isTypeDeletion = (changedElement: ChangeDataType): boolean => (
  (changedElement.elemID.idType === 'type')
)

const isPartOfDeletedType = (field: Field, deletedTypes: string[]): boolean => {
  const fullname = _.get(field, 'value.fullName')
  if (!_.isUndefined(fullname)) {
    return deletedTypes.includes(fullname.split('.')[0])
  }
  return false
}


const createChangeError = (field: Field): ChangeError =>
  ({
    elemID: field.elemID,
    severity: 'Error',
    message: `You cannot delete recordType instance. name: ${_.last(field.path)}`,
    detailedMessage: 'You cannot delete recordType',
  })

/**
 * It is not possible to delete a recordType trough SF API's
 */
const changeValidator: ChangeValidator = async changes => {
  const deletedTypes = await awu(changes)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isTypeDeletion)
    .map(obj => obj.elemID.typeName)
    .toArray()
  // We want to allow to delete record type if the entire type is being deleted
  const recordTypeDeletions = await awu(changes)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isRecordTypeChange)
    .filter(field => !isPartOfDeletedType(field, deletedTypes))
    .map(createChangeError)
    .toArray()

  return recordTypeDeletions
}

export default changeValidator
