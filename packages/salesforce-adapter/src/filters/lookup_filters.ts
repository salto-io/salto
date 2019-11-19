import _ from 'lodash'
import wu from 'wu'
import { Element, Field, isObjectType, ObjectType, Change, getChangeElement,
  isField, Values } from 'adapter-api'
import { SaveResult } from 'jsforce'
import { collections } from '@salto/lowerdash'
import { FilterCreator } from '../filter'
import {
  CUSTOM_FIELD, FIELD_ANNOTATIONS, LOOKUP_FILTER_FIELDS, METADATA_TYPE,
} from '../constants'
import { CustomField } from '../client/types'
import {
  bpCase, fieldFullName, mapKeysRecursive, sfCase, toCustomField, Types,
  isCustomObject,
} from '../transformer'
import { transform } from './convert_types'

const { makeArray } = collections.array

const getLookupFilter = (field: Field): Values =>
  field.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER]

const hasLookupFilter = (field: Field): boolean =>
  getLookupFilter(field) !== undefined

const getFieldsWithLookupFilter = (obj: ObjectType): Field[] =>
  Object.values(obj.fields).filter(hasLookupFilter)

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
   * In order to fetch the lookupFilter we should use a different API than in the general flow
   * (i.e. readMetadata())
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const lookupFilterType = Types.primitiveDataTypes.lookup
      .annotationTypes[FIELD_ANNOTATIONS.LOOKUP_FILTER] as ObjectType

    const readCustomFields = async (fieldNames: string[]): Promise<Record<string, CustomField>> => (
      _(await client.readMetadata(CUSTOM_FIELD, fieldNames))
        .map(field => [field.fullName, field])
        .fromPairs()
        .value()
    )

    const customObjectElements = wu(elements)
      // using single filter as wu is not preserving type information
      .filter(e => isObjectType(e) && isCustomObject(e))
      .toArray() as ObjectType[]

    const objectFullNameToObjectMap: Record<string, ObjectType> = _(customObjectElements)
      .map(obj => [obj.elemID.getFullName(), obj])
      .fromPairs()
      .value()

    const fieldsWithLookupFilter = _(customObjectElements)
      .map(obj => getFieldsWithLookupFilter(obj))
      .flatten()
      .value()

    const getCustomFieldName = (field: Field): string =>
      fieldFullName(objectFullNameToObjectMap[field.parentID.getFullName()], field)

    const customFieldNames = fieldsWithLookupFilter.map(getCustomFieldName)

    const name2Field = await readCustomFields(customFieldNames)

    const addLookupFilterData = (fieldWithLookupFilter: Field): void => {
      const { FILTER_ITEMS, ERROR_MESSAGE, IS_OPTIONAL } = LOOKUP_FILTER_FIELDS
      const fieldFromMap = name2Field[getCustomFieldName(fieldWithLookupFilter)]
      const lookupFilterInfo = fieldFromMap?.lookupFilter
      if (lookupFilterInfo) {
        const values = mapKeysRecursive(lookupFilterInfo, bpCase)
        values[FILTER_ITEMS] = makeArray(values[FILTER_ITEMS])
        const lookupFilter = transform(values, lookupFilterType) || {}
        if (lookupFilter[IS_OPTIONAL]) {
          delete lookupFilter[ERROR_MESSAGE]
        }
        fieldWithLookupFilter.annotations[FIELD_ANNOTATIONS.LOOKUP_FILTER] = lookupFilter
      }
    }

    const addLookupFilterElement = (): void => {
      lookupFilterType.annotate({ [METADATA_TYPE]: 'LookupFilter' })
      lookupFilterType.path = ['types', 'subtypes', lookupFilterType.elemID.name]
      elements.push(...[lookupFilterType])
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
      return client.update(CUSTOM_FIELD, customFieldsWithLookupFilter)
    }
    return []
  },

  /**
   * In Salesforce you can't add a lookup/masterdetail relationship with a lookupFilter upon
   * the field's creation. Thus, we need to first create the field and then update it using filter
   */
  onUpdate: async (before: Element, after: Element, changes: ReadonlyArray<Change>):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after))) {
      return []
    }

    const fieldsToUpdate = changes
      .filter(c => isField(getChangeElement(c)))
      .map(c => [_.get(c.data, 'before'), _.get(c.data, 'after')])
      .filter(([b, a]) => !_.isEqual(b ? getLookupFilter(b) : undefined,
        a ? getLookupFilter(a) : undefined))
      .map(([_b, a]) => a)
      .filter(f => f)

    if (fieldsToUpdate.length > 0) {
      return client.update(CUSTOM_FIELD, fieldsToUpdate
        .map(field => createCustomFieldWithLookupFilter(after, field)))
    }

    return []
  },
})

export default filterCreator
