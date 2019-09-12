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

/**
 * Validate that all type fields values corresponding with core annotations (required, restriction)
 * @param value
 * @param type
 */
const validateAnnotations = (value: Value, type: Type): ValidationError[] => {
  if (isObjectType(type)) {
    return _.flatten(Object.keys(type.fields).map(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      k => validateAnnotationsValues(value[k], type.fields[k])
    ))
  }

  return []
}

/**
 * Validate that field values corresponding with core annotations (_required, _restriction)
 * @param value- the field value
 * @param field
 */
const validateAnnotationsValues = (value: Value, field: Field): ValidationError[] => {
  const validateRestrictionsValue = (val: Value):
    ValidationError[] => {
    const restrictionValues = field.annotations[Type.RESTRICTION]

    // Restrictions is empty
    if (restrictionValues === undefined) {
      return []
    }

    // Values should be array
    const possibleValues = restrictionValues.values
    if (!_.isArray(possibleValues)) {
      return []
    }

    // When value is array we iterate (validate) each element
    if (_.isArray(val)) {
      return _.flatten(val.map(v => validateRestrictionsValue(v)))
    }

    // The 'real' validation: is value is one of possibleValues
    if (!possibleValues.some(i => _.isEqual(i, val))) {
      return [new ValidationError(
        `Value ${val} doesn't valid for field ${field.elemID.getFullName()},
            can accept only ${possibleValues}`
      )]
    }

    return []
  }

  const validateRequiredValue = (): ValidationError[] =>
    (field.annotations[Type.REQUIRED] === true
      ? [new ValidationError(`Field ${field.name} is required but has no value`)] : [])

  // Checking _required annotation
  if (value === undefined) {
    return validateRequiredValue()
  }

  // Checking _restriction annotation
  if (isPrimitiveType(field.type)) {
    return validateRestrictionsValue(value)
  }

  // Apply validateAnnotations for each element in our values list
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
  _.flatten(Object.keys(field.annotations)
    .filter(k => field.type.annotationTypes[k])
    .map(k => validateValue(field.annotations[k], field.type.annotationTypes[k])))

const validateType = (element: Type): ValidationError[] => {
  const errors = _.flatten(Object.keys(element.annotations)
    .filter(k => element.annotationTypes[k]).map(
      k => validateValue(element.annotations[k], element.annotationTypes[k])
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
