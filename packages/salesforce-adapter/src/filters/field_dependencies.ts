import _ from 'lodash'
import { Element, Field, ObjectType, Values } from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { FilterCreator } from '../filter'
import {
  FIELD_ANNOTATIONS, FIELD_DEPENDENCY_FIELDS, METADATA_TYPE, VALUE_SETTINGS_FIELDS,
} from '../constants'
import {
  bpCase, mapKeysRecursive, Types,
} from '../transformer'
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
 * Declare the lookupFilters filter, this filter adds the lookupFilter annotation to the
 * lookup & masterDetail fields if needed
 * */
const filterCreator: FilterCreator = ({ client }) => ({

  /**
   * In order to fetch the lookupFilter we should use a different API than in the general flow
   * (i.e. readMetadata())
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const customObjects = getCustomObjects(elements)
    const objectElemID2ApiName = generateObjectElemID2ApiName(customObjects)
    const fieldsWithFieldDependency = _(customObjects)
      .map(obj => getFieldsWithFieldDependency(obj))
      .flatten()
      .value()

    const customFieldNames = fieldsWithFieldDependency
      .map(f => getCustomFieldName(f, objectElemID2ApiName))

    const name2Field = await readCustomFields(client, customFieldNames)

    const fieldDependencyType = Types.primitiveDataTypes.picklist
      .annotationTypes[FIELD_ANNOTATIONS.FIELD_DEPENDENCY] as ObjectType

    const addFieldDependencyData = (field: Field): void => {
      const fieldFromMap = name2Field[getCustomFieldName(field, objectElemID2ApiName)]

      const controllingField = fieldFromMap?.valueSet?.controllingField
      const valueSettingsInfo = fieldFromMap?.valueSet?.valueSettings
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

    const addFieldDependencyElements = (): void => {
      fieldDependencyType.annotate({ [METADATA_TYPE]: 'FieldDependency' })
      fieldDependencyType.path = ['types', 'subtypes', fieldDependencyType.elemID.name]
      const valueSettingsType = fieldDependencyType
        .fields[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS].type
      valueSettingsType.annotate({ [METADATA_TYPE]: 'ValueSettings' })
      valueSettingsType.path = ['types', 'subtypes', valueSettingsType.elemID.name]
      elements.push(...[fieldDependencyType, valueSettingsType])
    }

    fieldsWithFieldDependency.forEach(addFieldDependencyData)
    addFieldDependencyElements()
  },
})

export default filterCreator
