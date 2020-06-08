/*
*                      Copyright 2020 Salto Labs Ltd.
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
  ChangeDataType, ChangeError, Field, getChangeElement, isModificationDiff, ChangeValidator,
} from '@salto-io/adapter-api'
import { apiName, isCustom } from '../transformers/transformer'
import { isPicklistField, isStandardValueSetPicklistField } from '../filters/value_set'

const shouldCreateChangeError = (changeElement: ChangeDataType): changeElement is Field =>
  isPicklistField(changeElement) && !isCustom(apiName(changeElement))
  && !isStandardValueSetPicklistField(changeElement)

const createChangeError = (field: Field): ChangeError =>
  ({
    elemID: field.elemID,
    severity: 'Error',
    message: `You cannot define picklist, globalPicklist, or valueSet on a standard field. Use StandardValueSet instead. Field: ${field.name}`,
    detailedMessage: 'You cannot define picklist, globalPicklist, or valueSet on a standard field. Use StandardValueSet instead.',
  })

/**
 * It is forbidden to modify a picklist on a standard field. Only StandardValueSet is allowed.
 */
const changeValidator: ChangeValidator = async changes => (
  changes.changes
    .filter(isModificationDiff)
    .map(getChangeElement)
    .filter(shouldCreateChangeError)
    .map(createChangeError)
)

export default changeValidator
