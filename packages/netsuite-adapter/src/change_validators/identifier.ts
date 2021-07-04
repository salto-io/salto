/*
*                      Copyright 2021 Salto Labs Ltd.
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
  ChangeValidator, getChangeElement, isModificationChange, isInstanceChange,
} from '@salto-io/adapter-api'
import { TYPE_TO_ID_FIELDS } from '../data_elements/multi_fields_identifiers'

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeElement(change).elemID.typeName in TYPE_TO_ID_FIELDS)
    .filter(change => change.data.before.value.identifier !== change.data.after.value.identifier)
    .map(getChangeElement)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: 'Identifier field is read only',
      detailedMessage: `Changing identifier value of (${elemID.getFullName()}) is not supported`,
    }))
)

export default changeValidator
