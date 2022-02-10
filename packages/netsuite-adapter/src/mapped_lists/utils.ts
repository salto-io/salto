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
  MapType, isObjectType, createRefToElmWithValue, ListType, isContainerType, ElemID, Value,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { naclCase, transformElement, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { INDEX, LIST_MAPPED_BY_FIELD, SCRIPT_ID } from '../constants'
import { listMappedByFieldMapping } from './mapping'
import { captureServiceIdInfo } from '../service_id_info'

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

export const isMappedList = async (value: Value, field: Field): Promise<boolean> =>
  field.annotations[LIST_MAPPED_BY_FIELD]
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

const convertToList: TransformFunc = async ({ value, field }) => {
  if (field === undefined || !await isMappedList(value, field)) {
    return value
  }

  const fieldType = await field.getType()
  if (isMapType(fieldType)) {
    field.refType = createRefToElmWithValue(new ListType(await fieldType.getInnerType()))
  }

  const objectAsList = _.sortBy(Object.values(value), INDEX)
    .filter(_.isObject)
    .map(item => _.omit(item, INDEX))

  return objectAsList
}

export const convertInstanceMapsToLists = async (
  instance: InstanceElement
): Promise<InstanceElement> =>
  transformElement({
    element: instance,
    transformFunc: convertToList,
    strict: false,
  })
