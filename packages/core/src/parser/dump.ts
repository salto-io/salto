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
  TypeElement, Field, Values, isObjectType, PrimitiveTypes, TypeMap, isListType,
  isPrimitiveType, Element, isInstanceElement, isField,
  isElement, Value, INSTANCE_ANNOTATIONS, isReferenceExpression,
} from '@salto-io/adapter-api'
import { promises } from '@salto-io/lowerdash'

import { dump as hclDump } from './internal/dump'
import { DumpedHclBlock } from './internal/types'
import { Keywords } from './language'
import {
  getFunctionExpression,
  Functions,
} from './functions'
import { FunctionExpression } from './internal/functions'

const { object: { mapValuesAsync } } = promises

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

export const dumpElemID = (type: TypeElement): string => {
  if (type.elemID.isConfig()) {
    return type.elemID.adapter
  }
  if (isListType(type)) {
    return `${Keywords.LIST_PREFIX}${dumpElemID(type.innerType)}${Keywords.GENERICS_SUFFIX}`
  }
  return [type.elemID.adapter, type.elemID.name]
    .filter(part => !_.isEmpty(part))
    .join(Keywords.NAMESPACE_SEPARATOR)
}

const dumpAttributes = async (value: Value, functions?: Functions): Promise<Value> => {
  const funcVal = await getFunctionExpression(value, functions)
  if (funcVal) {
    return funcVal
  }

  if (
    (!_.isArray(value) && !_.isPlainObject(value))
      || isReferenceExpression(value)
        || value instanceof FunctionExpression
  ) {
    return value
  }

  if (_.isArray(value)) {
    return Promise.all(value.map(x => dumpAttributes(x, functions)))
  }

  return mapValuesAsync(value, async val => dumpAttributes(val, functions))
}

const dumpFieldBlock = async (field: Field, functions?: Functions): Promise<DumpedHclBlock> => ({
  type: dumpElemID(field.type),
  labels: [field.elemID.name],
  attrs: await dumpAttributes(field.annotations, functions),
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

let dumpBlock: (value: Element | Values, functions?: Functions) => Promise<DumpedHclBlock>

const dumpElementBlock = async (elem: Element, functions?: Functions): Promise<DumpedHclBlock> => {
  if (isObjectType(elem)) {
    return {
      type: elem.isSettings ? Keywords.SETTINGS_DEFINITION : Keywords.TYPE_DEFINITION,
      labels: [dumpElemID(elem)],
      attrs: await dumpAttributes(elem.annotations, functions),
      blocks: dumpAnnotationTypesBlock(elem.annotationTypes).concat(
        await Promise.all(Object.values(elem.fields).map(e => dumpBlock(e, functions)))
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
      attrs: await dumpAttributes(elem.annotations, functions),
      blocks: dumpAnnotationTypesBlock(elem.annotationTypes),
    }
  }
  if (isInstanceElement(elem)) {
    return {
      type: dumpElemID(elem.type),
      labels: elem.elemID.isConfig() || elem.type.isSettings
        ? []
        : [elem.elemID.name],
      attrs: await dumpAttributes(
        _.merge({}, elem.value, _.pick(elem.annotations, _.values(INSTANCE_ANNOTATIONS))),
        functions,
      ),
      blocks: [],
    }
  }
  // Without this exception the linter won't allow us to end the function
  // without a return value
  throw new Error('Unsupported element type')
}

dumpBlock = async (value: Element | Values, functions?: Functions): Promise<DumpedHclBlock> => {
  if (isField(value)) {
    return dumpFieldBlock(value, functions)
  }
  if (isElement(value)) {
    return dumpElementBlock(value, functions)
  }

  // If we reach this point we are serializing values
  return {
    type: '',
    labels: [],
    attrs: await dumpAttributes(value, functions),
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

export const dumpElements = async (elements: Element[], functions?: Functions): Promise<string> =>
  hclDump(wrapBlocks(await Promise.all(elements.map(e => dumpBlock(e, functions)))))

export const dumpSingleAnnotationType = (name: string, type: TypeElement): string =>
  hclDump(wrapBlocks([dumpAnnotationTypeBlock(name, type)]))

export const dumpAnnotationTypes = (annotationTypes: TypeMap): string =>
  hclDump(wrapBlocks(dumpAnnotationTypesBlock(annotationTypes)))

export const dumpValues = async (value: Value, functions?: Functions): Promise<string> => {
  if (_.isArray(value)) {
    // We got a Value array, we need to serialize it "manually" because our HCL implementation
    // accepts only blocks
    const nestedValues = await Promise.all(value.map(async elem => {
      const serializedElem = await dumpValues(elem, functions)
      if ((_.isPlainObject(elem)) && !(serializedElem[0] === '{')) {
        // We need to make sure nested complex elements are wrapped in {}
        return `{\n${serializedElem}\n}`
      }
      return serializedElem
    }))
    return `[\n${nestedValues.join(',\n  ')}\n]`
  }
  if (!_.isArray(value) && !_.isPlainObject(value)) {
    // We got a single primitive value, again we need to serialize "manually"
    const serializer = primitiveSerializers[typeof value]
    return serializer(value)
  }


  const objWithSerializedFunctions = await dumpAttributes(value, functions)

  // We got a values object, we can use the HCL serializer
  return hclDump(await dumpBlock(objWithSerializedFunctions, functions))
}
