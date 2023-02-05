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
import { logger } from '@salto-io/logging'
import { types, collections, values } from '@salto-io/lowerdash'
import {
  Element, isObjectType, isInstanceElement, TypeElement, InstanceElement, Field, PrimitiveTypes,
  isPrimitiveType, Value, ElemID, CORE_ANNOTATIONS, SaltoElementError, SeverityLevel,
  Values, isElement, isListType, getRestriction, isVariable, Variable, isPrimitiveValue, ListType,
  isReferenceExpression, StaticFile, isContainerType, isMapType, ObjectType,
  InstanceAnnotationTypes, GLOBAL_ADAPTER, SaltoError, ReadOnlyElementsSource, BuiltinTypes,
  isPlaceholderObjectType,
  CoreAnnotationTypes,
  isType,
  isField,
  isTemplateExpression,
  UnresolvedReference,
} from '@salto-io/adapter-api'
import { toObjectType } from '@salto-io/adapter-utils'
import { InvalidStaticFile } from './workspace/static_files/common'
import { CircularReference, resolve } from './expressions'
import { IllegalReference } from './parser/parse'

const log = logger(module)
const { makeArray } = collections.array

export abstract class ValidationError extends types.Bean<{
  elemID: ElemID
  error: string
  severity: SeverityLevel
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
 */
const validateAnnotations = (
  elemID: ElemID,
  value: Value,
  type: TypeElement,
): ValidationError[] => {
  if ((isObjectType(type) || isMapType(type)) && !isReferenceExpression(value)) {
    const objType = toObjectType(type, value)
    return Object.entries(objType.fields).flatMap(
      // eslint-disable-next-line no-use-before-define
      ([key, field]) => validateFieldAnnotations(
        elemID.createNestedID(key),
        value[key],
        field,
      )
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
      ? `one of: ${(expectedValue).map(v => `"${v}"`).join(', ')}`
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

export class InvalidTypeValidationError extends ValidationError {
  constructor(readonly elemID: ElemID) {
    super({
      elemID,
      error: `type ${elemID.typeName} of instance ${elemID.name} does not exist`,
      severity: 'Warning',
    })
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

export class InvalidValueMaxLengthValidationError extends ValidationError {
  readonly value: string
  readonly fieldName: string
  readonly maxLength: number

  constructor({ elemID, value, fieldName, maxLength }:
    { elemID: ElemID; value: string; fieldName: string; maxLength: number }) {
    super({
      elemID,
      error: `Value "${value}" is too long for field.`
        + ` ${fieldName} maximum length is ${maxLength}`,
      severity: 'Warning',
    })
    this.value = value
    this.fieldName = fieldName
    this.maxLength = maxLength
  }
}

export class InvalidValueMaxListLengthValidationError extends ValidationError {
  readonly size: number
  readonly fieldName: string
  readonly maxListLength: number

  constructor({ elemID, size, fieldName, maxListLength }:
                { elemID: ElemID; size: number; fieldName: string; maxListLength: number }) {
    super({
      elemID,
      error: `List of size ${size} is too large for field.`
        + ` ${fieldName} maximum length is ${maxListLength}`,
      severity: 'Warning',
    })
    this.size = size
    this.fieldName = fieldName
    this.maxListLength = maxListLength
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

export class AdditionalPropertiesValidationError extends ValidationError {
  readonly fieldName: string
  readonly typeName: string

  constructor(
    { elemID, fieldName, typeName }: { elemID: ElemID; fieldName: string; typeName: string }
  ) {
    super({
      elemID,
      error: `Field '${fieldName}' is not defined in the '${typeName}'`
      + ' type which does not allow additional properties.',
      severity: 'Warning',
    })
    this.fieldName = fieldName
    this.typeName = typeName
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
  constructor({ elemID, error }: { elemID: ElemID; error: string }) {
    super({
      elemID,
      error,
      severity: 'Error',
    })
  }
}

const validateAnnotationsValue = (
  elemID: ElemID,
  value: Value,
  annotations: Values,
  type: TypeElement,
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

    const validateMaxLengthLimit = (): ValidationError[] => {
      const maxLength = restrictions.max_length
      if ((values.isDefined(maxLength) && _.isString(val) && val.length > maxLength)) {
        return [new InvalidValueMaxLengthValidationError(
          { elemID, value, fieldName: elemID.name, maxLength }
        )]
      }
      return []
    }

    const restrictionValidations = [
      validateValueInsideRange,
      validateValueInList,
      validateRegexMatches,
      validateMaxLengthLimit,
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

  if (isListType(type) && shouldEnforceValue() && _.isArray(value)) {
    const maxListLength = restrictions.max_list_length
    if ((values.isDefined(maxListLength) && value.length > maxListLength)) {
      return [new InvalidValueMaxListLengthValidationError(
        { elemID, size: value.length, fieldName: elemID.name, maxListLength }
      )]
    }
  }

  // Checking restrictions
  if ((isPrimitiveType(type)
    || (isContainerType(type) && isPrimitiveType(type.refInnerType.type))
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
 */
const validateFieldAnnotations = (
  elemID: ElemID, value: Value, field: Field
): ValidationError[] => {
  const fieldType = field.refType.type
  const fieldInnerType = isListType(fieldType)
    ? fieldType.refInnerType.type
    : fieldType

  if (!isType(fieldType) || !isType(fieldInnerType)) {
    // Should never happen because we resolve the element before calling this
    log.error(
      'Found unresolved type at %s, fieldType=%s fieldInnerType=%o',
      elemID.getFullName(), fieldType?.elemID.getFullName(), fieldInnerType,
    )
    return []
  }
  const errors = validateAnnotationsValue(
    elemID, value,
    field.annotations,
    fieldType,
  )
  if (!_.isUndefined(errors)) {
    return errors
  }

  return mapAsArrayWithIds(value, elemID)
    .flatMap(item => validateAnnotations(
      item.nestedID,
      item.value,
      fieldInnerType,
    ))
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

const validateValue = (
  elemID: ElemID,
  value: Value,
  type: TypeElement,
): ValidationError[] => {
  if (Array.isArray(value) && !isListType(type)) {
    if (value.length === 0) {
      // return an error if value is required
      return validateAnnotationsValue(
        elemID,
        undefined,
        type.annotations,
        type,
      ) ?? []
    }
    return validateValue(elemID, value, new ListType(type))
  }

  if (isReferenceExpression(value)) {
    return isElement(value.value) ? [] : validateValue(elemID, value.value, type)
  }

  if (isTemplateExpression(value)) {
    const templatedReferenceValidationErrors = value.parts.map(part => (
      isReferenceExpression(part) ? createReferenceValidationErrors(part.elemID, part.value) : []
    )).flat()
    return [
      ...templatedReferenceValidationErrors,
      ...(validateValue(elemID, value.value, type)),
    ]
  }

  const referenceValidationErrors = createReferenceValidationErrors(elemID, value)
  if (!_.isEmpty(referenceValidationErrors)) {
    return referenceValidationErrors
  }

  if (value instanceof InvalidStaticFile) {
    return [new InvalidStaticFileError({ elemID, error: value.message })]
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
    const objectType = toObjectType(type, value)
    return Object.keys(value).flatMap(
      // eslint-disable-next-line no-use-before-define
      k => validateFieldValueAndName({
        parentElemID: elemID,
        value: value[k],
        fieldName: k,
        objType: objectType,
      })
    )
  }

  if (type === BuiltinTypes.UNKNOWN) {
    if (!_.isObjectLike(value)) {
      return []
    }
    return Object.keys(value).flatMap(
      // eslint-disable-next-line no-use-before-define
      k => validateFieldValue(
        elemID.createNestedID(k),
        value[k],
        BuiltinTypes.UNKNOWN,
        {},
      )
    )
  }

  if (isListType(type)) {
    const innerType = type.refInnerType.type
    if (!isType(innerType)) {
      // Should never happen because we resolve the element before calling this
      log.error(
        'Found unresolved type at %s, type=%s innerType=%o',
        elemID.getFullName(), type.elemID.getFullName(), innerType,
      )
      return []
    }
    return mapAsArrayWithIds(value, elemID).flatMap(item => validateValue(
      item.nestedID,
      item.value,
      innerType,
    ))
  }

  return validateAnnotationsValue(elemID, value, type.annotations, type) ?? []
}

const validateFieldValue = (
  elemID: ElemID,
  value: Value,
  fieldType: TypeElement,
  annotations: Values,
): ValidationError[] => {
  if (!isListType(fieldType) && Array.isArray(value) && value.length === 0) {
    // return an error if value is required
    return validateAnnotationsValue(
      elemID,
      undefined,
      annotations,
      fieldType,
    ) ?? []
  }
  const innerType = isListType(fieldType) ? fieldType.refInnerType.type : fieldType
  if (!isType(innerType)) {
    // Should never happen because we resolve the element before calling this
    log.error(
      'Found unresolved type at %s, fieldType=%s innerType=%o',
      elemID.getFullName(), fieldType.elemID.getFullName(), innerType,
    )
    return []
  }
  return mapAsArrayWithIds(value, elemID).flatMap(item => validateValue(
    item.nestedID,
    item.value,
    innerType,
  ))
}

const validateNotAdditionalProperty = (
  elemID: ElemID,
  fieldName: string,
  objType : ObjectType,
) : ValidationError[] =>
  (!Object.prototype.hasOwnProperty.call(objType.fields, fieldName)
    ? [new AdditionalPropertiesValidationError(
      { elemID, fieldName, typeName: objType.elemID.typeName }
    )]
    : [])

const validateFieldValueAndName = ({ parentElemID, value, fieldName, objType } : {
  parentElemID: ElemID
  value: Value
  fieldName: string
  objType: ObjectType
 }): ValidationError[] => {
  const errors = objType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] === false
    ? validateNotAdditionalProperty(parentElemID, fieldName, objType)
    : []
  return errors.concat(validateFieldValue(
    parentElemID.createNestedID(fieldName),
    value,
    objType.fields[fieldName]?.refType.type ?? BuiltinTypes.UNKNOWN,
    objType.fields[fieldName]?.annotations ?? {},
  ))
}

const syncGetElementAnnotationTypes = (
  element: TypeElement | Field
): Record<string, TypeElement> => {
  // We assume all elements are resolved, so if we access a field's refType, it will be there
  const type = isField(element) ? element.refType.type : element
  return {
    ...CoreAnnotationTypes,
    ...InstanceAnnotationTypes,
    ..._.pickBy(
      _.mapValues(type?.annotationRefTypes, ref => ref.type),
      // We assume all elements are resolved, and therefore we know the types are defined and this
      // filter won't actually omit anything
      values.isDefined,
    ),
  }
}

const validateField = (field: Field): ValidationError[] => {
  const annotationTypes = syncGetElementAnnotationTypes(field)
  return Object.keys(field.annotations)
    .filter(k => annotationTypes[k] !== undefined)
    .flatMap(k => validateValue(
      field.elemID.createNestedID(k),
      field.annotations[k],
      annotationTypes[k],
    ))
}

const validateType = (element: TypeElement): ValidationError[] => {
  const annotationTypes = syncGetElementAnnotationTypes(element)
  const errors = Object.keys(element.annotations)
    .filter(k => annotationTypes[k] !== undefined).flatMap(
      k => validateValue(
        element.elemID.createNestedID('attr', k),
        element.annotations[k],
        annotationTypes[k],
      )
    )
  if (isObjectType(element)) {
    const fieldErrors = Object.values(element.fields)
      .flatMap(elem => validateField(elem))
    return [...errors, ...fieldErrors]
  }
  return errors
}

const instanceAnnotationsType = new ObjectType({
  elemID: new ElemID(GLOBAL_ADAPTER, 'instanceAnnotations'), // dummy elemID, it's not really used
  fields: Object.fromEntries(
    Object.entries(InstanceAnnotationTypes)
      .map(([name, type]) => [name, { refType: type }])
  ),
})
const validateInstanceType = (elemID: ElemID, type: ObjectType): ValidationError[] => {
  if (isPlaceholderObjectType(type)) {
    return [new InvalidTypeValidationError(elemID)]
  }
  return []
}

const validateInstanceElements = (element: InstanceElement): ValidationError[] => {
  const instanceType = element.refType.type
  if (!isObjectType(instanceType)) {
    // Should never happen because we resolve the element before calling this
    log.error(
      'Found unresolved type at %s, instanceType=%o',
      element.elemID.getFullName(), instanceType,
    )
    return []
  }
  return [
    ...validateValue(
      element.elemID,
      element.value,
      instanceType,
    ),
    ...validateAnnotations(
      element.elemID,
      element.value,
      instanceType,
    ),
    ...validateValue(
      element.elemID,
      element.annotations,
      instanceAnnotationsType,
    ),
    ...validateInstanceType(
      element.elemID,
      instanceType,
    ),
  ]
}

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
): Promise<ValidationError[]> => log.time(
  async () => {
    const resolved = await resolve(elements, elementsSource)
    const errors = resolved
      .flatMap(
        e => {
          if (isInstanceElement(e)) {
            return validateInstanceElements(e)
          }
          if (isVariable(e)) {
            return validateVariable(e)
          }
          if (isType(e)) {
            return validateType(e)
          }
          return []
        }
      )

    return errors
  },
  'validateElements with %d elements', elements.length,
)
