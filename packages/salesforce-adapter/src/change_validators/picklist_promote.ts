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
import { Change, ChangeError, Field, getAllChangeElements, isModificationChange, ChangeValidator,
  getChangeElement, ReferenceExpression} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { apiName, isCustom } from '../transformers/transformer'
import { isPicklistField, isGlobalValueSetPicklistField } from '../filters/value_set'
import { VALUE_SET_FIELDS } from '../constants'

const { awu } = collections.asynciterable

const isGlobalPicklistChange = async (change: Change): Promise<boolean> => {
  const [before, after] = getAllChangeElements(change)
  return isPicklistField(before) && isPicklistField(after) && isCustom(await apiName(before))
  && !isGlobalValueSetPicklistField(before) && isGlobalValueSetPicklistField(after)
}

const createChangeErrors = (pickListField: Field): ChangeError[] => {
  const gvsElemID = pickListField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME].elemID

  return [{
    elemID: pickListField.elemID,
    severity: 'Error',
    message: `You cannot promote a picklist value set to global one. Field: ${pickListField.name}`,
    detailedMessage: 'You cannot promote a picklist value set to global one. Please promote via the service.',
  },
  {
    elemID: gvsElemID,
    severity: 'Error',
    message: `You cannot create a global value set as a result of a picklist promote. Field: ${gvsElemID.name}`,
    detailedMessage: 'You cannot promote a picklist value set to global one. Please promote via the service.',
  }]
}

/**
 * Promoting picklist value-set to global is forbbiden
 */
const changeValidator: ChangeValidator = async changes => {
  
  // validate that the changed picklist field has corresponding new global value set addition change
  const valdiateCreatedGvsCreated = (change: Change): boolean => {
    const ValueSetID = getChangeElement(change).annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] as ReferenceExpression
    const gvsFound = changes.filter(c => c.action === 'add'
    && getChangeElement(c).elemID.getFullName() === ValueSetID.elemID.getFullName()).length !== 0
    return gvsFound
  }

  return awu(changes)
    .filter(isModificationChange)
    .filter(isGlobalPicklistChange)
    .filter(valdiateCreatedGvsCreated)
    .map(getChangeElement)
    .flatMap(field => createChangeErrors(field as Field))
    .toArray()
}

export default changeValidator
