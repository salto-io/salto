import _ from 'lodash'
import { types } from '@salto/lowerdash'
import {
  Element, isObjectType, isInstanceElement, Type, InstanceElement, Field, PrimitiveTypes,
  isPrimitiveType, Value, ElemID, ANNOTATION_TYPES,
} from 'adapter-api'
import { makeArray } from '@salto/lowerdash/dist/src/collections/array'
import { UnresolvedReference, resolve, CircularReference } from './expressions'

export abstract class ValidationError extends types.Bean<Readonly<{
  elemID: ElemID
  error: string
}>> {
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
}

/**
 * Validate that all type fields values corresponding with core annotations (required, values)
 * @param value
 * @param type
 */
const validateAnnotations = (elemID: ElemID, value: Value, type: Type): ValidationError[] => {
  if (isObjectType(type)) {
    return _.flatten(Object.keys(type.fields).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => validateAnnotationsValues(elemID.createNestedID(k), value[k], type.fields[k])
    ))
  }

  return []
}

export class InvalidValueValidationError extends ValidationError {
  readonly value: Value
  readonly field: Field
  readonly expectedValue: unknown

  static formatExpectedValue(expectedValue: unknown): string {
    return _.isArray(expectedValue)
      ? `one of: ${(expectedValue as []).map(v => `"${v}"`).join(', ')}`
      : `"${expectedValue}"`
  }

  constructor(
    { elemID, value, field, expectedValue }:
      { elemID: ElemID; value: Value; field: Field; expectedValue: unknown }
  ) {
    super({
      elemID,
      error: `Value "${value}" is not valid for field ${field.name}`
        + ` expected ${InvalidValueValidationError.formatExpectedValue(expectedValue)}`,
    })
    this.value = value
    this.field = field
    this.expectedValue = expectedValue
  }
}

export class MissingRequiredFieldValidationError extends ValidationError {
  readonly field: Field

  constructor({ elemID, field }: { elemID: ElemID; field: Field }) {
    super({
      elemID,
      error: `Field ${field.name} is required but has no value`,
    })
    this.field = field
  }
}

export class UnresolvedReferenceValidationError extends ValidationError {
  constructor(
    { elemID, ref }:
    { elemID: ElemID; ref: string }
  ) {
    super({ elemID, error: `unresolved reference ${ref}` })
  }
}


export class CircularReferenceValidationError extends ValidationError {
  constructor(
    { elemID, ref }:
    { elemID: ElemID; ref: string }
  ) {
    super({ elemID, error: `circular reference ${ref}` })
  }
}

/**
 * Validate that field values corresponding with core annotations (_required, _values, _restriction)
 * @param value- the field value
 * @param field
 */
const validateAnnotationsValues = (
  elemID: ElemID, value: Value, field: Field,
): ValidationError[] => {
  const validateRestrictionsValue = (val: Value):
    ValidationError[] => {
    const restrictionValues = makeArray(field.annotations[ANNOTATION_TYPES.VALUES])

    // When value is array we iterate (validate) each element
    if (_.isArray(val)) {
      return _.flatten(val.map(v => validateRestrictionsValue(v)))
    }

    // The 'real' validation: is value is one of restrictionValues
    if (!restrictionValues.some(i => _.isEqual(i, val))) {
      return [
        new InvalidValueValidationError({ elemID, value, field, expectedValue: restrictionValues }),
      ]
    }

    return []
  }

  const validateRequiredValue = (): ValidationError[] =>
    (field.annotations[ANNOTATION_TYPES.REQUIRED] === true
      ? [new MissingRequiredFieldValidationError({ elemID, field })] : [])

  // Checking _required annotation
  if (value === undefined) {
    return validateRequiredValue()
  }

  const shouldEnforceValue = (): boolean => {
    const restriction = field.annotations[ANNOTATION_TYPES.RESTRICTION]
    // enforce_value is true by default
    return (restriction && restriction[ANNOTATION_TYPES.ENFORCE_VALUE] === true)
      || (field.annotations[ANNOTATION_TYPES.VALUES]
        && !(restriction && restriction[ANNOTATION_TYPES.ENFORCE_VALUE] === false))
  }

  // Checking _values annotation
  if (isPrimitiveType(field.type) && shouldEnforceValue()) {
    return validateRestrictionsValue(value)
  }

  // Apply validateAnnotations for each element in our values list
  if (field.isList) {
    return _.isArray(value)
      ? _.flatten(value.map((v, i) => validateAnnotations(
        elemID.createNestedID(String(i)),
        v,
        field.type
      )))
      : []
  }

  return validateAnnotations(elemID, value, field.type)
}

export class InvalidValueTypeValidationError extends ValidationError {
  readonly value: Value
  readonly type: Type

  constructor({ elemID, value, type }: { elemID: ElemID; value: Value; type: Type }) {
    super({
      elemID,
      error: `Invalid value type for ${type.elemID.getFullName()} : ${JSON.stringify(value)}`,
    })
    this.value = value
    this.type = type
  }
}

const validateValue = (elemID: ElemID, value: Value, type: Type): ValidationError[] => {
  if (value instanceof UnresolvedReference) {
    return [new UnresolvedReferenceValidationError({ elemID, ref: value.ref })]
  }
  if (value instanceof CircularReference) {
    return [new CircularReferenceValidationError({ elemID, ref: value.ref })]
  }
  if ((isPrimitiveType(type) && !primitiveValidators[type.primitive](value))
    || (isObjectType(type) && !_.isPlainObject(value))) {
    return [new InvalidValueTypeValidationError({ elemID, value, type })]
  }

  if (isObjectType(type)) {
    return _.flatten(Object.keys(value).filter(k => type.fields[k]).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => validateFieldValue(elemID.createNestedID(k), value[k], type.fields[k])
    ))
  }

  return []
}

const validateFieldValue = (elemID: ElemID, value: Value, field: Field): ValidationError[] => {
  if (field.isList) {
    if (!_.isArray(value)) {
      return [new InvalidValueValidationError({ elemID, value, field, expectedValue: 'a list' })]
    }
    return _.flatten(
      value.map((v, i) => validateValue(elemID.createNestedID(String(i)), v, field.type))
    )
  }
  return validateValue(elemID, value, field.type)
}

const validateField = (field: Field): ValidationError[] =>
  _.flatten(Object.keys(field.annotations)
    .filter(k => field.type.annotationTypes[k])
    .map(k => validateValue(
      field.elemID.createNestedID(k),
      field.annotations[k],
      field.type.annotationTypes[k]
    )))

const validateType = (element: Type): ValidationError[] => {
  const errors = _.flatten(Object.keys(element.annotations)
    .filter(k => element.annotationTypes[k]).map(
      k => validateValue(
        element.elemID.createNestedID('attr', k),
        element.annotations[k],
        element.annotationTypes[k]
      )
    ))

  if (isObjectType(element)) {
    return [...errors, ..._.flatten(Object.values(element.fields).map(validateField))]
  }
  return errors
}

const instanceElementValidators = [
  validateValue,
  validateAnnotations,
]

const validateInstanceElements = (element: InstanceElement): ValidationError[] =>
  _.flatten(instanceElementValidators.map(v => v(element.elemID, element.value, element.type)))

export const validateElements = (elements: Element[]): ValidationError[] => (
  _(resolve(elements))
    .map(e => (isInstanceElement(e) ? validateInstanceElements(e) : validateType(e as Type)))
    .flatten()
    .value()
)
