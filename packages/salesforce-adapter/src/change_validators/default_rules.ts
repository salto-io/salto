/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  getChangeData,
  ChangeValidator,
  isAdditionOrModificationChange,
  isInstanceChange,
  Field,
  InstanceElement,
  isFieldChange,
  isListType,
  TypeElement,
  isMapType,
  Value,
  Values,
  isReferenceExpression,
  getField,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FIELD_ANNOTATIONS, LABEL } from '../constants'
import { isFieldOfCustomObject } from '../transformers/transformer'

const { awu } = collections.asynciterable

const NO_ERRORS_FOUND: ChangeError[] = []

type FieldDef = {
  name: string
  nested?: boolean
}

const FIELD_NAME_TO_INNER_CONTEXT_FIELD: Record<string, FieldDef> = {
  applicationVisibilities: { name: 'application' },
  recordTypeVisibilities: { name: 'recordType', nested: true },

  // TODO(SALTO-4990): Remove once picklistsAsMaps FF is deployed and removed.
  standardValue: { name: 'label' },
  customValue: { name: 'label' },

  'standardValue.values': { name: 'label' },
  'customValue.values': { name: 'label' },
}

type ValueSetInnerObject = {
  default: boolean
  label: string
} & Values[]

type FieldWithValueSetList = Field & {
  annotations: {
    valueSet: Array<ValueSetInnerObject>
  }
}

// TODO(SALTO-4990): Remove once picklistsAsMaps FF is deployed and removed.
type FieldWithValueSetOrderedMap = Field & {
  annotations: {
    valueSet: {
      values: Array<ValueSetInnerObject>
    }
  }
}

type FieldWithValueSet = FieldWithValueSetList | FieldWithValueSetOrderedMap

const isFieldWithValueSetList = (field: Field): field is FieldWithValueSetList =>
  _.isArray(field.annotations[FIELD_ANNOTATIONS.VALUE_SET])

const isFieldWithOrderedMapValueSet = (field: Field): field is FieldWithValueSetOrderedMap =>
  _.isArray(field.annotations[FIELD_ANNOTATIONS.VALUE_SET]?.order)

const isFieldWithValueSet = (field: Field): field is FieldWithValueSet =>
  isFieldWithValueSetList(field) || isFieldWithOrderedMapValueSet(field)

const formatContext = (context: Value): string => {
  if (isReferenceExpression(context)) {
    return context.elemID.getFullName()
  }
  if (_.isString(context)) {
    return context
  }
  return safeJsonStringify(context)
}

const createInstanceChangeError = (field: Field, contexts: string[], instance: InstanceElement): ChangeError => {
  const instanceName = instance.elemID.name
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Instances cannot have more than one default',
    detailedMessage: `There cannot be more than one 'default' ${field.name} in instance: ${instanceName} type ${field.parent.elemID.name}.\nThe following ${FIELD_NAME_TO_INNER_CONTEXT_FIELD[field.name]?.name ?? LABEL}s are set to default: ${contexts}`,
  }
}

const createInstanceChangeErrorSingleDefaultNoVisible = (
  fieldPath: string,
  field: string,
  instance: InstanceElement,
): ChangeError => {
  const elementId = instance.elemID.createNestedID(fieldPath, field, 'visible')
  return {
    elemID: elementId,
    severity: 'Error',
    message: 'Default entry must be visible',
    detailedMessage: `An entry that is set as default must also be set as visible\nThus the following entry must be visible ${elementId.getFullName()}`,
  }
}

const createInstanceChangeErrorNoDefault = (
  fieldPath: string,
  field: string,
  instance: InstanceElement,
): ChangeError => {
  const elementId = instance.elemID.createNestedID(fieldPath, field)
  return {
    elemID: elementId,
    severity: 'Error',
    message: 'recordTypeVisibility segment must have one default entry',
    detailedMessage: `Must have default entry if there are visible entries\nThus the following segment must have one default entry (or no visible entries at all) ${elementId.getFullName()}`,
  }
}

const createFieldChangeError = (field: Field, contexts: string[]): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Types cannot have more than one default',
  detailedMessage: `There cannot be more than one 'default' ${field.name} in type ${field.parent.elemID.name}.\nThe following ${FIELD_NAME_TO_INNER_CONTEXT_FIELD[field.name]?.name ?? LABEL}s are set to default: ${contexts}`,
})

const getPicklistMultipleDefaultsErrors = (field: FieldWithValueSet): ChangeError[] => {
  const contexts = (
    isFieldWithValueSetList(field) ? field.annotations.valueSet : Object.values(field.annotations.valueSet.values)
  )
    .filter(obj => obj.default)
    .map(obj => obj[LABEL])
    .map(formatContext)
  return contexts.length > 1 ? [createFieldChangeError(field, contexts)] : []
}

const getInstancesMultipleDefaultsErrors = async (after: InstanceElement): Promise<ChangeError[]> => {
  const getDefaultObjectsList = (val: Value, type: TypeElement): Value[] => {
    if (isMapType(type)) {
      return Object.values(val).flatMap(inner => getDefaultObjectsList(inner, type.getInnerTypeSync()))
    }
    if (isListType(type) && _.isArray(val)) {
      return val.flatMap(inner => getDefaultObjectsList(inner, type.getInnerTypeSync()))
    }
    return val
  }

  const findMultipleDefaults = async (
    value: Value,
    fieldType: TypeElement,
    valueName: string,
  ): Promise<{ defaults: string[] | undefined; count: number }> => {
    const defaultObjects = getDefaultObjectsList(value, fieldType)
    if (!_.isArray(defaultObjects)) {
      return { defaults: undefined, count: 0 }
    }
    const contexts = defaultObjects
      .filter(val => val.default)
      .map(obj => obj[valueName])
      .map(formatContext)
    return { defaults: contexts, count: contexts.length }
  }

  const findNotVisibleDefault = (value: Value, fieldType: TypeElement): string | undefined => {
    const defaultObjects = getDefaultObjectsList(value, fieldType)
    if (!_.isArray(defaultObjects)) {
      return undefined
    }
    const corruptedEntry = defaultObjects.reduce<string | undefined>((res, curr) => {
      if (res !== undefined) {
        return res
      }
      const defaultField = _.get(curr, 'default')
      const visibleField = _.get(curr, 'visible')
      if (defaultField) {
        if (visibleField) {
          return ''
        }
        return curr.recordType
      }
      return undefined
    }, undefined)
    return corruptedEntry !== '' ? corruptedEntry : undefined
  }

  const findVisibleNoDefault = (value: Value, fieldType: TypeElement): boolean => {
    const defaultObjects = getDefaultObjectsList(value, fieldType)
    if (!_.isArray(defaultObjects)) {
      return true
    }
    return !defaultObjects.some(rec => _.get(rec, 'visible'))
  }

  const createChangeErrorFromContext = (
    field: Field,
    context: string[] | undefined,
    instance: InstanceElement,
  ): ChangeError[] => {
    if (context !== undefined) {
      return [createInstanceChangeError(field, context, instance)]
    }
    return NO_ERRORS_FOUND
  }

  const errors: ChangeError[] = await awu(Object.keys(FIELD_NAME_TO_INNER_CONTEXT_FIELD))
    .filter(fieldPath => _.has(after.value, fieldPath))
    .flatMap(async fieldPath => {
      const value = _.get(after.value, fieldPath)
      const field = await getField(after.getTypeSync(), fieldPath.split('.'))
      if (field === undefined) {
        // Can happen if the field exists in the instance but not in the type.
        return NO_ERRORS_FOUND
      }
      const fieldType = field.getTypeSync()
      const valueName = FIELD_NAME_TO_INNER_CONTEXT_FIELD[fieldPath].name
      if (_.isPlainObject(value) && FIELD_NAME_TO_INNER_CONTEXT_FIELD[fieldPath].nested) {
        return awu(Object.entries(value)).flatMap(async ([_key, innerValue]) => {
          const startLevelType = isMapType(fieldType) ? fieldType.getInnerTypeSync() : fieldType
          const { defaults: defaultsContexts, count: defaultsCount } = await findMultipleDefaults(
            innerValue,
            startLevelType,
            valueName,
          )
          if (defaultsContexts === undefined) {
            return NO_ERRORS_FOUND
          }
          if (defaultsCount > 1) {
            return [createInstanceChangeError(field, defaultsContexts, after)]
          }
          if (defaultsCount === 1) {
            const singleDefaultIsValid = findNotVisibleDefault(innerValue, startLevelType)
            if (singleDefaultIsValid !== undefined) {
              return [createInstanceChangeErrorSingleDefaultNoVisible(fieldPath, singleDefaultIsValid, after)]
            }
            return NO_ERRORS_FOUND
          }
          const noDefaultValidation = findVisibleNoDefault(innerValue, startLevelType)
          return !noDefaultValidation ? [createInstanceChangeErrorNoDefault(fieldPath, _key, after)] : NO_ERRORS_FOUND
        })
      }
      const { defaults: defaultsContexts, count: defaultsCount } = await findMultipleDefaults(
        value,
        fieldType,
        valueName,
      )
      return defaultsCount > 1 ? createChangeErrorFromContext(field, defaultsContexts, after) : NO_ERRORS_FOUND
    })
    .toArray()

  return errors
}

/**
 * It is forbidden to set more than one 'default' field as 'true' for some types.
 */
const changeValidator: ChangeValidator = async changes => {
  const instanceChangesErrors = await awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .flatMap(getInstancesMultipleDefaultsErrors)
    .toArray()

  // special treatment for picklist & multipicklist valueSets
  const picklistChangesErrors = await awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isFieldChange)
    .map(getChangeData)
    .filter(isFieldOfCustomObject)
    .filter(isFieldWithValueSet)
    .flatMap(getPicklistMultipleDefaultsErrors)
    .toArray()

  return [...instanceChangesErrors, ...picklistChangesErrors]
}

export default changeValidator
