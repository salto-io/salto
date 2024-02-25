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
import {
  Field,
  isObjectType,
  PrimitiveTypes,
  isPrimitiveType,
  Element,
  isInstanceElement,
  Value,
  INSTANCE_ANNOTATIONS,
  isReferenceExpression,
  isField,
  ElemID,
  ReferenceMap,
  TypeReference,
} from '@salto-io/adapter-api'
import { dump as hclDump, dumpValue } from './internal/dump'
import { DumpedHclBlock } from './internal/types'
import { Keywords } from './language'
import { getFunctionExpression, Functions, FunctionExpression } from './functions'
import { ValuePromiseWatcher } from './internal/native/types'
import { addValuePromiseWatcher, replaceValuePromises } from './internal/native/helpers'

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
  if (primitiveType === PrimitiveTypes.UNKNOWN) {
    return Keywords.TYPE_UNKNOWN
  }
  return Keywords.TYPE_OBJECT
}

export const dumpElemID = (id: ElemID): string => {
  if (id.isConfigType()) {
    return id.adapter
  }
  if (id.idType === 'instance') {
    ;[id.adapter, id.name].filter(part => !_.isEmpty(part)).join(Keywords.NAMESPACE_SEPARATOR)
  }
  return id.getFullName()
}

const dumpAttributes = (value: Value, functions: Functions, valuePromiseWatchers: ValuePromiseWatcher[]): Value => {
  const funcVal = getFunctionExpression(value, functions)
  if (funcVal !== undefined) {
    return funcVal
  }

  if (
    (!_.isArray(value) && !_.isPlainObject(value)) ||
    isReferenceExpression(value) ||
    value instanceof FunctionExpression
  ) {
    return value
  }
  if (_.isArray(value)) {
    const retArray: Value[] = []
    value.forEach((x, key) => {
      retArray.push(dumpAttributes(x, functions, valuePromiseWatchers))
      addValuePromiseWatcher(valuePromiseWatchers, retArray, key)
    })
    return retArray
  }

  const retObj: Record<string, Value> = {}
  Object.entries(value).forEach(([key, val]) => {
    retObj[key] = dumpAttributes(val, functions, valuePromiseWatchers)
    addValuePromiseWatcher(valuePromiseWatchers, retObj, key)
  })
  return retObj
}

const dumpFieldBlock = (
  field: Field,
  functions: Functions,
  valuePromiseWatchers: ValuePromiseWatcher[],
): DumpedHclBlock => ({
  type: dumpElemID(field.refType.elemID),
  labels: [field.elemID.name],
  attrs: dumpAttributes(field.annotations, functions, valuePromiseWatchers),
  blocks: [],
})

const dumpAnnotationTypeBlock = (key: string, refType: TypeReference): DumpedHclBlock => ({
  type: dumpElemID(refType.elemID),
  labels: [key],
  attrs: {},
  blocks: [],
})

const dumpAnnotationTypesBlock = (annotationRefTypes: ReferenceMap): DumpedHclBlock[] =>
  _.isEmpty(annotationRefTypes)
    ? []
    : [
        {
          type: Keywords.ANNOTATIONS_DEFINITION,
          labels: [],
          attrs: {},
          blocks: Object.entries(annotationRefTypes).map(([key, ref]) => dumpAnnotationTypeBlock(key, ref)),
        },
      ]

const dumpElementBlock = (
  elem: Readonly<Element>,
  functions: Functions,
  valuePromiseWatchers: ValuePromiseWatcher[],
): DumpedHclBlock => {
  if (isField(elem)) {
    return dumpFieldBlock(elem, functions, valuePromiseWatchers)
  }
  if (isObjectType(elem)) {
    return {
      type: elem.isSettings ? Keywords.SETTINGS_DEFINITION : Keywords.TYPE_DEFINITION,
      labels: [dumpElemID(elem.elemID)],
      attrs: dumpAttributes(elem.annotations, functions, valuePromiseWatchers),
      blocks: dumpAnnotationTypesBlock(elem.annotationRefTypes).concat(
        Object.values(elem.fields).map(field => dumpFieldBlock(field, functions, valuePromiseWatchers)),
      ),
    }
  }
  if (isPrimitiveType(elem)) {
    return {
      type: Keywords.TYPE_DEFINITION,
      labels: [dumpElemID(elem.elemID), Keywords.TYPE_INHERITANCE_SEPARATOR, getPrimitiveTypeName(elem.primitive)],
      attrs: dumpAttributes(elem.annotations, functions, valuePromiseWatchers),
      blocks: dumpAnnotationTypesBlock(elem.annotationRefTypes),
    }
  }
  if (isInstanceElement(elem)) {
    return {
      type: dumpElemID(elem.refType.elemID),
      labels:
        elem.elemID.isConfigType() || elem.refType.elemID.isConfigType() || elem.elemID.name === '_config' // TODO: should inject the correct type
          ? []
          : [elem.elemID.name],
      attrs: dumpAttributes(
        _.merge({}, elem.value, _.pick(elem.annotations, _.values(INSTANCE_ANNOTATIONS))),
        functions,
        valuePromiseWatchers,
      ),
      blocks: [],
    }
  }
  // Without this exception the linter won't allow us to end the function
  // without a return value
  throw new Error('Unsupported element type')
}

const wrapBlocks = (blocks: DumpedHclBlock[]): DumpedHclBlock => ({
  type: '',
  labels: [],
  attrs: {},
  blocks,
})

export const dumpElements = async (
  elements: Readonly<Element>[],
  functions: Functions = {},
  indentationLevel = 0,
): Promise<string> => {
  const valuePromiseWatchers: ValuePromiseWatcher[] = []

  const warpedBlocks = wrapBlocks(elements.map(e => dumpElementBlock(e, functions, valuePromiseWatchers)))
  await replaceValuePromises(valuePromiseWatchers)
  return hclDump(warpedBlocks, indentationLevel)
}

export const dumpSingleAnnotationType = (name: string, refType: TypeReference, indentationLevel = 0): string =>
  hclDump(wrapBlocks([dumpAnnotationTypeBlock(name, refType)]), indentationLevel)

export const dumpAnnotationTypes = (annotationRefTypes: ReferenceMap, indentationLevel = 0): string =>
  hclDump(wrapBlocks(dumpAnnotationTypesBlock(annotationRefTypes)), indentationLevel)

export const dumpValues = async (value: Value, functions: Functions, indentationLevel = 0): Promise<string> => {
  // Note that since this function can receive a primitive / func obj
  // as the value param, we need to create a mock parent for the value
  // promise watchers logic to work
  const valuePromiseWatchers: ValuePromiseWatcher[] = []
  const defaultKey = 'value'
  const defaultParent: Record<string, Value> = {}
  // Convert potential function values before dumping the value
  defaultParent[defaultKey] = dumpAttributes(value, functions, valuePromiseWatchers)
  addValuePromiseWatcher(valuePromiseWatchers, defaultParent, defaultKey)
  await replaceValuePromises(valuePromiseWatchers)
  const valueWithSerializedFunctions = defaultParent[defaultKey]
  return dumpValue(valueWithSerializedFunctions, indentationLevel).join('\n').concat('\n')
}
