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
  TypeElement, Field, ObjectType, Element, InstanceElement, PrimitiveType,
} from './elements'
import {
  Values, Expression, ReferenceExpression, TemplateExpression, FunctionExpression,
} from './values'
import { ElemID } from './element_id'

interface AnnoRef {
  annoType?: TypeElement
  annoName?: string
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isElement(value: any): value is Element {
  return value && value.elemID && value.elemID instanceof ElemID
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isObjectType(element: any): element is ObjectType {
  return element instanceof ObjectType
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isInstanceElement(element: any): element is InstanceElement {
  return element instanceof InstanceElement
}

export function isPrimitiveType(
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  element: any,
): element is PrimitiveType {
  return element instanceof PrimitiveType
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isType(element: any): element is TypeElement {
  return isPrimitiveType(element) || isObjectType(element)
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isField(element: any): element is Field {
  return element instanceof Field
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isEqualElements(first?: any, second?: any): boolean {
  if (!(first && second)) {
    return false
  }
  // first.isEqual line appears multiple times since the compiler is not smart
  // enough to understand the 'they are the same type' concept when using or
  if (isPrimitiveType(first) && isPrimitiveType(second)) {
    return first.isEqual(second)
  } if (isObjectType(first) && isObjectType(second)) {
    return first.isEqual(second)
  } if (isField(first) && isField(second)) {
    return first.isEqual(second)
  } if (isInstanceElement(first) && isInstanceElement(second)) {
    return first.isEqual(second)
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isReferenceExpression = (value: any): value is ReferenceExpression => (
  value instanceof ReferenceExpression
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isTemplateExpression = (value: any): value is TemplateExpression => (
  value instanceof TemplateExpression
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isFunctionExpression = (value: any): value is FunctionExpression => (
  value instanceof FunctionExpression
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isExpression = (value: any): value is Expression => (
  isReferenceExpression(value) || isTemplateExpression(value) || isFunctionExpression(value)
)

export const getSubElement = (baseType: TypeElement, pathParts: string[]):
  Field | TypeElement | undefined => {
  // This is a little tricky. Since many fields can have _ in them,
  // and we can't tell of the _ is path separator or a part of the
  // the path name. As long as path is not empty we will try to advance
  // in the recursion in two ways - First we try only the first token.
  // If it fails, we try to first to tokens (the recursion will take)
  // care of the next "join"

  // We start by filtering out numbers from the path as they are
  // list indexes, which are irrelevant for type extractions
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

export const getField = (baseType: TypeElement, pathParts: string[]): Field | undefined => {
  const element = getSubElement(baseType, pathParts)
  return isField(element) ? element : undefined
}

export const getFieldType = (baseType: TypeElement, pathParts: string[]):
  TypeElement | undefined => {
  const field = getField(baseType, pathParts)
  return (isField(field)) ? field.type : undefined
}

export const getFieldNames = (refType: ObjectType, path: string): string[] => {
  if (!path) {
    return _.keys(refType.fields)
  }
  const pathField = getField(refType, path.split(ElemID.NAMESPACE_SEPARATOR))
  if (pathField && isField(pathField) && isObjectType(pathField.type)) {
    return _.keys(pathField.type.fields)
  }
  return []
}

export const getAnnotationKey = (annotations: {[key: string]: TypeElement}, path: string):
  AnnoRef => {
  // Looking for the longest key in annotations that start with pathParts
  const annoName = _(annotations).keys().filter(k => path.startsWith(k))
    .sortBy(k => k.length)
    .last()
  const annoType = (annoName) ? annotations[annoName] : undefined
  return { annoName, annoType }
}

export const getAnnotationValue = (element: Element, annotation: string): Values =>
  (element.annotations[annotation] || {})
