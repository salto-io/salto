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
import { types } from '@salto-io/lowerdash'
import {
  PrimitiveType, ElemID, Field, Element, BuiltinTypes, ListType,
  ObjectType, InstanceElement, isType, isElement,
  ReferenceExpression, TemplateExpression, VariableExpression,
  isInstanceElement, isReferenceExpression, Variable, isListType, StaticFile, isStaticFile,
} from '@salto-io/adapter-api'

import { InvalidStaticFile } from '../workspace/static_files/common'

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

// Do not use the class's name for serialization since it can change (e.g. by webpack)
/* eslint-disable object-shorthand */
const NameToType = {
  InstanceElement: InstanceElement,
  ObjectType: ObjectType,
  Variable: Variable,
  PrimitiveType: PrimitiveType,
  ListType: ListType,
  Field: Field,
  TemplateExpression: TemplateExpression,
  ReferenceExpression: ReferenceExpression,
  VariableExpression: VariableExpression,
  StaticFile: StaticFile,
}

type SerializedName = keyof typeof NameToType
type Serializable = InstanceType<types.ValueOf<typeof NameToType>>

export const SALTO_CLASS_FIELD = '_salto_class'
type SerializedClass = {
  [SALTO_CLASS_FIELD]: SerializedName
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

const ctorNameToSerializedName: Record<string, SerializedName> = _(NameToType).entries()
  .map(([name, type]) => [type.name, name]).fromPairs()
  .value()

type ReviverMap = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in SerializedName]: (v: any) => InstanceType<(typeof NameToType)[K]>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSaltoSerializable(value: any): value is Serializable {
  return _.some(Object.values(NameToType).map(t => value instanceof t))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSerializedClass(value: any): value is SerializedClass {
  return _.isPlainObject(value) && SALTO_CLASS_FIELD in value
    && value[SALTO_CLASS_FIELD] in NameToType
}

export const serialize = (elements: Element[],
  referenceSerializerMode: 'replaceRefWithValue' | 'keepRef' = 'replaceRefWithValue'): string => {
  const saltoClassReplacer = <T extends Serializable>(e: T): T & SerializedClass => {
    // Add property SALTO_CLASS_FIELD
    const o = e as T & SerializedClass
    o[SALTO_CLASS_FIELD] = ctorNameToSerializedName[e.constructor.name]
    return o
  }
  const staticFileReplacer = (e: StaticFile): Omit<StaticFile & SerializedClass, 'content'> => (
    _.omit(saltoClassReplacer(e), 'content')
  )
  const referenceExpressionReplacer = (e: ReferenceExpression):
    ReferenceExpression & SerializedClass => {
    if (e.value === undefined || referenceSerializerMode === 'keepRef') {
      return saltoClassReplacer(e.createWithValue(undefined))
    }
    // Replace ref with value in order to keep the result from changing between
    // a fetch and a deploy.
    if (isElement(e.value)) {
      return saltoClassReplacer(new ReferenceExpression(e.value.elemID))
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return generalReplacer(e.value)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generalReplacer = (e: any): any => {
    if (isReferenceExpression(e)) {
      return referenceExpressionReplacer(e)
    }
    if (isStaticFile(e)) {
      return staticFileReplacer(e)
    }
    if (isSaltoSerializable(e)) {
      return saltoClassReplacer(e)
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
  return JSON.stringify(sortedElements, (_k, e) => generalReplacer(e))
}

export type StaticFileReviver =
  (staticFile: StaticFile) => Promise<StaticFile | InvalidStaticFile>

export const deserialize = async (
  data: string,
  staticFileReviver?: StaticFileReviver,
): Promise<Element[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviveElemID = (v: {[key: string]: any}): ElemID => (
    new ElemID(v.adapter, v.typeName, v.idType, ...v.nameParts)
  )

  let staticFiles: Record<string, StaticFile> = {}

  const revivers: ReviverMap = {
    InstanceElement: v => new InstanceElement(
      reviveElemID(v.elemID).name,
      v.type,
      v.value,
      undefined,
      v.annotations,
    ),
    ObjectType: v => new ObjectType({
      elemID: reviveElemID(v.elemID),
      fields: v.fields,
      annotationTypes: v.annotationTypes,
      annotations: v.annotations,
    }),
    Variable: v => (
      new Variable(reviveElemID(v.elemID), v.value)
    ),
    PrimitiveType: v => new PrimitiveType({
      elemID: reviveElemID(v.elemID),
      primitive: v.primitive,
      annotationTypes: v.annotationTypes,
      annotations: v.annotations,
    }),
    ListType: v => new ListType(
      v.innerType
    ),
    Field: v => new Field(
      new ObjectType({ elemID: reviveElemID(v.elemID).createParentID() }),
      v.name,
      v.type,
      v.annotations,
    ),
    TemplateExpression: v => (
      new TemplateExpression({ parts: v.parts })
    ),
    ReferenceExpression: v => (
      new ReferenceExpression(reviveElemID(v.elemId))
    ),
    VariableExpression: v => (
      new VariableExpression(reviveElemID(v.elemId))
    ),
    StaticFile: v => {
      const staticFile = new StaticFile({ filepath: v.filepath, hash: v.hash })
      staticFiles[staticFile.filepath] = staticFile
      return staticFile
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementReviver = (_k: string, v: any): any => {
    if (isSerializedClass(v)) {
      const reviver = revivers[v[SALTO_CLASS_FIELD]]
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
