/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import * as pathUtils from 'path'
import truncate from 'truncate-utf8-bytes'
import { hash as hashUtils } from '@salto-io/lowerdash'
import {
  TypeElement,
  ObjectType,
  PrimitiveType,
  isContainerType,
  Field,
  isObjectType,
  isField,
  isListType,
  isMapType,
  ReadOnlyElementsSource,
} from './elements'

// Windows has the lowest known limit, of 255
// This can have an effect at a time we add a ~15 chars suffix
// So we are taking an extra buffer and limit it to 200
export const MAX_PATH_LENGTH = 200
const MAX_PATH_EXTENSION_LENGTH = 20

type SubElementSearchResult = {
  field?: Field
  path: ReadonlyArray<string>
}

export const isIndexPathPart = (key: string): boolean => /^\d+$/.test(key)

export const getDeepInnerType = async (
  type: TypeElement,
  elementsSource?: ReadOnlyElementsSource,
): Promise<ObjectType | PrimitiveType> => {
  if (!isContainerType(type)) {
    return type
  }
  return getDeepInnerType(await type.getInnerType(elementsSource), elementsSource)
}

export const getDeepInnerTypeSync = (type: TypeElement): ObjectType | PrimitiveType => {
  if (!isContainerType(type)) {
    return type
  }
  return getDeepInnerTypeSync(type.getInnerTypeSync())
}

const getSubElement = async (
  baseType: TypeElement,
  pathParts: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<SubElementSearchResult | undefined> => {
  const getChildElement = async (type: TypeElement, key: string): Promise<Field | TypeElement | undefined> => {
    if ((isIndexPathPart(key) && isListType(type)) || isMapType(type)) {
      return type.getInnerType(elementsSource)
    }
    if (isObjectType(type)) return type.fields[key]
    return undefined
  }

  const [curPart, ...restOfParts] = pathParts
  const nextBase = await getChildElement(baseType, curPart)
  if (_.isUndefined(nextBase)) {
    return undefined
  }

  if (_.isEmpty(restOfParts)) {
    return isField(nextBase) ? { field: nextBase, path: [] } : { path: [curPart] }
  }

  const fieldData = isField(nextBase)
    ? // This will fail if not called from the adapters
      await getSubElement(await nextBase.getType(elementsSource), restOfParts, elementsSource)
    : await getSubElement(nextBase, restOfParts, elementsSource)

  if (_.isUndefined(fieldData)) return undefined
  if (fieldData.field) return fieldData
  if (isField(nextBase)) {
    return {
      path: restOfParts,
      field: nextBase,
    }
  }
  return {
    path: pathParts,
  }
}

const getFieldAndPath = async (
  baseType: TypeElement,
  pathParts: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<SubElementSearchResult | undefined> => {
  const fieldData = await getSubElement(baseType, pathParts, elementsSource)
  if (fieldData && fieldData.field) {
    return fieldData
  }
  return undefined
}

export const getField = async (
  baseType: TypeElement,
  pathParts: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<Field | undefined> => (await getFieldAndPath(baseType, pathParts, elementsSource))?.field

export const getFieldType = async (
  baseType: TypeElement,
  path: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<TypeElement | undefined> => {
  const getFieldInternalType = async (
    fieldType: TypeElement,
    pathParts: ReadonlyArray<string>,
  ): Promise<TypeElement | undefined> => {
    const [curPart, ...restOfParts] = pathParts
    if (_.isEmpty(curPart)) {
      return fieldType
    }
    if ((isIndexPathPart(curPart) && isListType(fieldType)) || isMapType(fieldType)) {
      return getFieldInternalType(await fieldType.getInnerType(elementsSource), restOfParts)
    }
    return undefined
  }
  const fieldData = await getFieldAndPath(baseType, path, elementsSource)
  // This will fail if not called from the adapters
  return fieldData?.field && getFieldInternalType(await fieldData.field.getType(elementsSource), fieldData.path)
}

export const getFieldNames = async (
  refType: ObjectType,
  path: string[],
  elementsSource?: ReadOnlyElementsSource,
): Promise<string[]> => {
  if (_.isEmpty(path)) {
    return _.keys(refType.fields)
  }
  const fieldType = await getFieldType(refType, path, elementsSource)
  if (isObjectType(fieldType)) {
    return _.keys(fieldType.fields)
  }
  return []
}

// Trim part of a file name to comply with filesystem restrictions
// This assumes the filesystem does not allow path parts to be over
// MAX_PATH_LENGTH long in byte length
export const normalizeFilePathPart = (name: string): string => {
  if (Buffer.byteLength(name) <= MAX_PATH_LENGTH) {
    return name
  }
  const nameHash = hashUtils.toMD5(name)
  let extension = pathUtils.extname(name)
  if (extension.length > MAX_PATH_EXTENSION_LENGTH || Buffer.byteLength(extension) !== extension.length) {
    // Heuristic guess - a valid extension must be short and ascii
    extension = ''
  }
  const suffix = `_${nameHash}${extension}`
  return truncate(name, MAX_PATH_LENGTH - suffix.length).concat(suffix)
}
