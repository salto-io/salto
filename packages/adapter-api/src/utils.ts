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
import wu from 'wu'
import _ from 'lodash'
import {
  TypeElement, Field, ObjectType, Element, InstanceElement, PrimitiveType, TypeMap,
} from './elements'
import { Values, PrimitiveValue, Expression, ReferenceExpression, TemplateExpression, Value } from './values'
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
export const isExpression = (value: any): value is Expression => (
  isReferenceExpression(value) || isTemplateExpression(value)
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

export type TransformPrimitiveFunc = (
  val: PrimitiveValue, field: Field,
) => PrimitiveValue | undefined

export type TransformReferenceFunc = (
  val: Expression, path: string
) => Expression

export const transformValues = (
  {
    values,
    type,
    transformPrimitives = () => undefined,
    transformReferences = v => v,
    strict = true,
    path = '',
  }: {
    values: Value
    type: ObjectType | TypeMap
    transformPrimitives?: TransformPrimitiveFunc
    transformReferences?: TransformReferenceFunc
    strict?: boolean
    path?: string
  }
): Values | undefined => {
  const transformValue = (value: Value, keyPath: string, field?: Field): Value => {
    if (isExpression(value)) {
      return transformReferences(value, keyPath)
    }

    if (field === undefined) {
      return strict ? undefined : value
    }
    if (_.isArray(value)) {
      const transformed = value
        .map((item, index) => transformValue(item, keyPath.concat(`.${value[0]}.[${index}]`), field))
        .filter(val => !_.isUndefined(val))
      return transformed.length === 0 ? undefined : transformed
    }

    if (isPrimitiveType(field.type)) {
      return transformPrimitives(value, field)
    }
    if (isObjectType(field.type)) {
      const transformed = _.omitBy(
        transformValues({
          values: value,
          type: field.type,
          transformPrimitives,
          transformReferences,
          strict,
          path: keyPath,
        }),
        _.isUndefined
      )
      return _.isEmpty(transformed) ? undefined : transformed
    }
    return undefined
  }

  const fieldMap = isObjectType(type)
    ? type.fields
    : _.mapValues(type, (fieldType, name) => new Field(new ElemID(''), name, fieldType))

  const result = _(values)
    .mapValues((value, key) => transformValue(value, path.concat(path.length === 0 ? key : `.${key}`), fieldMap[key]))
    .omitBy(_.isUndefined)
    .value()
  return _.isEmpty(result) ? undefined : result
}

export const transformElement = <T extends Element>(
  {
    element,
    transformPrimitives,
    transformReference,
  }: {
    element: T
    transformPrimitives?: TransformPrimitiveFunc
    transformReference?: TransformReferenceFunc
  }
): T => {
  if (isInstanceElement(element)) {
    element.value = transformValues({
      values: element.value,
      type: element.type,
      transformPrimitives,
      transformReferences: transformReference,
      strict: false,
    }) || {}
  }

  if (isObjectType(element)) {
    _(element.fields)
      .forEach(f => {
        f.annotations = transformValues({
          values: f.annotations,
          type: f.annotationTypes,
          transformPrimitives,
          transformReferences: transformReference,
          strict: false,
          path: 'fields.field.annotations',
        }) || {}
      })
  }

  element.annotations = transformValues({
    values: element.annotations,
    type: element.annotationTypes,
    transformPrimitives,
    transformReferences: transformReference,
    strict: false,
    path: 'annotations',
  }) || {}

  return element
}

export const transformReferences = <T extends Element>(
  element: T,
  getLookUpName: (v: Value) => Value
): T => {
  const referenceReplacer = (value: Value): Value => {
    if (isReferenceExpression(value)) return getLookUpName(value.value)
    return value
  }
  return transformElement({
    element: element.clone() as T,
    transformReference: referenceReplacer,
  })
}

export const replicateReferences = <T extends Element>(
  source: T,
  targetElement: T,
  getLookUpName: (v: Value) => Value
): T => {
  const allReferencesPaths = new Map<string, ReferenceExpression>()
  const createPathMapCallback: TransformReferenceFunc = (val, path) => {
    if (isReferenceExpression(val)) {
      allReferencesPaths.set(path, val)
    }
    return val
  }

  transformElement({
    element: source.clone() as T,
    transformReference: createPathMapCallback,
  })

  const resp = targetElement.clone() as T

  _(allReferencesPaths.forEach((value, key) => {
    const refValue = _.get(resp, key)
    if (refValue !== undefined) {
      _.set(resp, key, _.isEqual(getLookUpName(value.value), refValue) ? value : refValue)
    }
  }))

  return resp
}

export const findElements = (elements: Iterable<Element>, id: ElemID): Iterable<Element> => (
  wu(elements).filter(e => e.elemID.isEqual(id))
)

export const findElement = (elements: Iterable<Element>, id: ElemID): Element | undefined => (
  wu(elements).find(e => e.elemID.isEqual(id))
)

export const findObjectType = (elements: Iterable<Element>, id: ElemID): ObjectType | undefined => {
  const objects = wu(elements).filter(isObjectType) as wu.WuIterable<ObjectType>
  return objects.find(e => e.elemID.isEqual(id))
}

export const findInstances = (
  elements: Iterable<Element>,
  typeID: ElemID,
): Iterable<InstanceElement> => {
  const instances = wu(elements).filter(isInstanceElement) as wu.WuIterable<InstanceElement>
  return instances.filter(e => e.type.elemID.isEqual(typeID))
}

export const resolvePath = (rootElement: Element, fullElemID: ElemID): Value => {
  const { parent, path } = fullElemID.createTopLevelParentID()
  if (!_.isEqual(parent, rootElement.elemID)) return undefined

  if (_.isEmpty(path)) {
    return rootElement
  }

  if (isInstanceElement(rootElement) && fullElemID.idType === 'instance') {
    return (!_.isEmpty(path)) ? _.get(rootElement.value, path) : rootElement
  }

  if (isObjectType(rootElement) && fullElemID.idType === 'field') {
    return _.get(rootElement.fields[path[0]]?.annotations, path.slice(1))
  }

  if (isType(rootElement) && fullElemID.idType === 'attr') {
    return _.get(rootElement.annotations, path)
  }

  if (isType(rootElement) && fullElemID.idType === 'annotation') {
    return _.get(rootElement.annotationTypes[path[0]]?.annotations, path.slice(1))
  }

  return undefined
}
