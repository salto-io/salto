import _ from 'lodash'
import { Element, Field, ObjectType, Values } from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { FilterCreator } from '../filter'
import {
  FIELD_ANNOTATIONS, FIELD_DEPENDENCY_FIELDS, VALUE_SETTINGS_FIELDS,
} from '../constants'
import {
  bpCase, mapKeysRecursive, Types,
} from '../transformers/transformer'
import { transform } from './convert_types'
import {
  generateObjectElemID2ApiName, getCustomFieldName, getCustomObjects, readCustomFields,
} from './utils'

const { makeArray } = collections.array

const getFieldDependency = (field: Field): Values =>
  field.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]

const hasFieldDependency = (field: Field): boolean =>
  getFieldDependency(field) !== undefined

const getFieldsWithFieldDependency = (obj: ObjectType): Field[] =>
  Object.values(obj.fields).filter(hasFieldDependency)

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
    const customObjects = getCustomObjects(elements)
    const objectElemID2ApiName = generateObjectElemID2ApiName(customObjects)
    const fieldsWithFieldDependency = _(customObjects)
      .map(getFieldsWithFieldDependency)
      .flatten()
      .value()

    const customFieldNames = fieldsWithFieldDependency
      .map(f => getCustomFieldName(f, objectElemID2ApiName))

    const name2Field = await readCustomFields(client, customFieldNames)

    const fieldDependencyType = Types.primitiveDataTypes.picklist
      .annotationTypes[FIELD_ANNOTATIONS.FIELD_DEPENDENCY] as ObjectType

    const addFieldDependencyData = (field: Field): void => {
      const salesforceField = name2Field[getCustomFieldName(field, objectElemID2ApiName)]

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

    fieldsWithFieldDependency.forEach(addFieldDependencyData)
  },
})

export default filterCreator
