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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  Field, getChangeData, isField, isModificationChange, ChangeDataType,
  InstanceElement, isInstanceChange, ModificationChange, isFieldChange, isReferenceExpression,
} from '@salto-io/adapter-api'

import { FilterWith } from '../filter'
import { FIELD_ANNOTATIONS, VALUE_SET_FIELDS } from '../constants'
import { PicklistValue } from '../client/types'
import { Types, metadataType } from '../transformers/transformer'
import { GLOBAL_VALUE_SET, CUSTOM_VALUE } from './global_value_sets'

const { awu } = collections.asynciterable

const { makeArray } = collections.array

export const isPicklistField = (changedElement: ChangeDataType): changedElement is Field =>
  isField(changedElement)
    && ([
      Types.primitiveDataTypes.Picklist.elemID.getFullName(),
      Types.primitiveDataTypes.MultiselectPicklist.elemID.getFullName(),
    ]).includes(changedElement.refType.elemID.getFullName())

export const isValueSetReference = (field: Field): boolean =>
  isReferenceExpression(field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME])

export const hasValueSetNameAnnotation = (field: Field): boolean =>
  !_.isUndefined(field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME])

/**
 * Adds inactive values after the deletion of the values in the following cases:
 *  - Global value set
 *  - Restricted custom value set
 */
const filterCreator = (): FilterWith<'onDeploy'> => ({
  name: 'valueSetFilter',
  onDeploy: async changes => {
    const isRestrictedPicklistField = (
      changedElement: ChangeDataType
    ): changedElement is Field =>
      isPicklistField(changedElement)
      && Boolean(changedElement.annotations[FIELD_ANNOTATIONS.RESTRICTED])

    const isGlobalValueSetInstanceChange = async (
      change: ModificationChange<ChangeDataType>
    ): Promise<boolean> => (
      isInstanceChange(change) && await metadataType(getChangeData(change)) === GLOBAL_VALUE_SET
    )

    const withRemovedCustomValues = (beforeValues: PicklistValue[], afterValues: PicklistValue[]):
    PicklistValue[] => {
      const afterCustomValuesFullNames = afterValues.map(v => v.fullName)
      const setCustomValueInactive = (value: PicklistValue): PicklistValue => {
        value.isActive = false
        return value
      }
      return [
        ...afterValues,
        ...beforeValues
          .filter(v => !afterCustomValuesFullNames.includes(v.fullName))
          .map(v => setCustomValueInactive(v)),
      ]
    }

    // Handle global value set instances
    await awu(changes)
      .filter(isModificationChange)
      .filter(isGlobalValueSetInstanceChange)
      .forEach(change => {
        const instChange = change as ModificationChange<InstanceElement>
        const beforeCustomValues = makeArray(instChange.data.before.value[CUSTOM_VALUE])
        const afterCustomValues = makeArray(instChange.data.after.value[CUSTOM_VALUE])
        instChange.data.after.value[CUSTOM_VALUE] = withRemovedCustomValues(
          beforeCustomValues, afterCustomValues
        )
      })

    // Handle restricted picklist fields
    changes
      .filter(isFieldChange)
      .filter(isModificationChange)
      .filter(change => {
        const field = getChangeData(change)
        return (
          isRestrictedPicklistField(field)
          && !isValueSetReference(field)
        )
      })
      .forEach(change => {
        const beforeField = change.data.before
        const afterField = change.data.after
        const beforeCustomValues = makeArray(beforeField.annotations[FIELD_ANNOTATIONS.VALUE_SET])
        const afterCustomValues = makeArray(afterField.annotations[FIELD_ANNOTATIONS.VALUE_SET])
        afterField.annotations[FIELD_ANNOTATIONS.VALUE_SET] = withRemovedCustomValues(
          beforeCustomValues, afterCustomValues
        )
      })
  },
})

export default filterCreator
