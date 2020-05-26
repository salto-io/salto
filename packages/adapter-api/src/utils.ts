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
import { ElemID } from './element_id'

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
    if (source.annotationTypes[key]) return source.annotationTypes[key]
    if (isObjectType(source)) return source.fields[key]
    return undefined
  }

  const [curPart, ...restOfParts] = pathParts.filter(p => Number.isNaN(Number(p)))
  const nextBase = getChildElement(baseType, curPart)

  if (_.isEmpty(restOfParts)) {
    return nextBase
  }

  if (nextBase) {
    return isField(nextBase)
      ? getSubElement(nextBase.type, restOfParts)
      : getSubElement(nextBase, restOfParts)
  }

  // First token is no good, we check if it is a part of a longer name
  const nextCur = [curPart, restOfParts[0]].join(ElemID.NAMESPACE_SEPARATOR)
  const nextRest = restOfParts.slice(1)
  return getSubElement(baseType, [nextCur, ...nextRest])
}

<<<<<<< HEAD
export const getField = (baseType: TypeElement, pathParts: string[]): Field | undefined => {
  const element = getSubElement(baseType, pathParts)
  return isField(element) ? element : undefined
=======
export const getField = (
  baseType: TypeElement,
  pathParts: string[]
): SubElementSearchResult | undefined => {
  const fieldData = getSubElement(baseType, pathParts)
  if (fieldData && fieldData.field) {
    return fieldData
  }
  return undefined
>>>>>>> 375143ad... extracted getSubElement return value to a type
}

export const getFieldType = (baseType: TypeElement, pathParts: string[]):
  TypeElement | undefined => {
  const field = getField(baseType, pathParts)
  return (isField(field)) ? field.type : undefined
}

export const getFieldNames = (refType: ObjectType, path: string[]): string[] => {
  if (_.isEmpty(path)) {
    return _.keys(refType.fields)
  }
  const pathField = getField(refType, path)
  if (pathField && isField(pathField) && isObjectType(pathField.type)) {
    return _.keys(pathField.type.fields)
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
