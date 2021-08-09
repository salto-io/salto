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
  getChangeElement, ReferenceExpression, SaltoErrorSeverity, ChangeDataType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { apiName, isCustom } from '../transformers/transformer'
import { isPicklistField, isGlobalValueSetPicklistField } from '../filters/value_set'
import { VALUE_SET_FIELDS } from '../constants'
import { isInstanceOfType } from '../filters/utils'
import { GLOBAL_VALUE_SET } from '../filters/global_value_sets'

const { awu } = collections.asynciterable

const isGlobalPicklistChange = async (change: Change): Promise<boolean> => {
  const [before, after] = getAllChangeElements(change)
  return isPicklistField(before) && isPicklistField(after) && isCustom(await apiName(before))
  && !isGlobalValueSetPicklistField(before) && isGlobalValueSetPicklistField(after)
}

const createChangeErrors = (res: {pickListField: ChangeDataType, globalValueSetFound: boolean}): ChangeError[] => {
  const {pickListField, globalValueSetFound} = res
  const picklistErr = {
    elemID: pickListField.elemID,
    severity: 'Error' as SaltoErrorSeverity,
    message: `You cannot promote a picklist value set to global one. Field: ${(pickListField as Field).name}`,
    detailedMessage: 'You cannot promote a picklist value set to global one. Please promote via the service.',
  }
  // picklistField valueSetName annotation points to a valid GVS
  if (globalValueSetFound) {
    const gvsElemID = pickListField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME].value.elemID
    const gvsErr = {
      elemID: gvsElemID,
      severity: 'Error' as SaltoErrorSeverity,
      message: `You cannot create a global value set as a result of a picklist promote. Value list name: ${gvsElemID.name}`,
      detailedMessage: 'You cannot create a global value set as a result of a picklist promote. Please promote via the service.',
    }
    return [picklistErr, gvsErr]
  } else {
    return [picklistErr]
  }
}

// validate that the changed picklist field has corresponding new global value set addition change
const valdiateCreatedGvsCreated = (changes: readonly Change[]) => {
  return (change: Change): boolean => {
    const referencedGvs = getChangeElement(change).annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
    if (referencedGvs instanceof ReferenceExpression) {
      const referencedValue = referencedGvs.value
      if (isInstanceOfType(GLOBAL_VALUE_SET)(referencedValue)) {
        return changes.filter(c => c.action === 'add'
          && getChangeElement(c).elemID.getFullName() === referencedValue.elemID.getFullName()).length !== 0
      }
    }
    return false
  }
}

/**
 * Promoting picklist value-set to global is forbbiden
 */
const changeValidator: ChangeValidator = async changes => {

  const gvsCreatedResolver = valdiateCreatedGvsCreated(changes)

  return awu(changes)
    .filter(isModificationChange)
    .filter(isGlobalPicklistChange)
    .map((change) => {
      return { pickListField: getChangeElement(change), globalValueSetFound: gvsCreatedResolver(change) }
    })
    .flatMap(createChangeErrors)
    .toArray()
}



export default changeValidator
