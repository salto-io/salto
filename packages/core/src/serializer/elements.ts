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
  PrimitiveType, ElemID, Field, Element, BuiltinTypes, ListType,
  ObjectType, InstanceElement, isType, isElement, isExpression,
  ReferenceExpression, TemplateExpression, Expression, VariableExpression,
  isInstanceElement, isReferenceExpression, Variable, isListType, StaticFile, isStaticFile,
} from '@salto-io/adapter-api'

// There are two issues with naive json stringification:
//
// 1) The class type information and methods are lost
//
// 2) Pointers are dumped by value, so if multiple object
//    point to the same object (for example, multiple type
//    instances for the same type) then the stringify process
//    will result in multiple copies of that object.
//
// To address this issue the serialization process:
//
// 1. Adds a '_salto_class' field with the class name to the object during the serialization.
// 2. Replaces all of the pointers with "placeholder" objects
//
// The deserialization process recover the information by creating the classes based
// on the _salto_class field, and then replacing the placeholders using the regular merge method.

export const SALTO_CLASS_FIELD = '_salto_class'
interface ClassName {[SALTO_CLASS_FIELD]: string}
export const serialize = (elements: Element[]): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementReplacer = (_k: string, e: any): any => {
    if (isReferenceExpression(e)) {
      // Add property SALTO_CLASS_FIELD to o
      const o = e.createWithValue(undefined) as typeof e & ClassName
      o[SALTO_CLASS_FIELD] = e.constructor.name
      return o
    }
    if (isElement(e) || isExpression(e)) {
      const o = e as Element & ClassName
      o[SALTO_CLASS_FIELD] = e.constructor.name
      return o
    }
    if (isStaticFile(e)) {
      const o = e as typeof e & ClassName
      o[SALTO_CLASS_FIELD] = e.constructor.name
      return _.omit(o, 'content')
    }
    // We need to sort objects so that the state file won't change for the same data.
    if (_.isPlainObject(e)) {
      return _(e).toPairs().sortBy().fromPairs()
        .value()
    }
    return e
  }

  const weakElements = elements.map(element => _.cloneDeepWith(
    element,
    (v, k) => ((k !== undefined && isType(v) && !isListType(v))
      ? new ObjectType({ elemID: v.elemID }) : undefined)
  ))
  const sortedElements = _.sortBy(weakElements, e => e.elemID.getFullName())
  return JSON.stringify(sortedElements, elementReplacer)
}

export type StaticFileReviver =
  (staticFile: StaticFile) => Promise<StaticFile>

export const deserialize = async (
  data: string,
  staticFileReviver?: StaticFileReviver,
): Promise<Element[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviveElemID = (v: {[key: string]: any}): ElemID => (
    new ElemID(v.adapter, v.typeName, v.idType, ...v.nameParts)
  )

  let staticFiles: Record<string, StaticFile> = {}

  const revivers: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: (v: {[key: string]: any}) => Element|Expression|StaticFile
  } = {
    [InstanceElement.serializedTypeName]: v => new InstanceElement(
      reviveElemID(v.elemID).name,
      v.type,
      v.value,
      undefined,
      v.annotations,
    ),
    [ObjectType.serializedTypeName]: v => new ObjectType({
      elemID: reviveElemID(v.elemID),
      fields: v.fields,
      annotationTypes: v.annotationTypes,
      annotations: v.annotations,
    }),
    [Variable.serializedTypeName]: v => new Variable(reviveElemID(v.elemID), v.value),
    [PrimitiveType.serializedTypeName]: v => new PrimitiveType({
      elemID: reviveElemID(v.elemID),
      primitive: v.primitive,
      annotationTypes: v.annotationTypes,
      annotations: v.annotations,
    }),
    [ListType.serializedTypeName]: v => new ListType(
      v.innerType
    ),
    [Field.serializedTypeName]: v => new Field(
      reviveElemID(v.parentID),
      v.name,
      v.type,
      v.annotations,
    ),
    [TemplateExpression.serializedTypeName]: v => new TemplateExpression({ parts: v.parts }),
    [ReferenceExpression.serializedTypeName]: v => new ReferenceExpression(reviveElemID(v.elemId)),
    [VariableExpression.serializedTypeName]: v => new VariableExpression(reviveElemID(v.elemId)),
    [StaticFile.serializedTypeName]: v => {
      const staticFile = new StaticFile(v.filepath, v.hash)
      staticFiles[staticFile.filepath] = staticFile
      return staticFile
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementReviver = (_k: string, v: any): any => {
    const reviver = revivers[v[SALTO_CLASS_FIELD]]
    if (reviver) {
      const e = reviver(v)
      if (isType(e) || isInstanceElement(e)) {
        e.path = v.path
      }
      return e
    }
    return v
  }

  const elements = JSON.parse(data, elementReviver) as Element[]

  if (staticFileReviver) {
    staticFiles = _.fromPairs(
      (await Promise.all(
        _.entries(staticFiles).map(async ([key, val]) => ([key, await staticFileReviver(val)]))
      ))
    )
  }
  const elementsMap = _.keyBy(elements.filter(isType), e => e.elemID.getFullName())
  const builtinMap = _(BuiltinTypes).values().keyBy(b => b.elemID.getFullName()).value()
  const typeMap = _.merge({}, elementsMap, builtinMap)
  elements.forEach(element => {
    _.keys(element).forEach(k => {
      _.set(element, k, _.cloneDeepWith(_.get(element, k), v => {
        if (isType(v)) {
          return typeMap[v.elemID.getFullName()]
        }
        if (isStaticFile(v)) {
          return staticFiles[v.filepath]
        }
        return undefined
      }))
    })
  })


  return Promise.resolve(elements)
}
