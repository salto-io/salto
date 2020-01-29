import wu from 'wu'
import _ from 'lodash'
import {
  Type, Field, ObjectType, ElemID, Values, Element, PrimitiveValue, PrimitiveField, Value,
  InstanceElement, PrimitiveType, Expression, ReferenceExpression, TemplateExpression,
} from './elements'

interface AnnoRef {
  annoType?: Type
  annoName?: string
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isElement(value: any): value is Element {
  return value && value.elemID && value.elemID instanceof ElemID
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isType(element: any): element is Type {
  return element instanceof Type
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
export function isField(element: any): element is Field {
  return element instanceof Field
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function isPrimitiveField(element: any): element is PrimitiveField {
  return isField(element) && isPrimitiveType(element.type)
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
export const isExpression = (value: any): value is Expression => (
  value instanceof ReferenceExpression
    || value instanceof TemplateExpression
)

export const getSubElement = (baseType: Type, pathParts: string[]): Field| Type | undefined => {
  // This is a little tricky. Since many fields can have _ in them,
  // and we can't tell of the _ is path separator or a part of the
  // the path name. As long as path is not empty we will try to advance
  // in the recursion in two ways - First we try only the first token.
  // If it fails, we try to first to tokens (the recursion will take)
  // care of the next "join"

  // We start by filtering out numbers from the path as they are
  // list indexes, which are irrelevant for type extractions
  const getChildElement = (source: Type, key: string): Field | Type | undefined => {
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

export const getField = (baseType: Type, pathParts: string[]): Field | undefined => {
  const element = getSubElement(baseType, pathParts)
  return isField(element) ? element : undefined
}

export const getFieldType = (baseType: Type, pathParts: string[]): Type|undefined => {
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

export const getAnnotationKey = (annotations: {[key: string]: Type}, path: string): AnnoRef => {
  // Looking for the longest key in annotations that start with pathParts
  const annoName = _(annotations).keys().filter(k => path.startsWith(k))
    .sortBy(k => k.length)
    .last()
  const annoType = (annoName) ? annotations[annoName] : undefined
  return { annoName, annoType }
}


export const getAnnotationValue = (element: Element, annotation: string): Values =>
  (element.annotations[annotation] || {})


export const transform = (
  obj: Values,
  type: ObjectType,
  transformPrimitives: (
    val: PrimitiveValue,
    p: PrimitiveField
  ) => PrimitiveValue | undefined = val => (val),
  strict = true
): Values | undefined => {
  const result = _(obj).mapValues((value, key) => {
    // We don't go out of the transformed element scope
    if (isExpression(value)) return value
    // we get lists of empty strings that we would like to filter out
    if (_.isArray(value) && value.every(s => s === '')) {
      return undefined
    }
    if (value === null) {
      return undefined
    }
    // we get empty strings that we would like to filter out
    if (value === '') {
      return undefined
    }

    const field = type.fields[key]
    if (field !== undefined) {
      const fieldType = field.type
      if (isObjectType(fieldType)) {
        return _.isArray(value)
          ? value.map(v => transform(v, fieldType, transformPrimitives, strict))
            .filter(v => !_.isEmpty(v))
          : transform(value, fieldType, transformPrimitives, strict)
      }
      if (isPrimitiveField(field)) {
        return _.isArray(value)
          ? value.map(v => transformPrimitives(v, field as PrimitiveField))
            .filter(v => !_.isArrayLike(v) || !_.isEmpty(v))
          : transformPrimitives(value, field)
      }
    }

    if (strict) {
      return undefined
    }
    return value
  }).omitBy(_.isUndefined)
    .value()
  return _.isEmpty(result) ? undefined : result
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
