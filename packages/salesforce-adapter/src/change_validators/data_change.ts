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
import {
  ChangeValidator,
  ElemID,
  getChangeData,
  ChangeError,
  isAdditionOrModificationChange,
  InstanceElement,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { aliasOrElemID, isInstanceOfCustomObjectChangeSync } from '../filters/utils'

const { isDefined } = values

const createDataDeploymentChangeInfo = (instanceElemID: ElemID): ChangeError => ({
  elemID: instanceElemID,
  severity: 'Info',
  message: 'Data instances will be changed in deployment.',
  detailedMessage: '',
})

const createUnknownFieldValuesChangeError = (instance: InstanceElement): ChangeError | undefined => {
  const typeFields = new Set(Object.keys(instance.getTypeSync().fields))
  const unknownFields = Object.keys(instance.value)
    .filter(fieldName => !typeFields.has(fieldName))
  return unknownFields.length > 0
    ? {
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Data instance has values of unknown fields',
      detailedMessage: `The ${aliasOrElemID(instance.getTypeSync())} "${aliasOrElemID(instance)}" has values to the following unknown fields: [${unknownFields.join(', ')}]. Please include them in your deployment or remove these values from the instance.`,
    }
    : undefined
}

const createDataChangeValidator: ChangeValidator = async changes => {
  const changeErrors: ChangeError[] = []
  const dataChanges = changes.filter(isInstanceOfCustomObjectChangeSync)

  if (dataChanges.length === 0) {
    return []
  }
  changeErrors.push(createDataDeploymentChangeInfo(getChangeData(dataChanges[0]).elemID))
  dataChanges
    // Deletions are supported in this use-case
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .map(createUnknownFieldValuesChangeError)
    .filter(isDefined)
    .forEach(changeError => changeErrors.push(changeError))
  return changeErrors
}

export default createDataChangeValidator
