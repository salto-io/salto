import wu from 'wu'
import { collections } from '@salto/lowerdash'
import {
  Element, Field, isObjectType, Change, getChangeElement,
  isField, isModificationDiff, ChangeDataType, isInstanceElement,
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
 */
const filterCreator = (): FilterWith<'onUpdate'> => ({
  onUpdate: async (before: Element, after: Element, changes: ReadonlyArray<Change>):
    Promise<SaveResult[]> => {
    const isRestrictedPicklistField = (
      changedElement: ChangeDataType
    ): changedElement is Field =>
      isField(changedElement)
      && ([
        Types.primitiveDataTypes.Picklist.elemID.getFullName(),
        Types.primitiveDataTypes.MultiselectPicklist.elemID.getFullName(),
      ]).includes(changedElement.type.elemID.getFullName())
      && Boolean(changedElement.annotations[FIELD_ANNOTATIONS.RESTRICTED])

    const isInstanceGlobalSetValue = (changedElement: ChangeDataType): boolean =>
      isInstanceElement(changedElement)
      && metadataType(changedElement) === GLOBAL_VALUE_SET

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

    wu(changes)
      .forEach(c => {
        if (isModificationDiff(c)) {
          const changedElement = getChangeElement(c)
          if (isRestrictedPicklistField(changedElement)
          && isObjectType(after)
          && isObjectType(before)) {
            const beforeCustomValues = makeArray(
              c.data.before.annotations[FIELD_ANNOTATIONS.VALUE_SET]
            )
            const afterCustomValues = makeArray(
              c.data.after.annotations[FIELD_ANNOTATIONS.VALUE_SET]
            )
            after.fields[changedElement.name].annotations[FIELD_ANNOTATIONS.VALUE_SET]
              .push(...getRemovedCustomValues(beforeCustomValues, afterCustomValues))
          }

          if (isInstanceGlobalSetValue(changedElement)
            && isInstanceElement(after) && isInstanceElement(before)) {
            const beforeCustomValues = makeArray(before.value[CUSTOM_VALUE])
            const afterCustomValues = makeArray(after.value[CUSTOM_VALUE])
            after.value[CUSTOM_VALUE]
              .push(...getRemovedCustomValues(beforeCustomValues, afterCustomValues))
          }
        }
      })

    return []
  },
})

export default filterCreator
