import _ from 'lodash'
import {
  Type, Field, Values, isObjectType, PrimitiveTypes,
  isPrimitiveType, Element, isInstanceElement, isField, isElement, Value,
} from 'adapter-api'
import { DumpedHclBlock, HclDumpReturn } from './internal/types'
import getHclParser from './internal/hcl'
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

const QUOTE_MARKER = 'Q_MARKER'

const startsWithLatter = /^[a-zA-Z]/
const markQuote = (value: string): string =>
  (value.match(startsWithLatter) ? `${QUOTE_MARKER}${value}${QUOTE_MARKER}` : value)

export const dumpElemID = ({ elemID }: Type): string => {
  if (elemID.isConfig()) {
    return elemID.adapter
  }
  return [elemID.adapter, elemID.name]
    .filter(part => !_.isEmpty(part))
    .join(Keywords.NAMESPACE_SEPARATOR)
}

const markDumpedBlockQuotes = (block: DumpedHclBlock): DumpedHclBlock => {
  block.labels = block.labels.map(markQuote)
  block.blocks = block.blocks.map(markDumpedBlockQuotes)
  return block
}

const removeQuotes = (
  value: HclDumpReturn
): HclDumpReturn => value.replace(new RegExp(`"${QUOTE_MARKER}|${QUOTE_MARKER}"`, 'g'), '')

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

const dumpAnnotationsBlock = (element: Type): DumpedHclBlock[] =>
  (_.isEmpty(element.annotationTypes) ? [] : [{
    type: Keywords.ANNOTATIONS_DEFINITION,
    labels: [],
    attrs: {},
    blocks: Object.entries(element.annotationTypes).map(([key, type]) => ({
      type: dumpElemID(type),
      labels: [key],
      attrs: {},
      blocks: [],
    })),
  }])

let dumpBlock: (value: Element | Values) => DumpedHclBlock

const dumpElementBlock = (elem: Element): DumpedHclBlock => {
  if (isObjectType(elem)) {
    return {
      type: elem.isSettings ? Keywords.SETTINGS_DEFINITION : Keywords.TYPE_DEFINITION,
      labels: [dumpElemID(elem)],
      attrs: elem.annotations,
      blocks: dumpAnnotationsBlock(elem).concat(
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
      blocks: dumpAnnotationsBlock(elem),
    }
  }
  if (isInstanceElement(elem)) {
    return {
      type: dumpElemID(elem.type),
      labels: elem.elemID.isConfig() || elem.type.isSettings
        ? []
        : [elem.elemID.name],
      attrs: elem.value,
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

export const dump = async (
  elementsOrValues: Element | Element[] | Values | Value | Value[]
): Promise<string> => {
  const parser = await getHclParser()
  // If we got a single element, put it in an array because we need to wrap it with an empty block
  const elemListOrValues = isElement(elementsOrValues) ? [elementsOrValues] : elementsOrValues

  if (_.isArray(elemListOrValues) && !isElement(elemListOrValues[0])) {
    // We got a Value array, we need to serialize this "manually" because our HCL implementation
    // only accepts blocks
    const nestedValues = await Promise.all(elemListOrValues.map(async elem => {
      const serializedElem = await dump(elem)
      if ((_.isElement(elem) || _.isPlainObject(elem)) && !(serializedElem[0] === '{')) {
        // We need to make sure nested complex elements are wrapped in {}
        return `{\n${serializedElem}\n}`
      }
      return serializedElem
    }))
    return `[\n${nestedValues.join(',\n  ')}\n]`
  }
  if (!_.isArray(elemListOrValues) && !_.isPlainObject(elemListOrValues)) {
    // We got a single primitive value, again we need to serialize "manually"
    const serializer = primitiveSerializers[typeof elemListOrValues]
    return serializer(elementsOrValues)
  }

  // We got a list of elements or a values object, in both cases we can use the HCL serializer
  const body = _.isArray(elemListOrValues)
    ? wrapBlocks(elemListOrValues.map(dumpBlock))
    : dumpBlock(elemListOrValues)

  body.blocks = body.blocks.map(markDumpedBlockQuotes)
  return removeQuotes(await parser.dump(body))
}
