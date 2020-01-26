import wu from 'wu'
import { collections } from '@salto/lowerdash'
import {
  Element, Field, isObjectType, Change, getChangeElement,
  isField, isModificationDiff, ChangeDataType, isInstanceElement, InstanceElement,
} from 'adapter-api'
import { SaveResult } from 'jsforce'
import { FilterWith } from '../filter'
import { FIELD_ANNOTATIONS } from '../constants'
import { PicklistValue } from '../client/types'
import { Types, metadataType } from '../transformers/transformer'
import { GLOBAL_VALUE_SET, CUSTOM_VALUE } from './global_value_sets'

const { makeArray } = collections.array

/**
 * Adds inactive values after the deletion of the values in the following cases:
 *  - Global value set
 *  - Restricted custom value set
 * */
const filterCreator = (): FilterWith<'onUpdate'> => ({
  onUpdate: async (before: Element, after: Element, changes: ReadonlyArray<Change>):
    Promise<SaveResult[]> => {
    const isPicklistField = (changedElement: ChangeDataType): boolean =>
      isField(changedElement)
      && ([
        Types.primitiveDataTypes.Picklist.elemID.getFullName(),
        Types.primitiveDataTypes.MultiselectPicklist.elemID.getFullName(),
      ]).includes(changedElement.type.elemID.getFullName())

    const getRemovedCustomValues = (beforeValues: PicklistValue[], afterValues: PicklistValue[]):
    PicklistValue[] => {
      const afterCustomValuesFullNames = afterValues.map(v => v.fullName)
      const setCustomValueInactive = (value: PicklistValue): PicklistValue => {
        value.isActive = false
        return value
      }
      return beforeValues
        .filter(v => !afterCustomValuesFullNames.includes(v.fullName))
        .map(v => setCustomValueInactive(v))
    }


    // Handle Custom picklist case
    wu(changes).forEach(c => {
      // Handle custom picklist
      const changedElement = getChangeElement(c)
      if (isModificationDiff(c)) {
        if (isPicklistField(changedElement) && isObjectType(after) && isObjectType(before)) {
          const beforeCustomValues = makeArray(
            c.data.before.annotations[FIELD_ANNOTATIONS.VALUE_SET]
          )
          const afterCustomValues = makeArray(
            c.data.after.annotations[FIELD_ANNOTATIONS.VALUE_SET]
          )
          if (changedElement.annotations[FIELD_ANNOTATIONS.RESTRICTED]) {
            after.fields[(changedElement as Field).name].annotations[FIELD_ANNOTATIONS.VALUE_SET]
              .push(...getRemovedCustomValues(beforeCustomValues, afterCustomValues))
          }
        }
        // Handle Global value set case
        if (isInstanceElement(changedElement)
          && metadataType(changedElement) === GLOBAL_VALUE_SET
          && isInstanceElement(after) && isInstanceElement(before)) {
          const beforeCustomValues = makeArray(
            (c.data.before as InstanceElement).value[CUSTOM_VALUE]
          )
          const afterCustomValues = makeArray(
            (c.data.after as InstanceElement).value[CUSTOM_VALUE]
          )
          after.value[CUSTOM_VALUE]
            .push(...getRemovedCustomValues(beforeCustomValues, afterCustomValues))
        }
      }
    })

    return []
  },
})

export default filterCreator
