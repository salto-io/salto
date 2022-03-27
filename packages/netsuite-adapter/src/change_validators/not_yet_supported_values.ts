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
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { isCustomType } from '../types'
import { NOT_YET_SUPPORTED_VALUE } from '../constants'
import { isInstanceContainsStringValue } from './utils'

const { awu } = collections.asynciterable

const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => isCustomType(instance.refType))
    .filter(instance => isInstanceContainsStringValue(instance, NOT_YET_SUPPORTED_VALUE))
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Instance has a NOT_YET_SUPPORTED value that Salto cannot deploy',
      detailedMessage: `Instance ${instance.elemID.getFullName()} has a NOT_YET_SUPPORTED value that Salto cannot deploy. In order to deploy the instance, please fill the NOT_YET_SUPPORTED value`,
    } as ChangeError))
    .toArray()
)

export default changeValidator
