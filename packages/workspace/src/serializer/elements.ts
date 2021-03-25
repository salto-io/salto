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
import { types, collections } from '@salto-io/lowerdash'
import {
  PrimitiveType, ElemID, Field, Element, ListType, MapType,
  ObjectType, InstanceElement, isType, isElement, isContainerType,
  ReferenceExpression, TemplateExpression, VariableExpression,
  isReferenceExpression, Variable, StaticFile, isStaticFile,
  isInstanceElement, isPrimitiveType,
  FieldDefinition, isObjectType, Values, Value, TypeRefMap,
} from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { DuplicateAnnotationError, MergeError, isMergeError } from '../merger/internal/common'
import { DuplicateInstanceKeyError } from '../merger/internal/instances'
import { DuplicateAnnotationFieldDefinitionError, ConflictingFieldTypesError,
  ConflictingSettingError, DuplicateAnnotationTypeError } from '../merger/internal/object_types'
import { DuplicateVariableNameError } from '../merger/internal/variables'
import { MultiplePrimitiveTypesError } from '../merger/internal/primitives'

import { InvalidStaticFile } from '../workspace/static_files/common'
import { ValidationError, InvalidValueValidationError, InvalidValueTypeValidationError, InvalidStaticFileError, CircularReferenceValidationError, IllegalReferenceValidationError, UnresolvedReferenceValidationError, MissingRequiredFieldValidationError, RegexMismatchValidationError, InvalidValueRangeValidationError, isValidationError } from '../validator'

const { awu } = collections.asynciterable
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
  MapType: MapType,
  Field: Field,
  TemplateExpression: TemplateExpression,
  ReferenceExpression: ReferenceExpression,
  VariableExpression: VariableExpression,
  StaticFile: StaticFile,
  DuplicateAnnotationError: DuplicateAnnotationError,
  DuplicateInstanceKeyError: DuplicateInstanceKeyError,
  DuplicateAnnotationFieldDefinitionError: DuplicateAnnotationFieldDefinitionError,
  ConflictingFieldTypesError: ConflictingFieldTypesError,
  ConflictingSettingError: ConflictingSettingError,
  DuplicateAnnotationTypeError: DuplicateAnnotationTypeError,
  DuplicateVariableNameError: DuplicateVariableNameError,
  MultiplePrimitiveTypesError: MultiplePrimitiveTypesError,
  InvalidValueValidationError: InvalidValueValidationError,
  InvalidValueTypeValidationError: InvalidValueTypeValidationError,
  InvalidStaticFileError: InvalidStaticFileError,
  CircularReferenceValidationError: CircularReferenceValidationError,
  IllegalReferenceValidationError: IllegalReferenceValidationError,
  UnresolvedReferenceValidationError: UnresolvedReferenceValidationError,
  MissingRequiredFieldValidationError: MissingRequiredFieldValidationError,
  RegexMismatchValidationError: RegexMismatchValidationError,
  InvalidValueRangeValidationError: InvalidValueRangeValidationError,
}
const nameToTypeEntries = Object.entries(NameToType)
const possibleTypes = Object.values(NameToType)


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
  [K in SerializedName]: (v: any) => InstanceType<(typeof NameToType)[K]> | FieldDefinition
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSaltoSerializable(value: any): value is Serializable {
  return _.some(possibleTypes, t => value instanceof t)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSerializedClass(value: any): value is SerializedClass {
  return _.isPlainObject(value) && SALTO_CLASS_FIELD in value
    && value[SALTO_CLASS_FIELD] in NameToType
}

export const serialize = <T = Element>(
  elements: T[],
  referenceSerializerMode: 'replaceRefWithValue' | 'keepRef' = 'replaceRefWithValue'
): string => {
  const saltoClassReplacer = <T extends Serializable>(e: T): T & SerializedClass => {
    // Add property SALTO_CLASS_FIELD
    const o = _.clone(e as T & SerializedClass)
    o[SALTO_CLASS_FIELD] = ctorNameToSerializedName[e.constructor.name]
      || nameToTypeEntries.find(([_name, type]) => e instanceof type)?.[0]
    return o
  }
  const staticFileReplacer = (e: StaticFile): Omit<Omit<StaticFile & SerializedClass, 'internalContent'>, 'content'> => (
    _.omit(saltoClassReplacer(e), 'content', 'internalContent')
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
    return e.value
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolveCircles = (v: any): any => (
    isPrimitiveType(v)
      ? new PrimitiveType({ elemID: v.elemID, primitive: v.primitive })
      : new ObjectType({ elemID: v.elemID })
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const replacer = (v: any, k: any): any => {
    if (k !== undefined) {
      if (isType(v) && !isContainerType(v)) {
        return saltoClassReplacer(resolveCircles(v))
      }
      if (isReferenceExpression(v)) {
        return referenceExpressionReplacer(v)
      }
      if (isStaticFile(v)) {
        return staticFileReplacer(v)
      }
      if (isSaltoSerializable(v)) {
        return saltoClassReplacer(_.cloneDeepWith(v, replacer))
      }
    }
    return undefined
  }
  const cloneElements = elements.map(element => {
    const clone = _.cloneDeepWith(element, replacer)
    return isSaltoSerializable(element) ? saltoClassReplacer(clone) : clone
  })
  const sortedElements = _.sortBy(cloneElements, e => e.elemID.getFullName())
  // We don't use safeJsonStringify to save some time, because we know  we made sure there aren't
  // circles
  // eslint-disable-next-line no-restricted-syntax
  return JSON.stringify(sortedElements)
}

export type StaticFileReviver =
  (staticFile: StaticFile) => Promise<StaticFile | InvalidStaticFile>

const generalDeserialize = async <T>(data: string):
Promise<{ elements: T[]; staticFiles: Record<string, StaticFile> }> => {
  const staticFiles: Record<string, StaticFile> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviveElemID = (v: {[key: string]: any}): ElemID => (
    new ElemID(v.adapter, v.typeName, v.idType, ...v.nameParts)
  )

  const reviveReferenceExpression = (v: Value): ReferenceExpression => {
    const elemID = v.elemID ?? v.elemId
    return new ReferenceExpression(reviveElemID(elemID))
  }

  const reviveRefType = (v: Value): ReferenceExpression => {
    if (v.refType) {
      return v.refType
    }
    return createRefToElmWithValue(v.type)
  }

  const reviveAnnotationRefTypes = (v: Value): TypeRefMap => {
    if (v.annotationRefTypes) {
      return v.annotationRefTypes
    }
    return v.annotationTypes
  }

  const reviveRefInnerType = (v: Value): ReferenceExpression => {
    if (v.refInnerType) {
      return new ReferenceExpression(v.refInnerType.elemID)
    }
    return createRefToElmWithValue(v.innerType)
  }

  const revivers: ReviverMap = {
    InstanceElement: v => new InstanceElement(
      reviveElemID(v.elemID).name,
      reviveRefType(v),
      v.value,
      undefined,
      v.annotations,
    ),
    ObjectType: v => {
      const r = new ObjectType({
        elemID: reviveElemID(v.elemID),
        fields: v.fields,
        annotationRefsOrTypes: reviveAnnotationRefTypes(v),
        annotations: v.annotations,
        isSettings: v.isSettings,
      })
      return r
    },
    Variable: v => (
      new Variable(reviveElemID(v.elemID), v.value)
    ),
    PrimitiveType: v => new PrimitiveType({
      elemID: reviveElemID(v.elemID),
      primitive: v.primitive,
      annotationRefsOrTypes: reviveAnnotationRefTypes(v),
      annotations: v.annotations,
    }),
    ListType: v => new ListType(reviveRefInnerType(v)),
    MapType: v => new MapType(reviveRefInnerType(v)),
    Field: v => ({
      refType: reviveRefType(v),
      annotations: v.annotations,
    }),
    TemplateExpression: v => (
      new TemplateExpression({ parts: v.parts })
    ),
    ReferenceExpression: reviveReferenceExpression,
    VariableExpression: v => (
      new VariableExpression(reviveElemID(v.elemID ?? v.elemId))
    ),
    StaticFile: v => {
      const staticFile = new StaticFile(
        { filepath: v.filepath, hash: v.hash, encoding: v.encoding }
      )
      staticFiles[staticFile.filepath] = staticFile
      return staticFile
    },
    DuplicateAnnotationError: v => (
      new DuplicateAnnotationError({
        elemID: reviveElemID(v.elemID),
        key: v.key,
        existingValue: v.existingValue,
        newValue: v.newValue,
      })
    ),
    DuplicateInstanceKeyError: v => (
      new DuplicateInstanceKeyError({
        elemID: reviveElemID(v.elemID),
        key: v.key,
        existingValue: v.existingValue,
        newValue: v.newValue,
      })
    ),
    DuplicateAnnotationFieldDefinitionError: v => (
      new DuplicateAnnotationFieldDefinitionError({
        elemID: reviveElemID(v.elemID),
        annotationKey: v.annotationKey,
      })
    ),
    ConflictingFieldTypesError: v => (
      new ConflictingFieldTypesError({
        elemID: reviveElemID(v.elemID),
        definedTypes: v.definedTypes,
      })
    ),
    ConflictingSettingError: v => (
      new ConflictingSettingError({ elemID: reviveElemID(v.elemID) })
    ),
    DuplicateAnnotationTypeError: v => (
      new DuplicateAnnotationTypeError({
        elemID: reviveElemID(v.elemID),
        key: v.key,
      })
    ),
    DuplicateVariableNameError: v => (
      new DuplicateVariableNameError({ elemID: reviveElemID(v.elemID) })
    ),
    MultiplePrimitiveTypesError: v => (
      new MultiplePrimitiveTypesError({
        elemID: reviveElemID(v.elemID),
        duplicates: v.duplicates,
      })
    ),
    InvalidValueValidationError: v => (
      new InvalidValueValidationError({
        elemID: reviveElemID(v.elemID),
        value: v.value,
        expectedValue: v.expectedValue,
        fieldName: v.fieldName,
      })
    ),
    InvalidValueTypeValidationError: v => new InvalidValueTypeValidationError({
      elemID: reviveElemID(v.elemID),
      value: v.error,
      type: reviveElemID(v.type),
    }),
    InvalidStaticFileError: v => (
      new InvalidStaticFileError({
        elemID: reviveElemID(v.elemID),
        value: { message: v.error },
      })
    ),
    CircularReferenceValidationError: v => (
      new CircularReferenceValidationError({
        elemID: reviveElemID(v.elemID),
        ref: v.ref,
      })
    ),
    IllegalReferenceValidationError: v => (
      new IllegalReferenceValidationError({
        elemID: reviveElemID(v.elemID),
        reason: v.reason,
      })
    ),
    UnresolvedReferenceValidationError: v => (
      new UnresolvedReferenceValidationError({
        elemID: reviveElemID(v.elemID),
        target: reviveElemID(v.target),
      })
    ),
    MissingRequiredFieldValidationError: v => (
      new MissingRequiredFieldValidationError({
        elemID: reviveElemID(v.elemID),
        fieldName: v.fieldName,
      })
    ),
    RegexMismatchValidationError: v => (
      new RegexMismatchValidationError({
        elemID: reviveElemID(v.elemID),
        fieldName: v.fieldName,
        regex: v.regex,
        value: v.value,
      })
    ),
    InvalidValueRangeValidationError: v => (
      new InvalidValueRangeValidationError({
        elemID: reviveElemID(v.elemID),
        fieldName: v.fieldName,
        value: v.value,
        maxValue: v.maxValue,
        minValue: v.minValue,
      })
    ),
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
  const elements = JSON.parse(data, elementReviver)
  return { elements, staticFiles }
}

export const deserializeMergeErrors = async (data: string): Promise<MergeError[]> => {
  const { elements: errors } = (await generalDeserialize<MergeError>(data))
  if (errors.some(error => !isMergeError(error))) {
    throw new Error('Deserialization failed. At least one element did not deserialize to a MergeError')
  }
  return errors
}

export const deserializeValidationErrors = async (data: string): Promise<ValidationError[]> => {
  const { elements: errors } = (await generalDeserialize<ValidationError>(data))
  if (errors.some(error => !isValidationError(error))) {
    throw new Error('Deserialization failed. At least one element did not deserialize to a ValidationError')
  }
  return errors
}

export const deserialize = async (
  data: string,
  staticFileReviver?: StaticFileReviver,
): Promise<Element[]> => {
  const res = await generalDeserialize<Element>(data)
  let { staticFiles } = res
  const { elements } = res

  if (staticFileReviver) {
    staticFiles = _.fromPairs(
      await awu(Object.entries(staticFiles))
        .map(async ([key, val]) => ([key, await staticFileReviver(val)]))
        .toArray()
    )
  }

  const reviveStaticFiles = (values: Values): Values => _.cloneDeepWith(values, v => {
    if (isStaticFile(v)) {
      return staticFiles[v.filepath]
    }
    return undefined
  })
  elements.forEach(element => {
    element.annotations = reviveStaticFiles(element.annotations)
    if (isObjectType(element)) {
      Object.values(element.fields).forEach(field => {
        field.annotations = reviveStaticFiles(field.annotations)
      })
    }
    if (isInstanceElement(element)) {
      element.value = reviveStaticFiles(element.value)
    }
  })
  if (elements.some(elem => !isElement(elem))) {
    throw new Error('Deserialization failed. At least one element did not deserialize to an Element')
  }
  return elements
}

export const deserializeSingleElement = async (
  data: string, staticFileReviver?: StaticFileReviver
): Promise<Element> => {
  const elements = (await deserialize(data, staticFileReviver)) as Element[]
  if (elements.length !== 1) {
    throw new Error('Deserialization failed. should receive single element')
  }
  return elements[0]
}
