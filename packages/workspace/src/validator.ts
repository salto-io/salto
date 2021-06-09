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
import { types, collections, values } from '@salto-io/lowerdash'
import {
  Element, isObjectType, isInstanceElement, TypeElement, InstanceElement, Field, PrimitiveTypes,
  isPrimitiveType, Value, ElemID, CORE_ANNOTATIONS, SaltoElementError, SaltoErrorSeverity,
  Values, isElement, isListType, getRestriction, isVariable, Variable, isPrimitiveValue, ListType,
  isReferenceExpression, StaticFile, isContainerType, isMapType, ObjectType,
  InstanceAnnotationTypes, GLOBAL_ADAPTER, SaltoError, ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { toObjectType, createRefToElmWithValue, elementAnnotationTypes } from '@salto-io/adapter-utils'
import { InvalidStaticFile } from './workspace/static_files/common'
import { UnresolvedReference, resolve, CircularReference } from './expressions'
import { IllegalReference } from './parser/parse'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

export abstract class ValidationError extends types.Bean<{
  elemID: ElemID
  error: string
  severity: SaltoErrorSeverity
}> implements SaltoElementError {
  get message(): string {
    return `Error validating "${this.elemID.getFullName()}": ${this.error}`
  }

  toString(): string {
    return this.message
  }
}

export const isValidationError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
): value is ValidationError => value instanceof ValidationError

const primitiveValidators = {
  [PrimitiveTypes.STRING]: _.isString,
  [PrimitiveTypes.NUMBER]: _.isNumber,
  [PrimitiveTypes.BOOLEAN]: _.isBoolean,
  [PrimitiveTypes.UNKNOWN]: (value: Value) => value !== undefined,
}

/**
 * Validate that all type fields values corresponding with core annotations (required, values)
 * @param value
 * @param type
 */
const validateAnnotations = async (
  elemID: ElemID,
  value: Value,
  type: TypeElement,
  elementsSource: ReadOnlyElementsSource
):
Promise<ValidationError[]> => {
  if (isObjectType(type)) {
    return awu(Object.keys(type.fields)).flatMap(
      // eslint-disable-next-line no-use-before-define
      async k => validateFieldAnnotations(
        elemID.createNestedID(k),
        value[k],
        type.fields[k],
        elementsSource,
      )
    ).toArray()
  }

  return []
}

export class InvalidValueValidationError extends ValidationError {
  readonly value: Value
  readonly fieldName: string
  readonly expectedValue: unknown

  constructor(
    { elemID, value, fieldName, expectedValue }:
      { elemID: ElemID; value: Value; fieldName: string; expectedValue: unknown }
  ) {
    const expectedValueStr = _.isArray(expectedValue)
      ? `one of: ${(expectedValue as []).map(v => `"${v}"`).join(', ')}`
      : `"${expectedValue}"`

    super({
      elemID,
      error: `Value is not valid for field ${fieldName} expected ${expectedValueStr}`,
      severity: 'Warning',
    })
    this.value = value
    this.fieldName = fieldName
    this.expectedValue = expectedValue
  }
}

export class InvalidValueRangeValidationError extends ValidationError {
  readonly value: Value
  readonly fieldName: string
  readonly minValue?: number
  readonly maxValue?: number

  static formatExpectedValue(minValue: number | undefined, maxValue: number | undefined): string {
    const minErrStr: string = _.isUndefined(minValue) ? '' : `bigger than ${minValue}`
    const maxErrStr: string = _.isUndefined(maxValue) ? '' : `smaller than ${maxValue}`
    return _.join([minErrStr, maxErrStr], ' and ')
  }

  constructor(
    { elemID, value, fieldName, minValue, maxValue }:
      { elemID: ElemID; value: Value; fieldName: string; minValue?: number; maxValue?: number }
  ) {
    super({
      elemID,
      error: `Value "${value}" is not valid for field ${fieldName}`
        + ` expected to be ${InvalidValueRangeValidationError.formatExpectedValue(minValue, maxValue)}`,
      severity: 'Warning',
    })
    this.value = value
    this.fieldName = fieldName
    this.minValue = minValue
    this.maxValue = maxValue
  }
}

export class RegexMismatchValidationError extends ValidationError {
  readonly value: Value
  readonly fieldName: string
  readonly regex: string

  constructor({ elemID, value, fieldName, regex }:
    { elemID: ElemID; value: Value; fieldName: string; regex: string }) {
    super({
      elemID,
      error: `Value "${value}" is not valid for field ${fieldName}.`
        + ` expected value to match "${regex}" regular expression`,
      severity: 'Warning',
    })
    this.value = value
    this.fieldName = fieldName
    this.regex = regex
  }
}

export class InvalidValueLengthValidationError extends ValidationError {
  readonly value: Value
  readonly fieldName: string
  readonly length: number

  constructor({ elemID, value, fieldName, length }:
    { elemID: ElemID; value: Value; fieldName: string; length: number }) {
    super({
      elemID,
      error: `Value "${value}" is too long for field.`
        + ` ${fieldName} maximum length is "${length}"`,
      severity: 'Warning',
    })
    this.value = value
    this.fieldName = fieldName
    this.length = length
  }
}
export class MissingRequiredFieldValidationError extends ValidationError {
  readonly fieldName: string

  constructor({ elemID, fieldName }: { elemID: ElemID; fieldName: string }) {
    super({
      elemID,
      error: `Field ${fieldName} is required but has no value`,
      severity: 'Warning',
    })
    this.fieldName = fieldName
  }
}

export class UnresolvedReferenceValidationError extends ValidationError {
  readonly target: ElemID
  constructor(
    { elemID, target }:
    { elemID: ElemID; target: ElemID }
  ) {
    super({ elemID, error: `unresolved reference ${target.getFullName()}`, severity: 'Warning' })
    this.target = target
  }
}

export const isUnresolvedRefError = (
  err: SaltoError
): err is UnresolvedReferenceValidationError => (
  err instanceof UnresolvedReferenceValidationError
)


export class IllegalReferenceValidationError extends ValidationError {
  readonly reason: string
  constructor(
    { elemID, reason }:
    { elemID: ElemID; reason: string }
  ) {
    super({ elemID, error: `illegal reference target, ${reason}`, severity: 'Warning' })
    this.reason = reason
  }
}

export class CircularReferenceValidationError extends ValidationError {
  readonly ref: string
  constructor(
    { elemID, ref }:
    { elemID: ElemID; ref: string }
  ) {
    super({ elemID, error: `circular reference ${ref}`, severity: 'Warning' })
    this.ref = ref
  }
}

export class InvalidStaticFileError extends ValidationError {
  constructor({ elemID, value }: { elemID: ElemID; value: InvalidStaticFile }) {
    super({
      elemID,
      error: value.message,
      severity: 'Error',
    })
  }
}

const validateAnnotationsValue = async (
  elemID: ElemID,
  value: Value,
  annotations: Values,
  type: TypeElement,
  elementsSource: ReadOnlyElementsSource
): Promise<ValidationError[] | undefined> => {
  const restrictions = getRestriction({ annotations })
  const shouldEnforceValue = (): boolean =>
    restrictions.enforce_value !== false
    && !(isReferenceExpression(value) && isElement(value.value))

  const validateRestrictionsValue = (val: Value):
    ValidationError[] => {
    // When value is array we iterate (validate) each element
    if (_.isArray(val)) {
      return val.flatMap(v => validateRestrictionsValue(v))
    }

    const validateValueInsideRange = (): ValidationError[] => {
      const minValue = restrictions.min
      const maxValue = restrictions.max
      if ((values.isDefined(minValue) && (!_.isNumber(val) || (val < minValue)))
        || (values.isDefined(maxValue) && (!_.isNumber(val) || (val > maxValue)))) {
        return [
          new InvalidValueRangeValidationError(
            { elemID, value, fieldName: elemID.name, minValue, maxValue }
          ),
        ]
      }
      return []
    }

    const validateValueInList = (): ValidationError[] => {
      const restrictionValues = makeArray(restrictions.values)
      if (_.isEmpty(restrictionValues)) {
        return []
      }
      if (!restrictionValues.some(i => _.isEqual(i, val))) {
        return [
          new InvalidValueValidationError(
            { elemID, value, fieldName: elemID.name, expectedValue: restrictionValues }
          ),
        ]
      }
      return []
    }

    const validateRegexMatches = (): ValidationError[] => {
      if (!_.isUndefined(restrictions.regex) && !new RegExp(restrictions.regex).test(val)) {
        return [new RegexMismatchValidationError(
          { elemID, value, fieldName: elemID.name, regex: restrictions.regex }
        )]
      }
      return []
    }

    const validateLengthLimit = (): ValidationError[] => {
      const maxLength = restrictions.length_limit
      if ((values.isDefined(maxLength) && (!_.isString(val) || (val.length > maxLength)))) {
        return [
          new InvalidValueLengthValidationError(
            { elemID, value, fieldName: elemID.name, length: maxLength }
          ),
        ]
      }
      return []
    }

    const restrictionValidations = [
      validateValueInsideRange,
      validateValueInList,
      validateRegexMatches,
      validateLengthLimit,
    ]
    return restrictionValidations.flatMap(validation => validation())
  }

  const validateRequiredValue = (): ValidationError[] =>
    (annotations[CORE_ANNOTATIONS.REQUIRED] === true
      ? [new MissingRequiredFieldValidationError({ elemID, fieldName: elemID.name })] : [])

  // Checking _required annotation
  if (value === undefined) {
    return validateRequiredValue()
  }

  // Checking restrictions
  if ((isPrimitiveType(type)
    || (isContainerType(type) && isPrimitiveType(await type.getInnerType(elementsSource)))
  ) && shouldEnforceValue()) {
    // TODO: This currently only checks one level of nesting for primitive types inside lists.
    // We should add support for List of list of primitives
    return validateRestrictionsValue(value)
  }

  return undefined
}

type ItemWithNestedId<T> = {
  value: T
  nestedID: ElemID
}
const mapAsArrayWithIds = <T>(value: T | T[], elemID: ElemID): ItemWithNestedId<T>[] => {
  if (Array.isArray(value)) {
    return value.flatMap((val, i) => ({ value: val, nestedID: elemID.createNestedID(String(i)) }))
  }
  return [{ value, nestedID: elemID }]
}

/**
 * Validate that field values corresponding with core annotations (_required, _values, _restriction)
 * @param value- the field value
 * @param field
 */
const validateFieldAnnotations = async (
  elemID: ElemID, value: Value, field: Field, elementsSource: ReadOnlyElementsSource
): Promise<ValidationError[]> => {
  const errors = await validateAnnotationsValue(
    elemID, value,
    field.annotations,
    await field.getType(elementsSource),
    elementsSource
  )
  if (!_.isUndefined(errors)) {
    return errors
  }

  return awu(mapAsArrayWithIds(value, elemID)).flatMap(async item => {
    const fieldType = await field.getType(elementsSource)
    return validateAnnotations(
      item.nestedID,
      item.value,
      isListType(fieldType)
        ? await fieldType.getInnerType(elementsSource)
        : await field.getType(elementsSource),
      elementsSource
    )
  }).toArray()
}

export class InvalidValueTypeValidationError extends ValidationError {
  readonly value: Value
  readonly type: ElemID
  constructor({ elemID, value, type }: { elemID: ElemID; value: Value; type: ElemID }) {
    super({
      elemID,
      error: `Invalid value type for ${type.getFullName()}`,
      severity: 'Warning',
    })
    this.value = value
    this.type = type
  }
}

const createReferenceValidationErrors = (elemID: ElemID, value: Value): ValidationError[] => {
  if (value instanceof UnresolvedReference) {
    return [new UnresolvedReferenceValidationError({ elemID, target: value.target })]
  }
  if (value instanceof IllegalReference) {
    return [new IllegalReferenceValidationError({ elemID, reason: value.message })]
  }
  if (value instanceof CircularReference) {
    return [new CircularReferenceValidationError({ elemID, ref: value.ref })]
  }
  return []
}

const validateValue = async (
  elemID: ElemID,
  value: Value,
  type: TypeElement,
  elementsSource: ReadOnlyElementsSource
): Promise<ValidationError[]> => {
  if (Array.isArray(value) && !isListType(type)) {
    if (value.length === 0) {
      // return an error if value is required
      return (await validateAnnotationsValue(
        elemID,
        undefined,
        type.annotations,
        type,
        elementsSource
      )) ?? []
    }
    return validateValue(elemID, value, new ListType(type), elementsSource)
  }

  if (isReferenceExpression(value)) {
    return isElement(value.value) ? [] : validateValue(elemID, value.value, type, elementsSource)
  }

  const referenceValidationErrors = createReferenceValidationErrors(elemID, value)
  if (!_.isEmpty(referenceValidationErrors)) {
    return referenceValidationErrors
  }

  if (value instanceof InvalidStaticFile) {
    return [new InvalidStaticFileError({ elemID, value })]
  }

  if (value instanceof StaticFile) {
    return []
  }

  if (isPrimitiveType(type)) {
    if (!primitiveValidators[type.primitive](value)) {
      return [new InvalidValueTypeValidationError({ elemID, value, type: type.elemID })]
    }
  }

  if (isVariable(value)) {
    return [new InvalidValueValidationError({
      elemID,
      value,
      fieldName: elemID.name,
      expectedValue: 'not a variable',
    })]
  }

  if (isObjectType(type) || isMapType(type)) {
    if (!_.isObjectLike(value)) {
      return [new InvalidValueTypeValidationError({ elemID, value, type: type.elemID })]
    }
    const objType = toObjectType(type, value)
    return (await Promise.all(Object.keys(value).filter(k => objType.fields[k] !== undefined).map(
      // eslint-disable-next-line no-use-before-define
      k => validateFieldValue(elemID.createNestedID(k), value[k], objType.fields[k], elementsSource)
    ))).flat()
  }

  if (isListType(type)) {
    return (await Promise.all(mapAsArrayWithIds(value, elemID).map(async item => validateValue(
      item.nestedID,
      item.value,
      await type.getInnerType(elementsSource),
      elementsSource
    )))).flat()
  }

  return (
    await validateAnnotationsValue(elemID, value, type.annotations, type, elementsSource)
  ) || []
}

const validateFieldValue = async (
  elemID: ElemID,
  value: Value,
  field: Field,
  elementsSource: ReadOnlyElementsSource
): Promise<ValidationError[]> => {
  const fieldType = await field.getType(elementsSource)
  if (!isListType(fieldType) && Array.isArray(value) && value.length === 0) {
    // return an error if value is required
    return (
      await validateAnnotationsValue(
        elemID,
        undefined,
        field.annotations,
        fieldType,
        elementsSource
      )
    ) ?? []
  }
  return awu(mapAsArrayWithIds(value, elemID)).flatMap(async item => validateValue(
    item.nestedID,
    item.value,
    isListType(fieldType) ? await fieldType.getInnerType(elementsSource) : fieldType,
    elementsSource
  )).toArray()
}

const validateField = async (
  field: Field,
  elementsSource: ReadOnlyElementsSource
): Promise<ValidationError[]> => {
  const annotationTypes = await elementAnnotationTypes(field, elementsSource)
  return awu(Object.keys(field.annotations))
    .filter(async k => annotationTypes[k] !== undefined)
    .flatMap(async k => validateValue(
      field.elemID.createNestedID(k),
      field.annotations[k],
      annotationTypes[k],
      elementsSource
    ))
    .toArray()
}

const validateType = async (
  element: TypeElement,
  elementsSource: ReadOnlyElementsSource
): Promise<ValidationError[]> => {
  const annotationTypes = await elementAnnotationTypes(element, elementsSource)
  const errors = await awu(Object.keys(element.annotations))
    .filter(k => annotationTypes[k] !== undefined).flatMap(
      async k => validateValue(
        element.elemID.createNestedID('attr', k),
        element.annotations[k],
        annotationTypes[k],
        elementsSource
      )
    ).toArray()
  if (isObjectType(element)) {
    const fieldErrors = await awu(Object.values(element.fields))
      .flatMap(elem => validateField(elem, elementsSource))
      .toArray()
    return [...errors, ...fieldErrors]
  }
  return errors
}

const instanceAnnotationsType = new ObjectType({
  elemID: new ElemID(GLOBAL_ADAPTER, 'instanceAnnotations'), // dummy elemID, it's not really used
  fields: Object.fromEntries(
    Object.entries(InstanceAnnotationTypes)
      .map(([name, type]) => [name, { refType: createRefToElmWithValue(type) }])
  ),
})

const validateInstanceElements = async (
  element: InstanceElement,
  elementsSource: ReadOnlyElementsSource
): Promise<ValidationError[]> =>
  [
    ...await validateValue(
      element.elemID,
      element.value,
      await element.getType(elementsSource),
      elementsSource
    ),
    ...await validateAnnotations(
      element.elemID,
      element.value,
      await element.getType(elementsSource),
      elementsSource,
    ),
    ...await validateValue(
      element.elemID,
      element.annotations,
      instanceAnnotationsType,
      elementsSource,
    ),
  ]

const validateVariableValue = (elemID: ElemID, value: Value): ValidationError[] => {
  if (isReferenceExpression(value)) {
    return validateVariableValue(elemID, value.value)
  }
  const referenceValidationErrors = createReferenceValidationErrors(elemID, value)
  if (!_.isEmpty(referenceValidationErrors)) {
    return referenceValidationErrors
  }

  if (!isPrimitiveValue(value)) {
    return [new InvalidValueValidationError({
      elemID,
      value,
      fieldName: elemID.name,
      expectedValue: 'a primitive or a reference to a primitive',
    })]
  }
  return []
}

const validateVariable = (element: Variable): ValidationError[] => validateVariableValue(
  element.elemID, element.value
)

export const validateElements = async (
  elements: Element[], elementsSource: ReadOnlyElementsSource,
): Promise<ValidationError[]> => (await Promise.all((await resolve(elements, elementsSource))
  .flatMap(async e => {
    if (isInstanceElement(e)) {
      return validateInstanceElements(e, elementsSource)
    }
    if (isVariable(e)) {
      return validateVariable(e)
    }
    return validateType(e as TypeElement, elementsSource)
  }))).flat()
