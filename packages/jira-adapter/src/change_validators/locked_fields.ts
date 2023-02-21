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
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

const { awu } = collections.asynciterable

export const lockedFieldsValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
    .filter(instance => instance.value.isLocked)
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot deploy a locked field',
      detailedMessage: 'The field is locked and cannot be deployed. Learn more here: https://help.salto.io/en/articles/6933969-the-field-is-locked-and-cannot-be-deployed',
    }))
    .toArray()
)
