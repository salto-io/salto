import _ from 'lodash'
import { Element, Field, isField, isObjectType, ObjectType } from 'adapter-api'
import { MetadataInfo, SaveResult } from 'jsforce'
import { FilterCreator } from '../filter'
import {
  CUSTOM_FIELD, FIELD_ANNOTATIONS, LOOKUP_FILTER_FIELDS, METADATA_TYPE,
} from '../constants'
import { CustomField } from '../client/types'
import { fieldFullName, mapKeysRecursive, sfCase, toCustomField, Types } from '../transformer'

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
    const getCustomFieldNameToCustomFieldMap = async (fieldNames: string[]):
      Promise<Map<string, MetadataInfo>> =>
      new Map((await client.readMetadata(CUSTOM_FIELD, fieldNames)).map(customField =>
        [customField.fullName, customField]))

    const objectFullNameToObjectMap: Map<string, ObjectType> = new Map(elements.filter(isObjectType)
      .map(obj => [obj.elemID.getFullName(), obj]))

    const fieldsWithLookupFilter = _(elements.filter(isObjectType)
      .map(objectType => Object.values(objectType.fields))).flatten()
      .concat(elements.filter(isField))
      .filter(field => field.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER])

    const getCustomFieldName = (field: Field): string =>
      fieldFullName(objectFullNameToObjectMap.get(field.parentID.getFullName()) as ObjectType,
        field)

    const customFieldNames = fieldsWithLookupFilter.map(getCustomFieldName).valueOf()

    const customFieldNameToCustomFieldMap = await
    getCustomFieldNameToCustomFieldMap(customFieldNames)

    const addLookupFilterData = (fieldWithLookupFilter: Field): void => {
      const customFieldLookupFilter = (customFieldNameToCustomFieldMap
        .get(getCustomFieldName(fieldWithLookupFilter)) as CustomField).lookupFilter
      if (customFieldLookupFilter) {
        const isOptional = Boolean(customFieldLookupFilter.isOptional)
        fieldWithLookupFilter.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER] = {
          [LOOKUP_FILTER_FIELDS.ACTIVE]: Boolean(customFieldLookupFilter.active),
          [LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER]: customFieldLookupFilter.booleanFilter,
          [LOOKUP_FILTER_FIELDS.INFO_MESSAGE]: customFieldLookupFilter.infoMessage,
          [LOOKUP_FILTER_FIELDS.IS_OPTIONAL]: isOptional,
          [LOOKUP_FILTER_FIELDS.FILTER_ITEMS]: customFieldLookupFilter.filterItems
            .map(filterItem => ({
              [LOOKUP_FILTER_FIELDS.FIELD]: filterItem.field,
              [LOOKUP_FILTER_FIELDS.OPERATION]: filterItem.operation,
              [LOOKUP_FILTER_FIELDS.VALUE_FIELD]: filterItem.valueField,
            })),
        }
        if (!isOptional) {
          // eslint-disable-next-line max-len
          fieldWithLookupFilter.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER][LOOKUP_FILTER_FIELDS.ERROR_MESSAGE] = customFieldLookupFilter.errorMessage
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
    const beforeFieldNameToFieldWithLookupFilterMap = new Map(getFieldsWithLookupFilter(before)
      .map(field => [field.name, field]))

    const getFieldsToUpdate = (): Field[] =>
      getFieldsWithLookupFilter(after).filter(afterField => {
        const beforeField = beforeFieldNameToFieldWithLookupFilterMap.get(afterField.name)
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
