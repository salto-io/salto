import { Element, Field, ObjectType } from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { FilterCreator } from '../filter'
import { FIELD_ANNOTATIONS, FIELD_DEPENDENCY_FIELDS, VALUE_SETTINGS_FIELDS } from '../constants'
import { bpCase, mapKeysRecursive, Types } from '../transformer'
import { transform } from './convert_types'
import { runOnFields } from './utils'
import { CustomField } from '../client/types'

const { makeArray } = collections.array


/**
 * Declare the field dependency filter, this filter adds the field_dependency annotation to the
 * picklist & multi_picklist fields if needed
 * */
const filterCreator: FilterCreator = ({ client }) => ({

  /**
   * In order to fetch the field_dependency we should use a different API than in the general flow
   * (i.e. readMetadata())
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const addFieldDependencyData = (field: Field, salesforceField: CustomField): void => {
      const fieldDependencyType = Types.primitiveDataTypes.picklist
        .annotationTypes[FIELD_ANNOTATIONS.FIELD_DEPENDENCY] as ObjectType
      const controllingField = salesforceField?.valueSet?.controllingField
      const valueSettingsInfo = salesforceField?.valueSet?.valueSettings
      if (controllingField && valueSettingsInfo) {
        const values = mapKeysRecursive(valueSettingsInfo, bpCase)
        const valueSettings = makeArray(values)
          .map(value => ({
            [VALUE_SETTINGS_FIELDS.VALUE_NAME]: value[VALUE_SETTINGS_FIELDS.VALUE_NAME],
            [VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]:
              makeArray(value[VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]),
          }))
        field.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY] = transform({
          [FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]: controllingField,
          [FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS]: valueSettings,
        }, fieldDependencyType) || {}
      }
    }

    const hasFieldDependency = (field: Field): boolean =>
      field.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY] !== undefined

    await runOnFields(elements, hasFieldDependency, addFieldDependencyData, client)
  },
})

export default filterCreator
