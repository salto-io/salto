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
  getChangeElement, isFieldChange, ModificationChange, ElemID, isReferenceExpression } from '@salto-io/adapter-api'
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

const createChangeErrors = ({ pickListField, gvsElemID }:
  { pickListField: Field; gvsElemID: ElemID | undefined }): ChangeError[] => {
  const picklistErr: ChangeError = {
    elemID: pickListField.elemID,
    severity: 'Error',
    message: 'Promoting a picklist value set to a global one cannot be done via API. Please promote via the service.',
    detailedMessage: `Promoting a picklist value set to a global one cannot be done via API. Field: ${pickListField.name}`,
  }
  // picklistField valueSetName annotation points to a valid GVS
  if (gvsElemID) {
    const gvsErr: ChangeError = {
      elemID: gvsElemID,
      severity: 'Error',
      message: 'Cannot create a global value set as a result of a picklist promote via API. Please promote via the service.',
      detailedMessage: `Cannot create a global value set as a result of a picklist promote via API. Value list name: ${gvsElemID.name}`,
    }
    return [picklistErr, gvsErr]
  }
  return [picklistErr]
}

const referencedGvsElemID = (change: ModificationChange<Field>): ElemID | undefined => {
  const referencedGvs = getChangeElement(change).annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
  if (isReferenceExpression(referencedGvs)) {
    const referencedValue = referencedGvs.value
    if (isInstanceOfType(GLOBAL_VALUE_SET)(referencedValue)) {
      return referencedValue.elemID
    }
  }
  return undefined
}

/**
 * Promoting picklist value-set to global is forbbiden
 */
const changeValidator: ChangeValidator = async changes => {
  const isGVSInstance = isInstanceOfType(GLOBAL_VALUE_SET)
  const gvsIDs = new Set(await awu(changes)
    .map(getChangeElement)
    .filter(isGVSInstance)
    .map(c => c.elemID.getFullName())
    .toArray())

  return awu(changes.filter(isModificationChange).filter(isFieldChange))
    .filter(isGlobalPicklistChange)
    .map(async change => {
      const gvsElemID = referencedGvsElemID(change)
      return {
        pickListField: getChangeElement(change),
        gvsElemID: (gvsElemID && gvsIDs.has(gvsElemID.getFullName())) ? gvsElemID : undefined,
      }
    })
    .flatMap(createChangeErrors)
    .toArray()
}


export default changeValidator
