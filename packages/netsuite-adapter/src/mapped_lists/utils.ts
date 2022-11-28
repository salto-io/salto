/*
*                      Copyright 2022 Salto Labs Ltd.
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
import {
  Values, InstanceElement, isMapType, ObjectType, isField, isListType, Field,
  MapType, isObjectType, createRefToElmWithValue, isContainerType, ElemID, Value,
  BuiltinTypes, Element, ChangeDataType, isInstanceElement, TypeRefMap,
} from '@salto-io/adapter-api'
import { naclCase, transformElement, transformElementAnnotations, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { INDEX, LIST_MAPPED_BY_FIELD, SCRIPT_ID } from '../constants'
import { listMappedByFieldMapping } from './mapping'
import { captureServiceIdInfo } from '../service_id_info'
import { getStandardTypes, isStandardTypeName } from '../autogen/types'
import { isCustomRecordType } from '../types'
import { toAnnotationRefTypes } from '../custom_records/custom_record_type'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const log = logger(module)

export type MappedList = {
  path: ElemID
  value: Values
}

export const validateTypesFieldMapping = (elements: ObjectType[]): void => {
  const typesMap = _.keyBy(elements, element => element.elemID.name)
  Object.entries(listMappedByFieldMapping).forEach(([typeName, fieldNameList]) => {
    const type = typesMap[typeName]
    if (type === undefined) {
      log.error(`type '${typeName}' should have mapping field but '${typeName}' is not in elements`)
      throw new Error('missing some types with field mapping')
    }
    makeArray(fieldNameList).forEach(fieldName => {
      if (type.fields[fieldName] === undefined) {
        log.error(`type '${typeName}' should have mapping field '${fieldName}' but '${typeName}' has no '${fieldName}' field`)
        throw new Error('missing some types with field mapping')
      }
    })
  })
}

export const convertFieldsTypesFromListToMap = async (
  element: ObjectType,
): Promise<void> => {
  await awu(Object.entries(element.fields)).forEach(async ([fieldName, field]) => {
    const fieldType = await field.getType()
    if (!isListType(fieldType)) {
      return
    }

    const innerType = await fieldType.getInnerType()
    if (!isObjectType(innerType)) {
      return
    }

    const listMappedByField = listMappedByFieldMapping[innerType.elemID.name]
      ?? (isField(innerType.fields.scriptid)
        ? SCRIPT_ID
        : undefined)
    if (listMappedByField === undefined) {
      log.warn(`there's no field to map by in ${innerType.elemID.getFullName()}`)
      return
    }

    const newField = new Field(
      field.parent,
      field.name,
      createRefToElmWithValue(new MapType(innerType)),
      { ...field.annotations, [LIST_MAPPED_BY_FIELD]: listMappedByField }
    )
    element.fields[fieldName] = newField
    innerType.fields[INDEX] = new Field(
      innerType,
      INDEX,
      createRefToElmWithValue(BuiltinTypes.NUMBER)
    )
  })
}

const getItemKey = (mapFieldValue: string, path?: ElemID): string => {
  const naclCaseKey = naclCase(mapFieldValue)
  if (mapFieldValue === naclCaseKey) {
    return mapFieldValue
  }

  const serviceIdInfoList = captureServiceIdInfo(mapFieldValue)
  if (serviceIdInfoList.length === 0) {
    log.debug(`fixing mapFieldValue to use it as a key: '${mapFieldValue}' -> '${naclCaseKey}' (${path?.getFullName()})`)
    return naclCaseKey
  }

  const serviceIdKey = naclCase(
    serviceIdInfoList.map(serviceIdInfo => serviceIdInfo.serviceId).join('_')
  )
  log.debug(`extracting ${SCRIPT_ID} to use it as a key: '${mapFieldValue}' -> '${serviceIdKey}' (${path?.getFullName()})`)
  return serviceIdKey
}

const addSuffixUntilUnique = (
  keyName: string,
  keySet: Set<string>,
  path?: ElemID,
  suffixIndex = 2,
): string => {
  const keyNameWithSuffix = `${keyName}_${suffixIndex}`
  if (keySet.has(keyNameWithSuffix)) {
    return addSuffixUntilUnique(keyName, keySet, path, suffixIndex + 1)
  }
  log.debug(`adding suffix to key: '${keyName}' -> '${keyNameWithSuffix}' (${path?.getFullName()})`)
  return keyNameWithSuffix
}

const getUniqueItemKey = (
  item: Value,
  mapFieldNameList: string[],
  keySet: Set<string>,
  path?: ElemID,
): string => {
  // types may have more than one optional mapping field (see 'centercategory_links_link' in
  // mapping.ts) so we're taking the first to be defined
  const mapFieldName = mapFieldNameList.find(fieldName => item[fieldName] !== undefined)
  if (mapFieldName === undefined) {
    log.warn(`item in ${path?.getFullName()} has no mapFieldName key: ${mapFieldNameList.join(',')}`)
  }

  const mapFieldValue = getItemKey(
    mapFieldName ? _.toString(item[mapFieldName]) : 'key',
    path
  )

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
  if (!_.isArray(value) || _.isEmpty(mapFieldNameList) || !isMapType(await field?.getType())) {
    return value
  }

  const keySet: Set<string> = new Set()
  return _(value)
    .map((item, index) => ({ ...item, [INDEX]: index }))
    .keyBy(item => getUniqueItemKey(item, mapFieldNameList, keySet, path))
    .value()
}

export const convertInstanceListsToMaps = async (
  instance: InstanceElement
): Promise<Values | undefined> =>
  transformValues({
    values: instance.value,
    type: await instance.getType(),
    pathID: instance.elemID,
    transformFunc: transformMappedLists,
    strict: false,
  })

export const convertAnnotationListsToMaps = async (
  element: Element
): Promise<Values> =>
  transformElementAnnotations({
    element,
    transformFunc: transformMappedLists,
    strict: false,
  })

export const isMappedList = async (
  value: Value,
  field: Field,
  mapKeyFieldsIndex?: Record<string, string | string[]>,
): Promise<boolean> =>
  (mapKeyFieldsIndex === undefined
    ? field.annotations[LIST_MAPPED_BY_FIELD]
    : mapKeyFieldsIndex[field.elemID.getFullName()])
  && _.isPlainObject(value)
  && isContainerType(await field.getType())

export const getMappedLists = async (
  instance: InstanceElement
): Promise<MappedList[]> => {
  const mappedLists: MappedList[] = []
  const lookForMappedLists: TransformFunc = async ({ value, field, path }) => {
    if (path && field && await isMappedList(value, field)) {
      mappedLists.push({ path, value })
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

export const createConvertElementMapsToLists = async (
  elementsSourceIndexes: LazyElementsSourceIndexes
): Promise<(
  element: ChangeDataType
) => Promise<ChangeDataType>> => {
  // using hardcoded types so the transformed elements will have fields with List<> ref types.
  const standardTypes = getStandardTypes()
  const { mapKeyFieldsIndex } = await elementsSourceIndexes.getIndexes()

  let cachedCustomRecordTypeAnnotationRefTypes: TypeRefMap
  const customRecordTypeAnnotationRefTypes = async (): Promise<TypeRefMap> => {
    if (cachedCustomRecordTypeAnnotationRefTypes === undefined) {
      cachedCustomRecordTypeAnnotationRefTypes = await toAnnotationRefTypes(standardTypes.customrecordtype.type)
    }
    return cachedCustomRecordTypeAnnotationRefTypes
  }

  const convertToList: TransformFunc = async ({ value, field }) => (
    field !== undefined && await isMappedList(value, field, mapKeyFieldsIndex)
      ? _.sortBy(
        Object.values(value),
        [INDEX, mapKeyFieldsIndex[field.elemID.getFullName()]].flat()
      ).filter(_.isObject).map(item => _.omit(item, INDEX))
      : value
  )

  return async (
    element: ChangeDataType
  ): Promise<ChangeDataType> => {
    if (isInstanceElement(element) && isStandardTypeName(element.refType.elemID.name)) {
      return transformElement({
        element: new InstanceElement(
          element.elemID.name,
          standardTypes[element.refType.elemID.name].type,
          element.value,
        ),
        transformFunc: convertToList,
        strict: false,
      })
    }
    if (isObjectType(element) && isCustomRecordType(element)) {
      return transformElement({
        element: new ObjectType({
          elemID: element.elemID,
          fields: _.mapValues(
            element.fields,
            ({ refType, annotations }) => ({ refType, annotations })
          ),
          annotationRefsOrTypes: await customRecordTypeAnnotationRefTypes(),
          annotations: element.annotations,
        }),
        transformFunc: convertToList,
        strict: false,
      })
    }
    return element
  }
}
