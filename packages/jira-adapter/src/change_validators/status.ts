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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange, SeverityLevel, isReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { STATUS_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const NO_CATEGORY_STATUS = 'No Category'

export const statusValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === STATUS_TYPE_NAME)
    .filter(instance =>
      isReferenceExpression(instance.value.statusCategory)
      && isInstanceElement(instance.value.statusCategory.value)
      && instance.value.statusCategory.value.value.name === NO_CATEGORY_STATUS)
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'statusCategory can not have No_Category value',
      detailedMessage: `This status has an invalid statusCategory ${instance.value.statusCategory.elemID.name}. statusCategory should be one of the following: Done, In_Progress or To_Do.`,
    }))
    .toArray()
)
