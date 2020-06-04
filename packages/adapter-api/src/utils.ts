/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  TypeElement, Field, ObjectType, Element, PrimitiveType, ListType,
  isListType, isObjectType, isField,
} from './elements'
import { Values } from './values'

interface AnnoRef {
  annoType?: TypeElement
  annoName?: string
}

type SubElementSearchResult = {
  field?: Field
  path: string[]
}

export const isIndexPathPart = (key: string): boolean => !Number.isNaN(Number(key))

export const getDeepInnerType = (listType: ListType): ObjectType | PrimitiveType => {
  const { innerType } = listType
  if (!isListType(innerType)) {
    return innerType
  }
  return getDeepInnerType(innerType)
}

export const getSubElement = (
  baseType: TypeElement,
  pathParts: string[]
): SubElementSearchResult | undefined => {
  const getChildElement = (source: TypeElement, key: string): Field | TypeElement| undefined => {
    if (isIndexPathPart(key) && isListType(source)) {
      return source.innerType
    }
    if (source.annotationTypes[key]) return source.annotationTypes[key]
    if (isObjectType(source)) return source.fields[key]
    return undefined
  }

  const [curPart, ...restOfParts] = pathParts
  const nextBase = getChildElement(baseType, curPart)
  if (_.isUndefined(nextBase)) {
    return undefined
  }

  if (_.isEmpty(restOfParts)) {
    return isField(nextBase) ? { field: nextBase, path: [] } : { path: [curPart] }
  }

  const fieldData = isField(nextBase)
    ? getSubElement(nextBase.type, restOfParts)
    : getSubElement(nextBase, restOfParts)

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

export const getField = (
  baseType: TypeElement,
  pathParts: string[]
): SubElementSearchResult | undefined => {
  const fieldData = getSubElement(baseType, pathParts)
  if (fieldData && fieldData.field) {
    return fieldData
  }
  return undefined
}

export const getFieldType = (baseType: TypeElement, path: string[]):
  TypeElement | undefined => {
  const getFieldInternalType = (
    fieldType: TypeElement,
    pathParts: string[]
  ): TypeElement | undefined => {
    const [curPart, ...restOfParts] = pathParts
    if (_.isEmpty(curPart)) {
      return fieldType
    }
    if (isIndexPathPart(curPart) && isListType(fieldType)) {
      return getFieldInternalType(fieldType.innerType, restOfParts)
    }
    return undefined
  }
  const fieldData = getField(baseType, path)
  return fieldData?.field && getFieldInternalType(fieldData.field.type, fieldData.path)
}

export const getFieldNames = (refType: ObjectType, path: string[]): string[] => {
  if (_.isEmpty(path)) {
    return _.keys(refType.fields)
  }
  const fieldType = getFieldType(refType, path)
  if (isObjectType(fieldType)) {
    return _.keys(fieldType.fields)
  }
  return []
}

export const getAnnotationKey = (annotations: {[key: string]: TypeElement}, path: string[]):
  AnnoRef => {
  // Looking for the longest key in annotations that start with pathParts
  const annoName = path[0]
  const annoType = (annoName) ? annotations[annoName] : undefined
  return { annoName, annoType }
}

export const getAnnotationValue = (element: Element, annotation: string): Values =>
  (element.annotations[annotation] || {})
