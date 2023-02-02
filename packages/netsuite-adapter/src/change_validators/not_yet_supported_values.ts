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
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError,
  getChangeData,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { NOT_YET_SUPPORTED_VALUE } from '../constants'
import { isElementContainsStringValue } from './utils'
import { NetsuiteChangeValidator } from './types'


const { awu } = collections.asynciterable

const changeValidator: NetsuiteChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isStandardInstanceOrCustomRecordType)
    .filter(element => isElementContainsStringValue(element, NOT_YET_SUPPORTED_VALUE))
    .map(element => ({
      elemID: element.elemID,
      severity: 'Error',
      message: 'Elements with values set to \'NOT_YET_SUPPORTED\' cannot be deployed',
      detailedMessage: 'Elements with values set to \'NOT_YET_SUPPORTED\' cannot be deployed. Please see https://help.salto.io/en/articles/6845063-deploying-elements-containing-not-yet-supported-values for more details.',
    } as ChangeError))
    .toArray()
)

export default changeValidator
