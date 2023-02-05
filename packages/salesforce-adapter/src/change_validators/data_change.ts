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
import { ChangeValidator, ElemID, getChangeData, ChangeError, InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'

const { awu } = collections.asynciterable

const createChangeError = (instanceElemID: ElemID): ChangeError => ({
  elemID: instanceElemID,
  severity: 'Info',
  message: 'Data instances were changed in deployment.',
  detailedMessage: 'Data instances were changed in this deployment.',
})

/**
 * Note that data (CustomObject instances) is deployed
 * This changeValidator will return none or a single changeError
 */
const createDataChangeValidator: ChangeValidator = async changes => {
  const dataChange = await awu(changes)
    .filter(isInstanceOfCustomObjectChange)
    .map(change => getChangeData(change) as InstanceElement)
    .find(Boolean)

  return dataChange !== undefined ? [createChangeError(dataChange.elemID)] : []
}

export default createDataChangeValidator
