/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { collections, types, serialize as lowerdashSerialize } from '@salto-io/lowerdash'
import {
  PrimitiveType, ElemID, Field, Element, ListType, MapType,
  ObjectType, InstanceElement, isType, isElement, isContainerType,
  ReferenceExpression, TemplateExpression, VariableExpression,
  isReferenceExpression, Variable, StaticFile, isStaticFile,
  isPrimitiveType, FieldDefinition, Value, TypeRefMap, TypeReference, isTypeReference,
  isVariableExpression, PlaceholderObjectType,
} from '@salto-io/adapter-api'
import { DuplicateAnnotationError, MergeError, isMergeError } from '../merger/internal/common'
import { DuplicateInstanceKeyError } from '../merger/internal/instances'
import { DuplicateAnnotationFieldDefinitionError, ConflictingFieldTypesError,
  ConflictingSettingError, DuplicateAnnotationTypeError } from '../merger/internal/object_types'
import { DuplicateVariableNameError } from '../merger/internal/variables'
import { MultiplePrimitiveTypesError } from '../merger/internal/primitives'

import { InvalidStaticFile, MissingStaticFile, AccessDeniedStaticFile } from '../workspace/static_files/common'
import {
  ValidationError,
  InvalidValueValidationError,
  InvalidValueTypeValidationError,
  InvalidStaticFileError,
  CircularReferenceValidationError,
  IllegalReferenceValidationError,
  UnresolvedReferenceValidationError,
  MissingRequiredFieldValidationError,
  AdditionalPropertiesValidationError,
  RegexMismatchValidationError,
  InvalidValueRangeValidationError,
  InvalidValueMaxLengthValidationError,
  isValidationError,
  InvalidTypeValidationError,
  InvalidValueMaxListLengthValidationError,
} from '../validator'

const { awu } = collections.asynciterable
const { getSerializedStream } = lowerdashSerialize

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
// 2. Replaces all the pointers with "placeholder" objects
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
  TypeReference: TypeReference,
  VariableExpression: VariableExpression,
  StaticFile: StaticFile,
  MissingStaticFile: MissingStaticFile,
  AccessDeniedStaticFile: AccessDeniedStaticFile,
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
  AdditionalPropertiesValidationError: AdditionalPropertiesValidationError,
  RegexMismatchValidationError: RegexMismatchValidationError,
  InvalidValueRangeValidationError: InvalidValueRangeValidationError,
  InvalidValueMaxLengthValidationError: InvalidValueMaxLengthValidationError,
  InvalidTypeValidationError: InvalidTypeValidationError,
  InvalidValueMaxListLengthValidationError: InvalidValueMaxListLengthValidationError,
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
  [K in SerializedName]: (v: any) => InstanceType<(typeof NameToType)[K]>
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

export const serializeStream = async <T = Element>(
  elements: T[],
  referenceSerializerMode: 'replaceRefWithValue' | 'keepRef' = 'replaceRefWithValue',
  storeStaticFile?: (file: StaticFile) => Promise<void>
): Promise<AsyncIterable<string>> => {
  const promises: Promise<void>[] = []

  // eslint-disable-next-line @typescript-eslint/no-shadow
  const saltoClassReplacer = <T extends Serializable>(e: T): T & SerializedClass => {
    // Add property SALTO_CLASS_FIELD
    const o = _.clone(e as T & SerializedClass)
    o[SALTO_CLASS_FIELD] = ctorNameToSerializedName[e.constructor.name]
      || nameToTypeEntries.find(([_name, type]) => e instanceof type)?.[0]
    return o
  }
  const staticFileReplacer = (e: StaticFile): Omit<Omit<StaticFile & SerializedClass, 'internalContent'>, 'content'> => {
    if (storeStaticFile !== undefined) {
      promises.push(storeStaticFile(e))
    }
    return _.pick(saltoClassReplacer(e), SALTO_CLASS_FIELD, 'filepath', 'hash', 'encoding')
  }

  const elemIdReplacer = (id: ElemID): Omit<Omit<StaticFile & SerializedClass, 'internalContent'>, 'content'> =>
    _.pick(id, 'adapter', 'typeName', 'idType', 'nameParts')

  const referenceExpressionReplacer = (e: ReferenceExpression):
    ReferenceExpression & SerializedClass => {
    if (e.value === undefined || referenceSerializerMode === 'keepRef' || !isVariableExpression(e)) {
      return saltoClassReplacer(e.createWithValue(undefined))
    }
    // Replace ref with value in order to keep the result from changing between
    // a fetch and a deploy.
    if (isElement(e.value)) {
      return saltoClassReplacer(new ReferenceExpression(e.value.elemID))
    }
    // eslint-disable-next-line no-use-before-define
    return _.cloneDeepWith(e.value, replacer)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolveCircles = (v: any): any => (
    isPrimitiveType(v)
      ? new PrimitiveType({ elemID: v.elemID, primitive: v.primitive })
      : new ObjectType({ elemID: v.elemID })
  )
  const referenceTypeReplacer = (e: TypeReference):
  TypeReference & SerializedClass => {
    if (referenceSerializerMode === 'keepRef') {
      if (isType(e.type) && !isContainerType(e.type)) {
        return saltoClassReplacer(new TypeReference(e.elemID, resolveCircles(e.type)))
      }
    }
    return saltoClassReplacer(new TypeReference(e.elemID))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const replacer = (v: any, k: any): any => {
    if (k !== undefined) {
      if (isType(v) && !isContainerType(v)) {
        return saltoClassReplacer(resolveCircles(v))
      }
      if (isReferenceExpression(v)) {
        return referenceExpressionReplacer(v)
      }
      if (isTypeReference(v)) {
        return referenceTypeReplacer(v)
      }
      if (isStaticFile(v)) {
        return staticFileReplacer(v)
      }
      if (isSaltoSerializable(v)) {
        return saltoClassReplacer(_.cloneDeepWith(v, replacer))
      }
      if (v instanceof ElemID) {
        return elemIdReplacer(v)
      }
    }
    return undefined
  }
  const clonedElements = elements.map(element => {
    const clone = _.cloneDeepWith(element, replacer)
    return isSaltoSerializable(element) ? saltoClassReplacer(clone) : clone
  })

  // Avoiding Promise.all to not reach Promise.all limit
  await awu(promises).forEach(promise => promise)

  // avoid creating a single string for all elements, which may exceed the max allowed string length
  // We don't use safeJsonStringify to save some time, because we know  we made sure there aren't
  // circles
  return getSerializedStream(clonedElements)
}

export const serialize = async <T = Element>(
  elements: T[],
  referenceSerializerMode: 'replaceRefWithValue' | 'keepRef' = 'replaceRefWithValue',
  storeStaticFile?: (file: StaticFile) => Promise<void>
): Promise<string> => (
  (await awu(await serializeStream(elements, referenceSerializerMode, storeStaticFile)).toArray()).join('')
)

export type StaticFileReviver =
  (staticFile: StaticFile) => Promise<StaticFile | InvalidStaticFile>

const generalDeserializeParsed = async <T>(
  parsed: unknown,
  staticFileReviver?: StaticFileReviver
): Promise<T[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staticFiles: { obj: any; key: string | number }[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const restoreClasses = (value: any): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviveElemID = (v: Record<string, any>): ElemID => (
      new ElemID(v.adapter, v.typeName, v.idType, ...v.nameParts)
    )

    const reviveReferenceExpression = (v: Value): ReferenceExpression => {
      const elemID = v.elemID ?? v.elemId
      return new ReferenceExpression(reviveElemID(elemID))
    }

    const reviveRefTypeOfElement = (v: Value): TypeReference => {
      if (v.refType !== undefined) {
        return restoreClasses(v.refType)
      }
      return restoreClasses(v.type)
    }

    const reviveAnnotationRefTypes = (v: Value): TypeRefMap => {
      if (v.annotationRefTypes) {
        return restoreClasses(v.annotationRefTypes)
      }
      return restoreClasses(v.annotationTypes)
    }

    const reviveRefInnerType = (v: Value): TypeReference => {
      if (v.refInnerType) {
        return restoreClasses(v.refInnerType)
      }
      return restoreClasses(v.innerType)
    }

    const reviveFieldDefinitions = (v: Value): Record<string, FieldDefinition> => (
      _.isPlainObject(v)
        ? _.mapValues(
          _.pickBy(v, val => isSerializedClass(val) && val[SALTO_CLASS_FIELD] === 'Field'),
          val => ({
            refType: reviveRefTypeOfElement(val),
            annotations: restoreClasses(val.annotations),
          })
        )
        : {}
    )

    const revivers: ReviverMap = {
      InstanceElement: v => new InstanceElement(
        v.elemID.nameParts[0],
        reviveRefTypeOfElement(v),
        restoreClasses(v.value),
        v.path,
        restoreClasses(v.annotations),
      ),
      ObjectType: v => {
        const r = new ObjectType({
          elemID: reviveElemID(v.elemID),
          fields: reviveFieldDefinitions(v.fields),
          annotationRefsOrTypes: reviveAnnotationRefTypes(v),
          annotations: restoreClasses(v.annotations),
          isSettings: v.isSettings,
          path: v.path,
        })
        return r
      },
      Variable: v => (
        new Variable(reviveElemID(v.elemID), restoreClasses(v.value))
      ),
      PrimitiveType: v => new PrimitiveType({
        elemID: reviveElemID(v.elemID),
        primitive: v.primitive,
        annotationRefsOrTypes: reviveAnnotationRefTypes(v),
        annotations: restoreClasses(v.annotations),
        path: v.path,
      }),
      ListType: v => new ListType(reviveRefInnerType(v)),
      MapType: v => new MapType(reviveRefInnerType(v)),
      Field: v => {
        const elemId = reviveElemID(v.elemID)
        return new Field(
          // when we deserialize a single field we don't have the context of its parent.
          // in this case we set a placeholder object type so we're able to recognize it later.
          new PlaceholderObjectType({ elemID: new ElemID(elemId.adapter, elemId.typeName) }),
          elemId.name,
          reviveRefTypeOfElement(v),
          restoreClasses(v.annotations),
        )
      },
      TemplateExpression: v => (
        new TemplateExpression({ parts: restoreClasses(v.parts) })
      ),
      ReferenceExpression: reviveReferenceExpression,
      TypeReference: v => (
        new TypeReference(reviveElemID(v.elemID))
      ),
      VariableExpression: v => (
        new VariableExpression(reviveElemID(v.elemID ?? v.elemId))
      ),
      StaticFile: v => (
        new StaticFile(
          { filepath: v.filepath, hash: v.hash, encoding: v.encoding }
        )
      ),
      MissingStaticFile: v => new MissingStaticFile(v.filepath),
      AccessDeniedStaticFile: v => new AccessDeniedStaticFile(v.filepath),
      DuplicateAnnotationError: v => (
        new DuplicateAnnotationError({
          elemID: reviveElemID(v.elemID),
          key: v.key,
          existingValue: restoreClasses(v.existingValue),
          newValue: restoreClasses(v.newValue),
        })
      ),
      DuplicateInstanceKeyError: v => (
        new DuplicateInstanceKeyError({
          elemID: reviveElemID(v.elemID),
          key: v.key,
          existingValue: restoreClasses(v.existingValue),
          newValue: restoreClasses(v.newValue),
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
          duplicates: restoreClasses(v.duplicates),
        })
      ),
      InvalidValueValidationError: v => (
        new InvalidValueValidationError({
          elemID: reviveElemID(v.elemID),
          value: restoreClasses(v.value),
          expectedValue: restoreClasses(v.expectedValue),
          fieldName: v.fieldName,
        })
      ),
      InvalidValueTypeValidationError: v => new InvalidValueTypeValidationError({
        elemID: reviveElemID(v.elemID),
        value: restoreClasses(v.error),
        type: reviveElemID(v.type),
      }),
      InvalidStaticFileError: v => (
        new InvalidStaticFileError({
          elemID: reviveElemID(v.elemID),
          error: v.error,
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
      AdditionalPropertiesValidationError: v => (
        new AdditionalPropertiesValidationError({
          elemID: reviveElemID(v.elemID),
          fieldName: v.fieldName,
          typeName: v.typeName,
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
          value: restoreClasses(v.value),
          maxValue: v.maxValue,
          minValue: v.minValue,
        })
      ),
      InvalidValueMaxLengthValidationError: v => (
        new InvalidValueMaxLengthValidationError({
          elemID: reviveElemID(v.elemID),
          fieldName: v.fieldName,
          value: v.value,
          maxLength: v.maxLength,
        })
      ),
      InvalidValueMaxListLengthValidationError: v => (
        new InvalidValueMaxListLengthValidationError({
          elemID: reviveElemID(v.elemID),
          fieldName: v.fieldName,
          size: v.size,
          maxListLength: v.maxContainerSize,
        })
      ),
      InvalidTypeValidationError: v => (
        new InvalidTypeValidationError(
          reviveElemID(v.elemID),
        )
      ),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const restoreClassesInner = (val: any, parentObj: any, keyInParent: string | number): void => {
      if (isSerializedClass(val)) {
        const reviver = revivers[val[SALTO_CLASS_FIELD]]
        const revived = reviver(val)
        if (staticFileReviver !== undefined && isStaticFile(revived)) {
          staticFiles.push({ obj: parentObj, key: keyInParent })
          parentObj[keyInParent] = staticFileReviver(revived)
        } else {
          parentObj[keyInParent] = revived
        }
      } else if (_.isPlainObject(val)) {
        Object.entries(val).forEach(([k, v]) => restoreClassesInner(v, val, k))
      } else if (Array.isArray(val)) {
        val.forEach((v, idx) => restoreClassesInner(v, val, idx))
      }
    }
    if (isSerializedClass(value)) {
      const reviver = revivers[value[SALTO_CLASS_FIELD]]
      return reviver(value)
    }
    // Restore classes in the given value (in-place)
    restoreClassesInner(value, { value }, 'value')
    return value
  }

  if (!Array.isArray(parsed)) {
    throw new Error('got non-array JSON data')
  }
  const elements = parsed.map(restoreClasses)
  if (staticFiles.length > 0) {
    await Promise.all(staticFiles.map(
      async ({ obj, key }) => {
        obj[key] = await obj[key]
      }
    ))
  }
  return elements
}

const generalDeserialize = async <T>(
  data: string,
  staticFileReviver?: StaticFileReviver
): Promise<T[]> => {
  const parsed = JSON.parse(data)
  return generalDeserializeParsed(parsed, staticFileReviver)
}

export const deserializeMergeErrors = async (data: string): Promise<MergeError[]> => {
  const errors = (await generalDeserialize<MergeError>(data))
  if (errors.some(error => !isMergeError(error))) {
    throw new Error('Deserialization failed. At least one element did not deserialize to a MergeError')
  }
  return errors
}

export const deserializeValidationErrors = async (data: string): Promise<ValidationError[]> => {
  const errors = (await generalDeserialize<ValidationError>(data))
  if (errors.some(error => !isValidationError(error))) {
    throw new Error('Deserialization failed. At least one element did not deserialize to a ValidationError')
  }
  return errors
}

export const deserialize = async (
  data: string,
  staticFileReviver?: StaticFileReviver,
): Promise<Element[]> => {
  const elements = await generalDeserialize<Element>(data, staticFileReviver)

  if (elements.some(elem => !isElement(elem))) {
    throw new Error('Deserialization failed. At least one element did not deserialize to an Element')
  }
  return elements
}

export const deserializeSingleElement = async (
  data: string, staticFileReviver?: StaticFileReviver
): Promise<Element> => {
  const elements = await deserialize(data, staticFileReviver)
  if (elements.length !== 1) {
    throw new Error('Deserialization failed. should receive single element')
  }
  return elements[0]
}

export const deserializeParsed = async (
  parsed: unknown,
  staticFileReviver?: StaticFileReviver,
): Promise<Element[]> => {
  const elements = await generalDeserializeParsed<Element>(parsed, staticFileReviver)

  if (elements.some(elem => !isElement(elem))) {
    throw new Error('Deserialization failed. At least one element did not deserialize to an Element')
  }
  return elements
}
