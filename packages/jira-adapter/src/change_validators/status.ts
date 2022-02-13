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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange, SaltoErrorSeverity } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { STATUS_TYPE_NAME } from '../filters/statuses/constants'

const { awu } = collections.asynciterable

export const statusValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === STATUS_TYPE_NAME)
    .map(async instance => {
      if (instance.value.statusCategory === undefined) {
        return {
          elemID: instance.elemID,
          severity: 'Error' as SaltoErrorSeverity,
          message: 'statusCategory is required to deploy statuses',
          detailedMessage: `The status ${instance.elemID.getFullName()} is missing statusCategory`,
        }
      }
      return undefined
    })
    .filter(values.isDefined)
    .toArray()
)
