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
  ChangeError, getChangeData,
  ChangeValidator, isRemovalChange, ChangeDataType, InstanceElement, isInstanceChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { RECORD_TYPE_METADATA_TYPE } from '../constants'
import { isInstanceOfType } from '../filters/utils'

const { isDefined } = values
const { awu } = collections.asynciterable

const isRecordTypeChange = async (changedElement: ChangeDataType): Promise<boolean> => (
  isInstanceOfType(RECORD_TYPE_METADATA_TYPE)(changedElement)
)

const isTypeDeletion = (changedElement: ChangeDataType): boolean => (
  changedElement.elemID.idType === 'type'
)

const isPartOfDeletedType = (instance: InstanceElement, deletedTypes: string[]): boolean => {
  const fullName = _.get(instance, 'value.fullName')
  if (isDefined(fullName)) {
    return deletedTypes.includes(fullName.split('.')[0])
  }
  return false
}


const createChangeError = (instance: InstanceElement): ChangeError =>
  ({
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot delete RecordType',
    detailedMessage: `You cannot delete RecordType instance. name: ${_.last(instance.path)}`,
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
  return awu(changes)
    .filter(isInstanceChange)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isRecordTypeChange)
    .filter(instance => !isPartOfDeletedType(instance, deletedTypes))
    .map(createChangeError)
    .toArray()
}

export default changeValidator
