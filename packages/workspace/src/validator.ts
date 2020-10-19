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
import { types, collections, values } from '@salto-io/lowerdash'
import {
  Element, isObjectType, isInstanceElement, TypeElement, InstanceElement, Field, PrimitiveTypes,
  isPrimitiveType, Value, ElemID, CORE_ANNOTATIONS, SaltoElementError, SaltoErrorSeverity,
  Values, isElement, isListType, getRestriction, isVariable, Variable, isPrimitiveValue, ListType,
  isReferenceExpression, StaticFile, isContainerType, isMapType,
} from '@salto-io/adapter-api'
import { toObjectType } from '@salto-io/adapter-utils'
import { InvalidStaticFile } from './workspace/static_files/common'
import { UnresolvedReference, resolve, CircularReference } from './expressions'
import { IllegalReference } from './parser/parse'

const { makeArray } = collections.array

export abstract class ValidationError extends types.Bean<Readonly<{
  elemID: ElemID
  error: string
  severity: SaltoErrorSeverity
}>> implements SaltoElementError {
  get message(): string {
    return `Error validating "${this.elemID.getFullName()}": ${this.error}`
  }

  toString(): string {
    return this.message
  }
}

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
const validateAnnotations = (elemID: ElemID, value: Value, type: TypeElement):
ValidationError[] => {
  if (isObjectType(type)) {
    return Object.keys(type.fields).flatMap(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => validateFieldAnnotations(elemID.createNestedID(k), value[k], type.fields[k])
    )
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

export class IllegalReferenceValidationError extends ValidationError {
  constructor(
    { elemID, message }:
    { elemID: ElemID; message: string }
  ) {
    super({ elemID, error: `illegal reference target, ${message}`, severity: 'Warning' })
  }
}

export class CircularReferenceValidationError extends ValidationError {
  constructor(
    { elemID, ref }:
    { elemID: ElemID; ref: string }
  ) {
    super({ elemID, error: `circular reference ${ref}`, severity: 'Warning' })
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

const validateAnnotationsValue = (
  elemID: ElemID, value: Value, annotations: Values, type: TypeElement
): ValidationError[] | undefined => {
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

    const restrictionValidations = [
      validateValueInsideRange,
      validateValueInList,
      validateRegexMatches,
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
    || (isContainerType(type) && isPrimitiveType(type.innerType))
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
const validateFieldAnnotations = (
  elemID: ElemID, value: Value, field: Field,
): ValidationError[] => {
  const errors = validateAnnotationsValue(elemID, value, field.annotations, field.type)
  if (!_.isUndefined(errors)) {
    return errors
  }

  return mapAsArrayWithIds(value, elemID).flatMap(item => validateAnnotations(
    item.nestedID,
    item.value,
    isListType(field.type) ? field.type.innerType : field.type,
  ))
}

export class InvalidValueTypeValidationError extends ValidationError {
  readonly value: Value
  readonly type: TypeElement

  constructor({ elemID, value, type }: { elemID: ElemID; value: Value; type: TypeElement }) {
    super({
      elemID,
      error: `Invalid value type for ${type.elemID.getFullName()}`,
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
    return [new IllegalReferenceValidationError({ elemID, message: value.message })]
  }
  if (value instanceof CircularReference) {
    return [new CircularReferenceValidationError({ elemID, ref: value.ref })]
  }
  return []
}

const validateValue = (elemID: ElemID, value: Value, type: TypeElement): ValidationError[] => {
  if (Array.isArray(value) && !isListType(type)) {
    if (value.length === 0) {
      // return an error if value is required
      return validateAnnotationsValue(elemID, undefined, type.annotations, type) ?? []
    }
    return validateValue(elemID, value, new ListType(type))
  }

  if (isReferenceExpression(value)) {
    return isElement(value.value) ? [] : validateValue(elemID, value.value, type)
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
      return [new InvalidValueTypeValidationError({ elemID, value, type })]
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
      return [new InvalidValueTypeValidationError({ elemID, value, type })]
    }
    const objType = toObjectType(type, value)
    return Object.keys(value).filter(k => objType.fields[k]).flatMap(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => validateFieldValue(elemID.createNestedID(k), value[k], objType.fields[k])
    )
  }

  if (isListType(type)) {
    return mapAsArrayWithIds(value, elemID).flatMap(item => validateValue(
      item.nestedID,
      item.value,
      type.innerType,
    ))
  }

  return validateAnnotationsValue(elemID, value, type.annotations, type) || []
}

const validateFieldValue = (elemID: ElemID, value: Value, field: Field): ValidationError[] => {
  if (!isListType(field.type) && Array.isArray(value) && value.length === 0) {
    // return an error if value is required
    return validateAnnotationsValue(elemID, undefined, field.annotations, field.type) ?? []
  }
  return mapAsArrayWithIds(value, elemID).flatMap(item => validateValue(
    item.nestedID,
    item.value,
    isListType(field.type) ? field.type.innerType : field.type,
  ))
}

const validateField = (field: Field): ValidationError[] =>
  Object.keys(field.annotations)
    .filter(k => field.type.annotationTypes[k])
    .flatMap(k => validateValue(
      field.elemID.createNestedID(k),
      field.annotations[k],
      field.type.annotationTypes[k],
    ))

const validateType = (element: TypeElement): ValidationError[] => {
  const errors = Object.keys(element.annotations)
    .filter(k => element.annotationTypes[k]).flatMap(
      k => validateValue(
        element.elemID.createNestedID('attr', k),
        element.annotations[k],
        element.annotationTypes[k],
      )
    )

  if (isObjectType(element)) {
    return [...errors, ...Object.values(element.fields).flatMap(validateField)]
  }
  return errors
}

const instanceElementValidators = [
  validateValue,
  validateAnnotations,
]

const validateInstanceElements = (element: InstanceElement): ValidationError[] =>
  instanceElementValidators.flatMap(v => v(element.elemID, element.value, element.type))

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

export const validateElements = (elements: ReadonlyArray<Element>): ValidationError[] => (
  _(resolve(elements))
    .map(e => {
      if (isInstanceElement(e)) {
        return validateInstanceElements(e)
      }
      if (isVariable(e)) {
        return validateVariable(e)
      }
      return validateType(e as TypeElement)
    })
    .flatten()
    .value()
)
