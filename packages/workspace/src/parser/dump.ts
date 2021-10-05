/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Field, isObjectType, PrimitiveTypes, isPrimitiveType, Element, isInstanceElement, Value, INSTANCE_ANNOTATIONS, isReferenceExpression, isField, ElemID, ReferenceMap, TypeReference } from '@salto-io/adapter-api'
import { promises, collections } from '@salto-io/lowerdash'


import { dump as hclDump, dumpValue } from './internal/dump'
import { DumpedHclBlock } from './internal/types'
import { Keywords } from './language'
import {
  getFunctionExpression,
  Functions,
  FunctionExpression,
} from './functions'

const { awu } = collections.asynciterable
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
  if (primitiveType === PrimitiveTypes.UNKNOWN) {
    return Keywords.TYPE_UNKNOWN
  }
  return Keywords.TYPE_OBJECT
}

export const dumpElemID = (id: ElemID): string => {
  if (id.isConfig()) {
    return id.adapter
  }
  if (id.idType === 'instance') {
    [id.adapter, id.name]
      .filter(part => !_.isEmpty(part))
      .join(Keywords.NAMESPACE_SEPARATOR)
  }
  return id.getFullName()
}

const dumpAttributes = async (value: Value, functions: Functions): Promise<Value> => {
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

const dumpFieldBlock = async (field: Field, functions: Functions): Promise<DumpedHclBlock> => ({
  type: dumpElemID(field.refType.elemID),
  labels: [field.elemID.name],
  attrs: await dumpAttributes(field.annotations, functions),
  blocks: [],
})

const dumpAnnotationTypeBlock = (key: string, refType: TypeReference): DumpedHclBlock =>
  ({
    type: dumpElemID(refType.elemID),
    labels: [key],
    attrs: {},
    blocks: [],
  })

const dumpAnnotationTypesBlock = (annotationRefTypes: ReferenceMap): DumpedHclBlock[] =>
  (_.isEmpty(annotationRefTypes) ? [] : [{
    type: Keywords.ANNOTATIONS_DEFINITION,
    labels: [],
    attrs: {},
    blocks: Object.entries(annotationRefTypes)
      .map(([key, ref]) => dumpAnnotationTypeBlock(key, ref)),
  }])

const dumpElementBlock = async (
  elem: Readonly<Element>,
  functions: Functions
): Promise<DumpedHclBlock> => {
  if (isField(elem)) {
    return dumpFieldBlock(elem, functions)
  }
  if (isObjectType(elem)) {
    return {
      type: elem.isSettings ? Keywords.SETTINGS_DEFINITION : Keywords.TYPE_DEFINITION,
      labels: [dumpElemID(elem.elemID)],
      attrs: await dumpAttributes(elem.annotations, functions),
      blocks: dumpAnnotationTypesBlock(elem.annotationRefTypes).concat(
        await Promise.all(Object.values(elem.fields).map(field => dumpFieldBlock(field, functions)))
      ),
    }
  }
  if (isPrimitiveType(elem)) {
    return {
      type: Keywords.TYPE_DEFINITION,
      labels: [
        dumpElemID(elem.elemID),
        Keywords.TYPE_INHERITANCE_SEPARATOR,
        getPrimitiveTypeName(elem.primitive),
      ],
      attrs: await dumpAttributes(elem.annotations, functions),
      blocks: dumpAnnotationTypesBlock(elem.annotationRefTypes),
    }
  }
  if (isInstanceElement(elem)) {
    return {
      type: dumpElemID(elem.refType.elemID),
      labels: elem.elemID.isConfig() || elem.refType.elemID.isConfig()
      || elem.elemID.name === '_config' // TODO: should inject the correct type
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

const wrapBlocks = (blocks: DumpedHclBlock[]): DumpedHclBlock => ({
  type: '',
  labels: [],
  attrs: {},
  blocks,
})

export const dumpElements = async (
  elements: Readonly<Element>[], functions: Functions = {}, indentationLevel = 0
): Promise<string> =>
  hclDump(
    wrapBlocks(await awu(elements).map(e => dumpElementBlock(e, functions)).toArray()),
    indentationLevel
  )

export const dumpSingleAnnotationType = (
  name: string, refType: TypeReference, indentationLevel = 0
): string =>
  hclDump(wrapBlocks([dumpAnnotationTypeBlock(name, refType)]), indentationLevel)

export const dumpAnnotationTypes = (
  annotationRefTypes: ReferenceMap,
  indentationLevel = 0
): string =>
  hclDump(wrapBlocks(dumpAnnotationTypesBlock(annotationRefTypes)), indentationLevel)

export const dumpValues = async (
  value: Value, functions: Functions, indentationLevel = 0
): Promise<string> => {
  // Convert potential function values before dumping the value
  const valueWithSerializedFunctions = await dumpAttributes(value, functions)
  return dumpValue(valueWithSerializedFunctions, indentationLevel).join('\n').concat('\n')
}
