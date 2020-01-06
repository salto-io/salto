import _ from 'lodash'
import {
  isObjectType, Type, Field, ObjectType, ElemID, isField, Values,
  Element, isPrimitiveType, PrimitiveTypes,
} from './elements'

interface AnnoRef {
  annoType?: Type
  annoName?: string
}

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

export type ConvertXsdTypeFunc = (v: string) => PrimitiveValue

export const convertXsdTypeFuncMap: Record<string, ConvertXsdTypeFunc> = {
  'xsd:string': String,
  'xsd:boolean': v => v === 'true',
  'xsd:double': Number,
  'xsd:int': Number,
  'xsd:long': Number,
}

export const getAnnotationValue = (element: Element, annotation: string): Values =>
  (element.annotations[annotation] || {})

export type PrimitiveValue = string | boolean | number

const transformPrimitive = (val: PrimitiveValue, primitive: PrimitiveTypes):
  PrimitiveValue | undefined => {
  // Salesforce returns nulls as objects like { $: { 'xsi:nil': 'true' } }
  // our key name transform replaces '$' with '' and ':' with '_'
  if (_.isObject(val) && _.get(val, ['', 'xsi_nil']) === 'true') {
    // We transform null to undefined as currently we don't support null in Salto language
    // and the undefined values are omitted later in the code
    return undefined
  }
  // (Salto-394) Salesforce returns objects like:
  // { "_": "fieldValue", "$": { "xsi:type": "xsd:string" } }
  // our key name transform replaces '$' with '' and ':' with '_'
  if (_.isObject(val) && Object.keys(val).includes('_')) {
    const convertFunc = convertXsdTypeFuncMap[_.get(val, ['', 'xsi_type'])] || (v => v)
    return transformPrimitive(convertFunc(_.get(val, '_')), primitive)
  }
  switch (primitive) {
    case PrimitiveTypes.NUMBER:
      return Number(val)
    case PrimitiveTypes.BOOLEAN:
      return val.toString().toLowerCase() === 'true'
    case PrimitiveTypes.STRING:
      return val.toString().length === 0 ? undefined : val.toString()
    default:
      return val
  }
}

export const transform = (obj: Values, type: ObjectType, strict = true): Values | undefined => {
  const result = _(obj).mapValues((value, key) => {
    // we get lists of empty strings that we would like to filter out
    if (_.isArray(value) && value.every(s => s === '')) {
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
          ? value.map(v => transform(v, fieldType, strict))
            .filter(v => !_.isEmpty(v))
          : transform(value, fieldType, strict)
      }
      if (isPrimitiveType(fieldType)) {
        return _.isArray(value)
          ? value.map(v => transformPrimitive(v, fieldType.primitive))
            .filter(v => !_.isArrayLike(v) || !_.isEmpty(v))
          : transformPrimitive(value, fieldType.primitive)
      }
    }
    // We are not returning the value if it's not fit the type definition.
    // We saw cases where we got for jsforce values empty values in unexpected
    // format for example:
    // "layoutColumns":["","",""] where layoutColumns suppose to be list of object
    // with LayoutItem and reserve fields.
    // return undefined
    if (strict) {
      return undefined
    }
    return value
  }).omitBy(_.isUndefined)
    .value()
  return _.isEmpty(result) ? undefined : result
}
