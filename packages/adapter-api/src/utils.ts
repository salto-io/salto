/*
*                      Copyright 2024 Salto Labs Ltd.
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
import { TypeElement, ObjectType, PrimitiveType, isContainerType, Field, isObjectType, isField, isListType, isMapType, ReadOnlyElementsSource } from './elements'

type SubElementSearchResult = {
  field?: Field
  path: ReadonlyArray<string>
}

export const isIndexPathPart = (key: string): boolean => !Number.isNaN(Number(key))

export const getDeepInnerType = async (
  type: TypeElement,
  elementsSource?: ReadOnlyElementsSource,
): Promise<ObjectType | PrimitiveType> => {
  if (!isContainerType(type)) {
    return type
  }
  return getDeepInnerType(await type.getInnerType(elementsSource), elementsSource)
}

export const getDeepInnerTypeSync = (
  type: TypeElement,
): ObjectType | PrimitiveType => {
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
  const getChildElement = async (
    type: TypeElement,
    key: string
  ): Promise<Field | TypeElement | undefined> => {
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
    // This will fail if not called from the adapters
    ? await getSubElement(await nextBase.getType(elementsSource), restOfParts, elementsSource)
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
): Promise<Field | undefined> => (
  (await getFieldAndPath(baseType, pathParts, elementsSource))?.field
)

export const getFieldType = async (
  baseType: TypeElement,
  path: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<TypeElement | undefined> => {
  const getFieldInternalType = async (
    fieldType: TypeElement,
    pathParts: ReadonlyArray<string>
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
  return fieldData?.field
    && getFieldInternalType(await fieldData.field.getType(elementsSource), fieldData.path)
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
