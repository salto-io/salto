import _ from 'lodash'
import {
  Element, isObjectType, isInstanceElement, Type, InstanceElement, Field, PrimitiveTypes,
  isPrimitiveType,
} from 'adapter-api'

const primitiveValidators = {
  [PrimitiveTypes.STRING]: _.isString,
  [PrimitiveTypes.NUMBER]: _.isNumber,
  [PrimitiveTypes.BOOLEAN]: _.isBoolean,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateValue = (value: any, scheme: Type): string[] => {
  if ((isPrimitiveType(scheme) && !primitiveValidators[scheme.primitive](value))
     || (isObjectType(scheme) && !_.isPlainObject(value))) {
    return [`Invalid value type for ${scheme.elemID.getFullName()} : ${value}`]
  }
  if (isObjectType(scheme)) {
    return Object.keys(value).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => scheme.fields[k] && validateFieldValue(value[k], scheme.fields[k])
    ).filter(e => e).reduce((acc, e) => [...acc, ...e], [])
  }
  return []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateFieldValue = (value: any, field: Field): string[] => {
  if (field.isList) {
    if (!_.isArray(value)) {
      return [`Invalid value type for ${field.elemID.getFullName()}: expected list`]
    }
    return value.map(v => validateValue(v, field.type)).reduce((acc, e) => [...acc, ...e], [])
  }
  return validateValue(value, field.type)
}

const validateField = (field: Field): string[] => Object.keys(field.annotationsValues).map(
  k => field.type.annotations[k] && validateValue(
    field.annotationsValues[k],
    field.type.annotations[k]
  )
).filter(e => e).reduce((acc, e) => [...acc, ...e], [])

const validateType = (element: Type): string[] => {
  const errors = Object.keys(element.annotationsValues).map(
    k => element.annotations[k] && validateValue(
      element.annotationsValues[k],
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
): string[] => validateValue(element.value, element.type)

const validateElements = (elements: Element[]): string[] => elements.map(element => {
  if (isInstanceElement(element)) {
    return validateInstanceElement(element)
  }
  return validateType(element as Type)
}).reduce((acc, e) => [...acc, ...e], [])

export default validateElements
