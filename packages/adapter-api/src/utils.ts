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
import _ from 'lodash'
import { TypeElement, ObjectType, Element, PrimitiveType, isContainerType, Field, isObjectType, isListType, isMapType, ReadOnlyElementsSource } from './elements'
import { Values } from './values'

interface AnnoRef {
  annoType?: TypeElement
  annoName?: string
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

/**
 * Performs a deep lookup in a type element to a sub type by a given path.
 * Returns the type in the given path if exists, else undefined.
 *
 * NOTICE:
 * This function recurse into field/list/map keys only. It doesn't recurse into annotation types.
 * To lookup a sub type inside annotation first get the annotation type and then call this function.
 *
 * @example
 * type.fields['field'] = new Field(type, 'field', new ListType(innerType))
 * innerType.fields['name'] = new Field(innerType, 'name', BuiltinTypes.STRING)
 *
 * getSubType(type, ['field']) -> new ListType(innerType)
 * getSubType(type, ['field', '1']) -> innerType
 * getSubType(type, ['field', '1', 'name']) -> BuiltinTypes.STRING
 */
export const getSubType = async (
  baseType: TypeElement,
  pathParts: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<TypeElement | undefined> => {
  const getChildElement = (
    type: TypeElement,
    key: string,
  ): Promise<TypeElement | undefined> => {
    if (isObjectType(type) && type.fields[key]) {
      return type.fields[key].getType(elementsSource)
    }
    if ((isIndexPathPart(key) && isListType(type)) || isMapType(type)) {
      return type.getInnerType(elementsSource)
    }
    return Promise.resolve(undefined)
  }
  if (_.isEmpty(pathParts)) {
    return undefined
  }
  const [curPart, ...restOfParts] = pathParts
  const childElement = await getChildElement(baseType, curPart)
  return !_.isEmpty(restOfParts) && childElement
    ? getSubType(childElement, restOfParts, elementsSource)
    : childElement
}

/**
 * Performs a deep lookup in a type element to a field by a given path.
 * Returns the field in the given path if exists, else undefined.
 *
 * NOTICE:
 * This function recurse into field/list/map keys only. It doesn't recurse into annotation types.
 * To lookup a field inside annotation first get the annotation type and then call this function.
 *
 * @example
 * // to get a field of nested instance value (e.g. adapter.typeName.instance.fieldName.nestedField)
 * getField(await instance.getType(), ['fieldName', 'nestedField'])
 *
 * // to get a field inside type annotation (e.g. adapter.typeName.attr.annoName.annoField)
 * getField((await type.getAnnotationTypes())['annoName'], ['annoField'])
 *
 * // to get a field inside field annotation
 * // (e.g. adapter.typeName.field.fieldName.annoName.annoField)
 * getField((await (await type.fields['fieldName'].getType())
 *   .getAnnotationTypes())['annoName'], ['annoField'])
 */
export const getField = async (
  baseType: TypeElement,
  pathParts: ReadonlyArray<string>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<Field | undefined> => {
  if (_.isEmpty(pathParts)) {
    return undefined
  }
  const parentPath = pathParts.slice(0, -1)
  const type = _.isEmpty(parentPath)
    ? baseType
    : await getSubType(baseType, parentPath, elementsSource)
  const fieldName = pathParts.slice(-1)[0]
  return isObjectType(type) ? type.fields[fieldName] : undefined
}

export const getFieldNames = async (
  refType: ObjectType,
  path: string[],
  elementsSource?: ReadOnlyElementsSource,
): Promise<string[]> => {
  if (_.isEmpty(path)) {
    return _.keys(refType.fields)
  }
  const fieldType = await getSubType(refType, path, elementsSource)
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
