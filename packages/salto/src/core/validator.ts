import _ from 'lodash'
import {
  Element, isObjectType, isInstanceElement, Type, InstanceElement, Field, PrimitiveTypes,
  isPrimitiveType, Value,
} from 'adapter-api'

export class ValidationError extends Error {
  constructor(msg: string) {
    super(msg)
  }
}

const primitiveValidators = {
  [PrimitiveTypes.STRING]: _.isString,
  [PrimitiveTypes.NUMBER]: _.isNumber,
  [PrimitiveTypes.BOOLEAN]: _.isBoolean,
}

const validateRequired = (value: Value, type: Type): ValidationError[] => {
  if (isObjectType(type)) {
    return _.flatten(Object.keys(type.fields).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => validateRequiredValue(value[k], type.fields[k])
    ).filter(e => !_.isUndefined(e)))
  }

  return []
}

const validateRequiredValue = (value: Value, field: Field): ValidationError[] => {
  if (value === undefined) {
    return field.getAnnotationsValues()[Type.REQUIRED] === true
      ? [new ValidationError(`Field ${field.name} is required but has no value`)] : []
  }

  if (field.isList) {
    return _.isArray(value)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? _.flatten(value.map((v: any) => validateRequired(v, field.type))) : []
  }

  return validateRequired(value, field.type)
}

const validateValue = (value: Value, type: Type): ValidationError[] => {
  if ((isPrimitiveType(type) && !primitiveValidators[type.primitive](value))
    || (isObjectType(type) && !_.isPlainObject(value))) {
    return [new ValidationError(
      `Invalid value type for ${type.elemID.getFullName()} : ${JSON.stringify(value)}`
    )]
  }

  if (isObjectType(type)) {
    return _.flatten(Object.keys(value).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => type.fields[k] && validateFieldValue(value[k], type.fields[k])
    ).filter(e => !_.isUndefined(e)))
  }

  return []
}

const validateFieldValue = (value: Value, field: Field): ValidationError[] => {
  if (field.isList) {
    if (!_.isArray(value)) {
      return [new ValidationError(
        `Invalid value type for ${field.elemID.getFullName()}: expected list and got 
      ${JSON.stringify(value)} for field ${field.name}`
      )]
    }
    return _.flatten(value.map(v => validateValue(v, field.type)))
  }
  return validateValue(value, field.type)
}

const validateField = (field: Field): ValidationError[] =>
  _.flatten(Object.keys(field.getAnnotationsValues()).map(k => field.type.annotations[k]
    && validateValue(field.getAnnotationsValues()[k], field.type.annotations[k]))
    .filter(e => !_.isUndefined(e)))

const validateType = (element: Type): ValidationError[] => {
  const errors = _.flatten(Object.keys(element.getAnnotationsValues()).map(
    k => element.annotations[k]
      && validateValue(element.getAnnotationsValues()[k], element.annotations[k])
  ).filter(e => !_.isUndefined(e)))

  if (isObjectType(element)) {
    return [...errors, ..._.flatten(Object.values(element.fields).map(validateField))]
  }
  return errors
}

const validateInstanceElement = (element: InstanceElement): ValidationError[] =>
  [...validateValue(element.value, element.type),
    ...validateRequired(element.value, element.type)]

const validateElements = (elements: Element[]): ValidationError[] =>
  _.flatten(elements.map(element => {
    if (isInstanceElement(element)) {
      return validateInstanceElement(element)
    }
    return validateType(element as Type)
  }))

export default validateElements
