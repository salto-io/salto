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
import {
  ChangeDataType, ChangeError, Field, getChangeData, isModificationChange, ChangeValidator,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { apiName, isCustom } from '../transformers/transformer'
import { isPicklistField, isValueSetReference } from '../filters/value_set'
import { STANDARD_VALUE_SET } from '../filters/standard_value_sets'
import { isInstanceOfType } from '../filters/utils'
import { VALUE_SET_FIELDS } from '../constants'

const { awu } = collections.asynciterable

const isStandardValueSet = async (picklistField: Field): Promise<boolean> => {
  const standardVSchecker = isInstanceOfType(STANDARD_VALUE_SET)
  return isValueSetReference(picklistField)
    && standardVSchecker(picklistField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME].value)
}

const shouldCreateChangeError = async (changeData: ChangeDataType): Promise<boolean> =>
  isPicklistField(changeData) && !isCustom(await apiName(changeData))
    && !(await isStandardValueSet(changeData))

const createChangeError = (field: Field): ChangeError =>
  ({
    elemID: field.elemID,
    severity: 'Error',
    message: 'Standard fields cannot be defined a picklist, global picklist, or value set.',
    detailedMessage: `Standard field ‘${field.name}’ cannot be defined with a picklist, global picklist or value set.\nYou can edit the field in Salto and use a StandardValueSet instead`,
  })

/**
 * It is forbidden to modify a picklist on a standard field. Only StandardValueSet is allowed.
 */
const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isModificationChange)
    .map(getChangeData)
    .filter(shouldCreateChangeError)
    // We can cast since shouldCreateChangeError only return true to fields
    .map(field => createChangeError(field as Field))
    .toArray()
)

export default changeValidator
