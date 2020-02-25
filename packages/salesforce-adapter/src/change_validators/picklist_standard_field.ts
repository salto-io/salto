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
  Change, ChangeDataType, ChangeError, ElemID, Field, getChangeElement, isModificationDiff,
} from '@salto-io/adapter-api'
import { apiName } from '../transformers/transformer'
import { SALESFORCE_CUSTOM_SUFFIX } from '../constants'
import { isPicklistField, isStandardValueSetPicklistField } from '../filters/value_set'

const isStandardField = (field: Field): boolean =>
  !apiName(field, true).endsWith(SALESFORCE_CUSTOM_SUFFIX)

const shouldCreateChangeError = (changeElement: ChangeDataType): changeElement is Field =>
  isPicklistField(changeElement) && isStandardField(changeElement)
  && !isStandardValueSetPicklistField(changeElement)

const createChangeError = (elemID: ElemID, fieldName: string): ChangeError =>
  ({
    elemID,
    severity: 'Error',
    message: `You cannot define picklist, globalPicklist, or valueSet on a standard field. Use StandardValueSet instead. Field: ${fieldName}`,
    detailedMessage: 'You cannot define picklist, globalPicklist, or valueSet on a standard field. Use StandardValueSet instead.',
  })

/**
 * It is forbidden to modify a picklist on a standard field. Only StandardValueSet is allowed.
 */
export const changeValidator = {
  onUpdate: async (changes: ReadonlyArray<Change>): Promise<ReadonlyArray<ChangeError>> =>
    changes
      .filter(change => isModificationDiff(change))
      .filter(change => shouldCreateChangeError(getChangeElement(change)))
      .map(change => createChangeError(
        getChangeElement(change).elemID,
        (getChangeElement(change) as Field).name
      )),
}
export default changeValidator
