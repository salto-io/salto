import _ from 'lodash'
import {
  Element, isObjectType, isInstanceElement, Type, InstanceElement, Field, PrimitiveTypes,
  isPrimitiveType,
} from 'adapter-api'

const primitiveValidators = {
  [PrimitiveTypes.STRING]: _.isString,
  [PrimitiveTypes.NUMBER]: _.isNumber,
  [PrimitiveTypes.BOOLEAN]: _.isBoolean,
  [PrimitiveTypes.OBJECT]: _.isPlainObject,
  [PrimitiveTypes.LIST]: _.isArray,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateValueType = (value: any, scheme: Type): void => {
  if ((isPrimitiveType(scheme) && !primitiveValidators[scheme.primitive](value))
     || (isObjectType(scheme) && !_.isPlainObject(value))) {
    throw new Error(`Invalid value type for ${scheme.elemID.getFullName()} : ${value}`)
  }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateValue = (value: any, scheme: Type): void => {
  validateValueType(value, scheme)
  if (isObjectType(scheme)) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    _.forEach(value, (v, k) => scheme.fields[k] && validateFieldValue(v, scheme.fields[k]))
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validateFieldValue = (value: any, field: Field): void => {
  if (field.isList) {
    if (!_.isArray(value)) {
      throw new Error(`Invalid value type for ${field.elemID.getFullName()}: expected list`)
    }
    value.forEach(v => validateValue(v, field.type))
  } else {
    validateValue(value, field.type)
  }
}

const validateField = (field: Field): void => {
  _.forEach(
    field.annotationsValues,
    (v, k) => field.type.annotations[k] && validateValue(v, field.type.annotations[k])
  )
}

const validateType = (element: Type): void => {
  _.forEach(
    element.annotationsValues,
    (v, k) => element.annotations[k] && validateValue(v, element.annotations[k])
  )
  if (isObjectType(element)) {
    Object.values(element.fields).forEach(validateField)
  }
}

const validateInstanceElement = (element: InstanceElement): void => {
  validateValue(element.value, element.type)
}

const validateElements = (elements: Element[]): string[] => {
  const errors: string[] = []

  elements.forEach(element => {
    try {
      if (isInstanceElement(element)) {
        validateInstanceElement(element)
      } else {
        validateType(element as Type)
      }
    } catch (err) {
      errors.push(err.message)
    }
  })

  return errors
}

export default validateElements
