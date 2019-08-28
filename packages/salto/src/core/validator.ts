
import _ from 'lodash'
import {
  Element, isObjectType, isInstanceElement, Type, InstanceElement, Field, PrimitiveTypes,
  isPrimitiveType, Value,
} from 'adapter-api'

const primitiveValidators = {
  [PrimitiveTypes.STRING]: _.isString,
  [PrimitiveTypes.NUMBER]: _.isNumber,
  [PrimitiveTypes.BOOLEAN]: _.isBoolean,
}

const validateRequired = (value: Value, type: Type): string[] => {
  if (isObjectType(type)) {
    return Object.keys(type.fields).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => validateRequiredValue(value[k], type.fields[k])
    ).filter(e => e).reduce((acc, e) => [...acc, ...e], [])
  }

  return []
}

const validateRequiredValue = (value: Value, field: Field): string[] => {
  if (value === undefined) {
    return field.getAnnotationsValues()[Type.REQUIRED] === true
      ? [`Field ${field.name} is required but has no value`] : []
  }

  if (field.isList) {
    return _.isArray(value)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? value.map((v: any) => validateRequired(v, field.type)).reduce((acc: any, e: any) =>
        [...acc, ...e], []) : []
  }

  return validateRequired(value, field.type)
}

const validateValue = (value: Value, type: Type): string[] => {
  if ((isPrimitiveType(type) && !primitiveValidators[type.primitive](value))
    || (isObjectType(type) && !_.isPlainObject(value))) {
    return [`Invalid value type for ${type.elemID.getFullName()} : ${JSON.stringify(value)}`]
  }
  if (isObjectType(type)) {
    return Object.keys(value).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => type.fields[k] && validateFieldValue(value[k], type.fields[k])
    ).filter(e => e).reduce((acc, e) => [...acc, ...e], [])
  }
  return []
}

const validateFieldValue = (value: Value, field: Field): string[] => {
  if (field.isList) {
    if (!_.isArray(value)) {
      return [`Invalid value type for ${field.elemID.getFullName()}: expected list and got ${
        JSON.stringify(value)} for field ${field.name}`]
    }
    return value.map(v => validateValue(v, field.type)).reduce((acc, e) => [...acc, ...e], [])
  }
  return validateValue(value, field.type)
}

const validateField = (field: Field): string[] => Object.keys(field.getAnnotationsValues()).map(
  k => field.type.annotations[k] && validateValue(
    field.getAnnotationsValues()[k],
    field.type.annotations[k]
  )
).filter(e => e).reduce((acc, e) => [...acc, ...e], [])

const validateType = (element: Type): string[] => {
  const errors = Object.keys(element.getAnnotationsValues()).map(
    k => element.annotations[k] && validateValue(
      element.getAnnotationsValues()[k],
      element.annotations[k]
    )
  ).filter(e => e).reduce((acc, e) => [...acc, ...e], [])
  if (isObjectType(element)) {
    return [
      ...errors,
      ...Object.values(element.fields).map(validateField).reduce((acc, e) => [...acc, ...e], []),
    ]
  }
  return errors
}

const validateInstanceElement = (
  element: InstanceElement
): string[] => [...validateValue(element.value, element.type),
  ...validateRequired(element.value, element.type)]

const validateElements = (elements: Element[]): string[] => elements.map(element => {
  if (isInstanceElement(element)) {
    return validateInstanceElement(element)
  }
  return validateType(element as Type)
}).reduce((acc, e) => [...acc, ...e], [])

export default validateElements
