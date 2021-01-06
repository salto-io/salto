/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { TypeElement, ObjectType, Element, PrimitiveType, ContainerType, isContainerType, Field, isObjectType, isField, isListType, isMapType, ReadOnlyElementsSource } from './elements'
import { Values } from './values'

interface AnnoRef {
  annoType?: TypeElement
  annoName?: string
}

type SubElementSearchResult = {
  field?: Field
  path: ReadonlyArray<string>
}

export const isIndexPathPart = (key: string): boolean => !Number.isNaN(Number(key))

export const getDeepInnerType = (
  containerType: ContainerType,
  elementsSource?: ReadOnlyElementsSource,
): ObjectType | PrimitiveType => {
  const innerType = containerType.getInnerType(elementsSource)
  if (!isContainerType(innerType)) {
    return innerType
  }
  return getDeepInnerType(innerType, elementsSource)
}

export const getSubElement = (
  baseType: TypeElement,
  pathParts: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): SubElementSearchResult | undefined => {
  const getChildElement = (type: TypeElement, key: string): Field | TypeElement | undefined => {
    if ((isIndexPathPart(key) && isListType(type)) || isMapType(type)) {
      return type.getInnerType(elementsSource)
    }
    if (type.annotationRefTypes[key]) return type.getAnnotationTypes(elementsSource)?.[key]
    if (isObjectType(type)) return type.fields[key]
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
    // This will fail if not called from the adapters
    ? getSubElement(nextBase.getType(elementsSource), restOfParts, elementsSource)
    : getSubElement(nextBase, restOfParts, elementsSource)

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

const getFieldAndPath = (
  baseType: TypeElement,
  pathParts: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): SubElementSearchResult | undefined => {
  const fieldData = getSubElement(baseType, pathParts, elementsSource)
  if (fieldData && fieldData.field) {
    return fieldData
  }
  return undefined
}

export const getField = (
  baseType: TypeElement,
  pathParts: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): Field | undefined => (
  getFieldAndPath(baseType, pathParts, elementsSource)?.field
)

export const getFieldType = (
  baseType: TypeElement,
  path: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): TypeElement | undefined => {
  const getFieldInternalType = (
    fieldType: TypeElement,
    pathParts: ReadonlyArray<string>
  ): TypeElement | undefined => {
    const [curPart, ...restOfParts] = pathParts
    if (_.isEmpty(curPart)) {
      return fieldType
    }
    if ((isIndexPathPart(curPart) && isListType(fieldType)) || isMapType(fieldType)) {
      return getFieldInternalType(fieldType.getInnerType(elementsSource), restOfParts)
    }
    return undefined
  }
  const fieldData = getFieldAndPath(baseType, path, elementsSource)
  // This will fail if not called from the adapters
  return fieldData?.field
    && getFieldInternalType(fieldData.field.getType(elementsSource), fieldData.path)
}

export const getFieldNames = (
  refType: ObjectType,
  path: string[],
  elementsSource?: ReadOnlyElementsSource,
): string[] => {
  if (_.isEmpty(path)) {
    return _.keys(refType.fields)
  }
  const fieldType = getFieldType(refType, path, elementsSource)
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
