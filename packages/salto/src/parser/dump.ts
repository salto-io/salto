import _ from 'lodash'
import {
  TypeElement, Field, Values, isObjectType, PrimitiveTypes, TypeMap,
  isPrimitiveType, Element, isInstanceElement, isField, isElement, Value, INSTANCE_ANNOTATIONS,
} from 'adapter-api'
import { dump as hclDump } from './internal/dump'
import { DumpedHclBlock } from './internal/types'
import { Keywords } from './language'

/**
 * @param primitiveType Primitive type identifier
 * @returns Type name in HCL syntax
 */
const getPrimitiveTypeName = (primitiveType: PrimitiveTypes): string => {
  if (primitiveType === PrimitiveTypes.STRING) {
    return Keywords.TYPE_STRING
  }
  if (primitiveType === PrimitiveTypes.NUMBER) {
    return Keywords.TYPE_NUMBER
  }
  if (primitiveType === PrimitiveTypes.BOOLEAN) {
    return Keywords.TYPE_BOOL
  }
  return Keywords.TYPE_OBJECT
}

export const dumpElemID = ({ elemID }: TypeElement): string => {
  if (elemID.isConfig()) {
    return elemID.adapter
  }
  return [elemID.adapter, elemID.name]
    .filter(part => !_.isEmpty(part))
    .join(Keywords.NAMESPACE_SEPARATOR)
}

const dumpFieldBlock = (field: Field): DumpedHclBlock => ({
  type: dumpElemID(field.type),
  labels: [field.elemID.name],
  attrs: field.annotations,
  blocks: [],
})

const dumpListFieldBlock = (field: Field): DumpedHclBlock => ({
  type: Keywords.LIST_DEFINITION,
  labels: [dumpElemID(field.type), field.elemID.name],
  attrs: field.annotations,
  blocks: [],
})

const dumpAnnotationTypeBlock = (key: string, type: TypeElement): DumpedHclBlock => ({
  type: dumpElemID(type),
  labels: [key],
  attrs: {},
  blocks: [],
})

const dumpAnnotationTypesBlock = (annotationTypes: TypeMap): DumpedHclBlock[] =>
  (_.isEmpty(annotationTypes) ? [] : [{
    type: Keywords.ANNOTATIONS_DEFINITION,
    labels: [],
    attrs: {},
    blocks: Object.entries(annotationTypes)
      .map(([key, type]) => dumpAnnotationTypeBlock(key, type)),
  }])

let dumpBlock: (value: Element | Values) => DumpedHclBlock

const dumpElementBlock = (elem: Element): DumpedHclBlock => {
  if (isObjectType(elem)) {
    return {
      type: elem.isSettings ? Keywords.SETTINGS_DEFINITION : Keywords.TYPE_DEFINITION,
      labels: [dumpElemID(elem)],
      attrs: elem.annotations,
      blocks: dumpAnnotationTypesBlock(elem.annotationTypes).concat(
        Object.values(elem.fields).map(dumpBlock)
      ),
    }
  }
  if (isPrimitiveType(elem)) {
    return {
      type: Keywords.TYPE_DEFINITION,
      labels: [
        dumpElemID(elem),
        Keywords.TYPE_INHERITANCE_SEPARATOR,
        getPrimitiveTypeName(elem.primitive),
      ],
      attrs: elem.annotations,
      blocks: dumpAnnotationTypesBlock(elem.annotationTypes),
    }
  }
  if (isInstanceElement(elem)) {
    return {
      type: dumpElemID(elem.type),
      labels: elem.elemID.isConfig() || elem.type.isSettings
        ? []
        : [elem.elemID.name],
      attrs: _.merge({}, elem.value, _.pick(elem.annotations, _.values(INSTANCE_ANNOTATIONS))),
      blocks: [],
    }
  }
  // Without this exception the linter won't allow us to end the function
  // without a return value
  throw new Error('Unsupported element type')
}

dumpBlock = (value: Element | Values): DumpedHclBlock => {
  if (isField(value)) {
    return value.isList ? dumpListFieldBlock(value) : dumpFieldBlock(value)
  }
  if (isElement(value)) {
    return dumpElementBlock(value)
  }
  // If we reach this point we are serializing values
  return {
    type: '',
    labels: [],
    attrs: value as Values,
    blocks: [],
  }
}

const wrapBlocks = (blocks: DumpedHclBlock[]): DumpedHclBlock => ({
  type: '',
  labels: [],
  attrs: {},
  blocks,
})

type PrimitiveSerializer = (val: Value) => string
const primitiveSerializers: Record<string, PrimitiveSerializer> = {
  string: val => `"${val}"`,
  number: val => `${val}`,
  boolean: val => (val ? 'true' : 'false'),
}

export const dumpElements = (elements: Element[]): string =>
  hclDump(wrapBlocks(elements.map(dumpBlock)))

export const dumpSingleAnnotationType = (name: string, type: TypeElement): string =>
  hclDump(wrapBlocks([dumpAnnotationTypeBlock(name, type)]))

export const dumpAnnotationTypes = (annotationTypes: TypeMap): string =>
  hclDump(wrapBlocks(dumpAnnotationTypesBlock(annotationTypes)))

export const dumpValues = (value: Value): string => {
  if (_.isArray(value)) {
    // We got a Value array, we need to serialize it "manually" because our HCL implementation
    // accepts only blocks
    const nestedValues = value.map(elem => {
      const serializedElem = dumpValues(elem)
      if ((_.isPlainObject(elem)) && !(serializedElem[0] === '{')) {
        // We need to make sure nested complex elements are wrapped in {}
        return `{\n${serializedElem}\n}`
      }
      return serializedElem
    })
    return `[\n${nestedValues.join(',\n  ')}\n]`
  }
  if (!_.isArray(value) && !_.isPlainObject(value)) {
    // We got a single primitive value, again we need to serialize "manually"
    const serializer = primitiveSerializers[typeof value]
    return serializer(value)
  }
  // We got a values object, we can use the HCL serializer
  return hclDump(dumpBlock(value))
}
