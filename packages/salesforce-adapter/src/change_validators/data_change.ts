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
import { ChangeValidator, ElemID, getChangeData, ChangeError } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'

const { awu } = collections.asynciterable
const { isDefined } = values

const createChangeError = (instanceElemID: ElemID): ChangeError => ({
  elemID: instanceElemID,
  severity: 'Info',
  message: 'Data instances will be changed in deployment.',
  detailedMessage: '',
})

/**
 * Creates a ChangeError of type Info when one of the changes is on a data instance.
 */
const createDataChangeValidator: ChangeValidator = async changes => {
  const dataChange = await awu(changes)
    .find(isInstanceOfCustomObjectChange)

  return isDefined(dataChange)
    ? [createChangeError(getChangeData(dataChange).elemID)]
    : []
}

export default createDataChangeValidator
