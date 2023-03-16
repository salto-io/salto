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
import { Change, ChangeError, Field, getAllChangeData, isModificationChange, ChangeValidator,
  getChangeData, isFieldChange, ModificationChange, ElemID, isReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { apiName, isCustom } from '../transformers/transformer'
import { isPicklistField, hasValueSetNameAnnotation } from '../filters/value_set'
import { GLOBAL_VALUE_SET_METADATA_TYPE, VALUE_SET_FIELDS } from '../constants'
import { isInstanceOfType } from '../filters/utils'

const { awu } = collections.asynciterable

const isGlobalPicklistChange = async (change: Change): Promise<boolean> => {
  const [before, after] = getAllChangeData(change)
  return isPicklistField(before) && isPicklistField(after) && isCustom(await apiName(before))
  && !hasValueSetNameAnnotation(before) && hasValueSetNameAnnotation(after)
}

const createChangeErrors = ({ pickListField, gvsElemID }:
  { pickListField: Field; gvsElemID: ElemID | undefined }): ChangeError[] => {
  const picklistErr: ChangeError = {
    elemID: pickListField.elemID,
    severity: 'Error',
    message: 'Cannot promote a picklist value set to a global value set via the API',
    detailedMessage: `${pickListField.name} picklist value set cannot be promoted to a global value set via the API.\nYou can delete this change in Salto and do it directly in salesforce.`,
  }
  // picklistField valueSetName annotation points to a valid GVS
  if (gvsElemID) {
    const gvsErr: ChangeError = {
      elemID: gvsElemID,
      severity: 'Error',
      message: 'Cannot promote a picklist value set to a global value set via the API',
      detailedMessage: `${gvsElemID.name} picklist value set cannot be promoted to a global value set via the API.\nYou can delete this change in Salto and do it directly in salesforce.`,
    }
    return [picklistErr, gvsErr]
  }
  return [picklistErr]
}

const referencedGvsElemID = async (
  change: ModificationChange<Field>
): Promise<ElemID | undefined> => {
  const referencedGvs = getChangeData(change).annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
  if (isReferenceExpression(referencedGvs)) {
    const referencedValue = referencedGvs.value
    if (await isInstanceOfType(GLOBAL_VALUE_SET_METADATA_TYPE)(referencedValue)) {
      return referencedValue.elemID
    }
  }
  return undefined
}

/**
 * Promoting picklist value-set to global is forbidden
 */
const changeValidator: ChangeValidator = async changes => {
  const isGVSInstance = isInstanceOfType(GLOBAL_VALUE_SET_METADATA_TYPE)
  const gvsIDs = new Set(await awu(changes)
    .map(getChangeData)
    .filter(isGVSInstance)
    .map(c => c.elemID.getFullName())
    .toArray())

  return awu(changes.filter(isModificationChange).filter(isFieldChange))
    .filter(isGlobalPicklistChange)
    .map(async change => {
      const gvsElemID = await referencedGvsElemID(change)
      return {
        pickListField: getChangeData(change),
        gvsElemID: (gvsElemID && gvsIDs.has(gvsElemID.getFullName())) ? gvsElemID : undefined,
      }
    })
    .flatMap(createChangeErrors)
    .toArray()
}


export default changeValidator
