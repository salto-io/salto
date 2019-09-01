import _ from 'lodash'
import {
  Element, isObjectType, isInstanceElement, Type, InstanceElement, Field, PrimitiveTypes, Values,
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

const validateAnnotations = (value: Value, type: Type): ValidationError[] => {
  if (isObjectType(type)) {
    return _.flatten(Object.keys(type.fields).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => validateAnnotationsValues(value[k], type.fields[k])
    ))
  }

  return []
}

const validateRestrictionsValue = (value: Value, restAnnotationsValues: Values, name: string):
  ValidationError[] => {
  if (restAnnotationsValues === undefined) {
    return []
  }

  const possibleValues = restAnnotationsValues.values
  if (!_.isArray(possibleValues)) {
    return []
  }
  if (_.isArray(value)) {
    return _.flatten(value.map(v => validateRestrictionsValue(v, restAnnotationsValues, name)))
  }

  if (!possibleValues.some(i => _.isEqual(i, value))) {
    return [new ValidationError(
      `Value ${value} doesn't valid for field ${name},
            can accept only ${possibleValues}`
    )]
  }

  return []
}

const validateAnnotationsValues = (value: Value, field: Field): ValidationError[] => {
  if (value === undefined) {
    return field.getAnnotationsValues()[Type.REQUIRED] === true
      ? [new ValidationError(`Field ${field.name} is required but has no value`)] : []
  }

  if (isPrimitiveType(field.type)) {
    return validateRestrictionsValue(value, field.getAnnotationsValues()[Type.RESTRICTION],
      field.elemID.getFullName())
  }

  if (field.isList) {
    return _.isArray(value)
      ? _.flatten(value.map(v => validateAnnotations(v, field.type))) : []
  }

  return validateAnnotations(value, field.type)
}

const validateValue = (value: Value, type: Type): ValidationError[] => {
  if ((isPrimitiveType(type) && !primitiveValidators[type.primitive](value))
    || (isObjectType(type) && !_.isPlainObject(value))) {
    return [new ValidationError(
      `Invalid value type for ${type.elemID.getFullName()} : ${JSON.stringify(value)}`
    )]
  }

  if (isObjectType(type)) {
    return _.flatten(Object.keys(value).filter(k => type.fields[k]).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => validateFieldValue(value[k], type.fields[k])
    ))
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
  _.flatten(Object.keys(field.getAnnotationsValues())
    .filter(k => field.type.annotations[k])
    .map(k => validateValue(field.getAnnotationsValues()[k], field.type.annotations[k])))

const validateType = (element: Type): ValidationError[] => {
  const errors = _.flatten(Object.keys(element.getAnnotationsValues())
    .filter(k => element.annotations[k]).map(
      k => validateValue(element.getAnnotationsValues()[k], element.annotations[k])
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
  _.flatten(instanceElementValidators.map(v => v(element.value, element.type)))

const validateElements = (elements: Element[]): ValidationError[] =>
  _.flatten(elements.map(element => {
    if (isInstanceElement(element)) {
      return validateInstanceElements(element)
    }
    return validateType(element as Type)
  }))

export default validateElements
