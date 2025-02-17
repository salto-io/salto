/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Values,
  InstanceElement,
  isMapType,
  ObjectType,
  isField,
  isListType,
  Field,
  MapType,
  isObjectType,
  isContainerType,
  ElemID,
  Value,
  BuiltinTypes,
  Element,
  ChangeDataType,
  isInstanceElement,
  TypeElement,
  FieldDefinition,
  ListType,
  TypeReference,
} from '@salto-io/adapter-api'
import {
  invertNaclCase,
  naclCase,
  transformElement,
  transformElementAnnotations,
  TransformFunc,
  transformValues,
} from '@salto-io/adapter-utils'
import { collections, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { INDEX, LIST_MAPPED_BY_FIELD, SCRIPT_ID } from '../constants'
import { dataTypesToConvert, listMappedByFieldMapping, mapsWithoutIndex } from './mapping'
import { captureServiceIdInfo } from '../service_id_info'
import { getStandardTypes, isStandardTypeName } from '../autogen/types'
import { isCustomRecordType } from '../types'
import { toAnnotationRefTypes } from '../custom_records/custom_record_type'

const { mapValuesAsync } = promises.object
const { awu } = collections.asynciterable
const { makeArray } = collections.array

const log = logger(module)

export type MappedList = {
  field: Field
  path: ElemID
  value: Values
}

export const validateTypesFieldMapping = (elements: ObjectType[]): void => {
  const typesMap = _.keyBy(elements, element => element.elemID.name)
  const validateType = (typeName: string): void => {
    const type = typesMap[typeName]
    if (type === undefined) {
      throw new Error(`type '${typeName}' should have mapping field but '${typeName}' is not in elements`)
    }
  }
  Object.entries(listMappedByFieldMapping).forEach(([typeName, fieldNameList]) => {
    validateType(typeName)
    makeArray(fieldNameList).forEach(fieldName => {
      if (typesMap[typeName].fields[fieldName] === undefined) {
        throw new Error(
          `type '${typeName}' should have mapping field '${fieldName}' but '${typeName}' has no '${fieldName}' field`,
        )
      }
    })
  })
  mapsWithoutIndex.forEach(validateType)
}

const shouldAddIndex = (type: TypeElement | TypeReference): boolean => !mapsWithoutIndex.has(type.elemID.name)

export const convertFieldsTypesFromListToMap = async (element: ObjectType): Promise<void> => {
  await awu(Object.entries(element.fields)).forEach(async ([fieldName, field]) => {
    const fieldType = await field.getType()
    if (!isListType(fieldType)) {
      return
    }

    const innerType = await fieldType.getInnerType()
    if (!isObjectType(innerType)) {
      return
    }

    const listMappedByField =
      listMappedByFieldMapping[innerType.elemID.name] ?? (isField(innerType.fields.scriptid) ? SCRIPT_ID : undefined)
    if (listMappedByField === undefined) {
      return
    }

    const newField = new Field(field.parent, field.name, new MapType(innerType), {
      ...field.annotations,
      [LIST_MAPPED_BY_FIELD]: listMappedByField,
    })
    element.fields[fieldName] = newField
    if (shouldAddIndex(innerType)) {
      innerType.fields[INDEX] = new Field(innerType, INDEX, BuiltinTypes.NUMBER)
    }
  })
}

const getItemKey = (mapFieldValue: string): string => {
  const naclCaseKey = naclCase(mapFieldValue)
  if (mapFieldValue === naclCaseKey) {
    return mapFieldValue
  }
  const serviceIdInfoList = captureServiceIdInfo(mapFieldValue)
  return serviceIdInfoList.length === 0
    ? naclCaseKey
    : naclCase(serviceIdInfoList.map(serviceIdInfo => serviceIdInfo.serviceId).join('_'))
}

const addSuffixUntilUnique = (keyName: string, keySet: Set<string>, path?: ElemID, suffixIndex = 2): string => {
  const keyNameWithSuffix = naclCase(`${invertNaclCase(keyName)}_${suffixIndex}`)
  if (keySet.has(keyNameWithSuffix)) {
    return addSuffixUntilUnique(keyName, keySet, path, suffixIndex + 1)
  }
  log.debug(`adding suffix to key: '${keyName}' -> '${keyNameWithSuffix}' (${path?.getFullName()})`)
  return keyNameWithSuffix
}

const getUniqueItemKey = (item: Value, mapFieldNameList: string[], keySet: Set<string>, path?: ElemID): string => {
  // types may have more than one optional mapping field (see 'centercategory_links_link' in
  // mapping.ts) so we're taking the first to be defined
  const mapFieldName = mapFieldNameList.find(fieldName => item[fieldName] !== undefined)
  if (mapFieldName === undefined) {
    log.warn(`item in ${path?.getFullName()} has no mapFieldName key: ${mapFieldNameList.join(',')}`)
  }

  const mapFieldValue = getItemKey(mapFieldName ? _.toString(item[mapFieldName]) : 'key')

  if (!keySet.has(mapFieldValue)) {
    keySet.add(mapFieldValue)
    return mapFieldValue
  }

  const mapFieldValueWithSuffix = addSuffixUntilUnique(mapFieldValue, keySet, path)
  keySet.add(mapFieldValueWithSuffix)
  return mapFieldValueWithSuffix
}

const transformMappedLists: TransformFunc = async ({ value, field, path }) => {
  const mapFieldNameList = makeArray(field?.annotations[LIST_MAPPED_BY_FIELD])
  const fieldType = await field?.getType()
  if (!_.isArray(value) || _.isEmpty(mapFieldNameList) || !isMapType(fieldType)) {
    return value
  }
  const withIndex = shouldAddIndex(fieldType.refInnerType)
  const keySet: Set<string> = new Set()
  return _(value)
    .map((item, index) => ({ ...item, ...(withIndex ? { [INDEX]: index } : {}) }))
    .keyBy(item => getUniqueItemKey(item, mapFieldNameList, keySet, path))
    .value()
}

export const convertInstanceListsToMaps = async (instance: InstanceElement): Promise<Values | undefined> =>
  transformValues({
    values: instance.value,
    type: await instance.getType(),
    pathID: instance.elemID,
    transformFunc: transformMappedLists,
    strict: false,
  })

export const convertAnnotationListsToMaps = async (element: Element): Promise<Values> =>
  transformElementAnnotations({
    element,
    transformFunc: transformMappedLists,
    strict: false,
  })

export const isMappedList = async (value: Value, field: Field): Promise<boolean> =>
  _.isPlainObject(value) &&
  isContainerType(await field.getType()) &&
  (field.annotations[LIST_MAPPED_BY_FIELD] || value[LIST_MAPPED_BY_FIELD])

export const getMappedLists = async (instance: InstanceElement): Promise<MappedList[]> => {
  const mappedLists: MappedList[] = []
  const lookForMappedLists: TransformFunc = async ({ value, field, path }) => {
    if (path && field && (await isMappedList(value, field))) {
      mappedLists.push({ field, path, value })
    }
    return value
  }

  // used to look for the mapped lists without actual transforming any value
  await transformValues({
    values: instance.value,
    type: await instance.getType(),
    pathID: instance.elemID,
    transformFunc: lookForMappedLists,
    strict: false,
  })

  return mappedLists
}

export const convertDataInstanceMapsToLists = async (instance: InstanceElement): Promise<InstanceElement> => {
  const typeWithFields = (type: ObjectType, fields: Record<string, FieldDefinition>): ObjectType =>
    new ObjectType({
      elemID: type.elemID,
      annotationRefsOrTypes: type.annotationRefTypes,
      annotations: type.annotations,
      fields,
    })

  const convertDataTypeFieldsToLists = async (type: ObjectType): Promise<ObjectType> =>
    typeWithFields(
      type,
      await mapValuesAsync(type.fields, async field => {
        const fieldType = await field.getType()
        return {
          annotations: field.annotations,
          refType:
            isMapType(fieldType) && field.annotations[LIST_MAPPED_BY_FIELD]
              ? new ListType(fieldType.refInnerType)
              : fieldType,
        }
      }),
    )

  const convertDataType = async (type: ObjectType): Promise<ObjectType> =>
    typeWithFields(
      type,
      await mapValuesAsync(type.fields, async field => {
        const fieldType = await field.getType()
        return {
          annotations: field.annotations,
          refType:
            isObjectType(fieldType) && dataTypesToConvert.has(fieldType.elemID.name)
              ? await convertDataTypeFieldsToLists(fieldType)
              : field.refType,
        }
      }),
    )

  return transformElement({
    element: new InstanceElement(
      instance.elemID.name,
      await convertDataType(await instance.getType()),
      instance.value,
      undefined,
      instance.annotations,
    ),
    transformFunc: async ({ value, field }) =>
      field !== undefined && (await isMappedList(value, field)) ? Object.values(value) : value,
    strict: false,
  })
}

// We use hardcoded types when running transformMapsToLists,
// so the fields don't have the `map_key_field` annotation.
// Because of that, we add that annotation on the mapped list itself.
const setListMappedByFieldToValue = <T extends ChangeDataType>(element: T): Promise<T> =>
  transformElement({
    element,
    transformFunc: async ({ value, field }) =>
      field !== undefined && (await isMappedList(value, field))
        ? { ...value, [LIST_MAPPED_BY_FIELD]: field.annotations[LIST_MAPPED_BY_FIELD] }
        : value,
    strict: false,
  })

const transformMapsToLists = (element: ChangeDataType): Promise<ChangeDataType> =>
  transformElement({
    element,
    transformFunc: async ({ value, field }) =>
      field !== undefined && (await isMappedList(value, field))
        ? _.sortBy(
            // Removing the `map_key_field` annotation that was used to identify the mapped list.
            Object.values(_.omit(value, [LIST_MAPPED_BY_FIELD])),
            [INDEX, value[LIST_MAPPED_BY_FIELD]].flat(),
          ).map(item => (_.isObject(item) ? _.omit(item, INDEX) : item))
        : value,
    strict: false,
  })

export const createConvertStandardElementMapsToLists = async (): Promise<
  (element: ChangeDataType) => Promise<ChangeDataType>
> => {
  // Using hardcoded types so the transformed elements will have fields with List<> ref types.
  const standardTypes = getStandardTypes()
  const customRecordTypeAnnotationRefTypes = toAnnotationRefTypes(standardTypes.customrecordtype.type)

  return async element => {
    if (isInstanceElement(element) && isStandardTypeName(element.elemID.typeName)) {
      return transformMapsToLists(
        new InstanceElement(
          element.elemID.name,
          standardTypes[element.elemID.typeName].type,
          (await setListMappedByFieldToValue(element)).value,
        ),
      )
    }
    if (isObjectType(element) && isCustomRecordType(element)) {
      return transformMapsToLists(
        new ObjectType({
          elemID: element.elemID,
          fields: element.fields,
          annotationRefsOrTypes: customRecordTypeAnnotationRefTypes,
          annotations: (await setListMappedByFieldToValue(element)).annotations,
        }),
      )
    }
    return Promise.resolve(element)
  }
}
