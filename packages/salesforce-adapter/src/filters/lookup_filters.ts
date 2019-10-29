import _ from 'lodash'
import wu from 'wu'
import { Element, Field, isObjectType, ObjectType } from 'adapter-api'
import { SaveResult } from 'jsforce'
import { FilterCreator } from '../filter'
import {
  CUSTOM_FIELD, CUSTOM_OBJECT, FIELD_ANNOTATIONS, LOOKUP_FILTER_FIELDS, METADATA_TYPE,
} from '../constants'
import { CustomField } from '../client/types'
import {
  bpCase, fieldFullName, mapKeysRecursive, metadataType, sfCase, toCustomField, Types,
} from '../transformer'

const getFieldsWithLookupFilter = (obj: ObjectType): Field[] =>
  Object.values(obj.fields).filter(field => (field.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER]))

const createCustomFieldWithLookupFilter = (obj: ObjectType, fieldWithLookupFilter: Field):
  CustomField => {
  const customField = toCustomField(obj, fieldWithLookupFilter, true)
  _.assign(customField, mapKeysRecursive(_.pickBy(fieldWithLookupFilter.annotations,
    (_val, annotationValue) => (annotationValue === FIELD_ANNOTATIONS.LOOKUP_FILTER)),
  key => sfCase(key, false, false)))
  return customField
}

/**
 * Declare the lookupFilters filter, this filter adds the lookupFilter annotation to the
 * lookup & masterDetail fields if needed
 * */
const filterCreator: FilterCreator = ({ client }) => ({

  /**
   * In order to discover the lookupFilter we should use a different API than in the general flow
   * (i.e. readMetadata())
   * @param elements the already discovered elements
   */
  onDiscover: async (elements: Element[]): Promise<void> => {
    const readCustomFields = async (fieldNames: string[]): Promise<Record<string, CustomField>> => (
      _(await client.readMetadata(CUSTOM_FIELD, fieldNames))
        .map(field => [field.fullName, field])
        .fromPairs()
        .value()
    )

    const customObjectElements = wu(elements)
      .filter(isObjectType)
      .filter(element => metadataType(element) === CUSTOM_OBJECT)
      .toArray()

    const objectFullNameToObjectMap: Record<string, ObjectType> = _(customObjectElements)
      .map(obj => [obj.elemID.getFullName(), obj])
      .fromPairs()
      .value()

    const fieldsWithLookupFilter = _(customObjectElements)
      .map(obj => getFieldsWithLookupFilter(obj as ObjectType))
      .flatten()
      .value()

    const getCustomFieldName = (field: Field): string =>
      fieldFullName(objectFullNameToObjectMap[field.parentID.getFullName()], field)

    const customFieldNames = fieldsWithLookupFilter.map(getCustomFieldName)

    const customFieldNameToCustomFieldMap = await readCustomFields(customFieldNames)

    const addLookupFilterData = (fieldWithLookupFilter: Field): void => {
      const customFieldLookupFilter = customFieldNameToCustomFieldMap[
        getCustomFieldName(fieldWithLookupFilter)].lookupFilter
      if (customFieldLookupFilter) {
        _.assign(fieldWithLookupFilter.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER],
          mapKeysRecursive(customFieldLookupFilter, bpCase))
        if (customFieldLookupFilter.isOptional) {
          // eslint-disable-next-line max-len
          delete fieldWithLookupFilter.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER][LOOKUP_FILTER_FIELDS.ERROR_MESSAGE]
        }
      }
    }

    const addLookupFilterElement = (): void => {
      const lookupFilterElement = Types.salesforceDataTypes.lookup
        .annotationTypes[FIELD_ANNOTATIONS.LOOKUP_FILTER]
      lookupFilterElement.annotate({ [METADATA_TYPE]: 'LookupFilter' })
      lookupFilterElement.path = ['types', 'subtypes', lookupFilterElement.elemID.name]

      elements.push(...[lookupFilterElement])
    }

    fieldsWithLookupFilter.forEach(addLookupFilterData)
    addLookupFilterElement()
  },

  /**
   * In Salesforce you can't add a lookup/masterdetail relationship with a lookupFilter upon
   * the field's creation (and thus also upon an object creation).
   * Thus, we need to first create the field and then update it using filter
   */
  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (!isObjectType(after)) {
      return []
    }
    const customFieldsWithLookupFilter = getFieldsWithLookupFilter(after)
      .map(fieldWithLookupFilter =>
        createCustomFieldWithLookupFilter(after, fieldWithLookupFilter))
    if (customFieldsWithLookupFilter && customFieldsWithLookupFilter.length > 0) {
      return client.update(CUSTOM_FIELD, Array.from(customFieldsWithLookupFilter.values()))
    }
    return []
  },

  /**
   * In Salesforce you can't add a lookup/masterdetail relationship with a lookupFilter upon
   * the field's creation. Thus, we need to first create the field and then update it using filter
   */
  onUpdate: async (before: Element, after: Element):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after))) {
      return []
    }
    const beforeFieldNameToFieldWithLookupFilterMap = _(getFieldsWithLookupFilter(before))
      .map(field => [field.name, field])
      .fromPairs()
      .value()

    const getFieldsToUpdate = (): Field[] =>
      getFieldsWithLookupFilter(after).filter(afterField => {
        const beforeField = beforeFieldNameToFieldWithLookupFilterMap[afterField.name]
        return beforeField === undefined
          || !_.isEqual(beforeField.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER],
            afterField.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER])
      })
    const customFieldsWithLookupFilter = getFieldsToUpdate().map(fieldWithLookupFilter =>
      createCustomFieldWithLookupFilter(after, fieldWithLookupFilter))
    if (customFieldsWithLookupFilter && customFieldsWithLookupFilter.length > 0) {
      return client.update(CUSTOM_FIELD, Array.from(customFieldsWithLookupFilter.values()))
    }
    return []
  },
})

export default filterCreator
