/*
*                      Copyright 2021 Salto Labs Ltd.
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

import {
  ChangeError, getChangeElement, ChangeValidator, isAdditionOrModificationChange,
  isInstanceChange, Field, InstanceElement,
  isFieldChange, isListType, TypeElement, isMapType, Value, Values, isReferenceExpression,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { LABEL, VALUE_SET } from '../constants'
import { isFieldOfCustomObject } from '../transformers/transformer'

const fieldNameToInnerContextField: Record<string, string> = {
  applicationVisibilities: 'application',
  recordTypeVisibilities: 'recordType',
  standardValue: 'label',
  customValue: 'label',
}

type ValueSetInnerObject = {
  default: boolean
  label: string
} & Values[]

type FieldWithValueSet = Field & {
  annotations: {
    valueSet: Array<ValueSetInnerObject>
  }
}

const formatContext = (context: Value): string => {
  if (isReferenceExpression(context)) {
    return context.elemId.getFullName()
  }
  if (_.isString(context)) {
    return context
  }
  return safeJsonStringify(context)
}

const createChangeError = (field: Field, contexts: string[], instanceName?: string):
  ChangeError => ({
  elemID: field.elemID,
  severity: 'Warning',
  message: `There cannot be more than one 'default' field set to 'true'. Field name: ${field.name} in${instanceName ? ` instance: ${instanceName}` : ''} type ${field.parent.elemID.name}.`,
  detailedMessage: `There cannot be more than one 'default' field set to 'true'. Field name: ${field.name} in${instanceName ? ` instance: ${instanceName}` : ''} type ${field.parent.elemID.name}. The 'default = true' are where the ${fieldNameToInnerContextField[field.name] ?? LABEL}s are: ${contexts}`,
})

const getPicklistMultipleDefaultsErrors = (field: FieldWithValueSet): ChangeError[] => {
  const contexts = field.annotations[VALUE_SET]
    .filter(obj => obj.default)
    .map(obj => obj[LABEL])
    .map(formatContext)
  return contexts.length > 1 ? [createChangeError(field, contexts)] : []
}

const getInstancesMultipleDefaultsErrors = (after: InstanceElement): ChangeError[] => {
  const getDefaultObjectsList = (val: Value, type: TypeElement): Value[] => {
    if (isMapType(type)) {
      return Object.values(val).flatMap(inner => getDefaultObjectsList(inner, type.innerType))
    }
    if (isListType(type) && _.isArray(val)) {
      return val.flatMap(inner => getDefaultObjectsList(inner, type.innerType))
    }
    return val
  }

  const errors: ChangeError[] = Object.entries(after.value)
    .filter(([fieldName]) => Object.keys(fieldNameToInnerContextField).includes(fieldName))
    .flatMap(([fieldName, value]) => {
      const defaultObjects = getDefaultObjectsList(value, after.type.fields[fieldName].type)
      const contexts = defaultObjects
        .filter(val => val.default)
        .map(obj => obj[fieldNameToInnerContextField[fieldName]])
        .map(formatContext)
      return contexts.length > 1
        ? [createChangeError(after.type.fields[fieldName], contexts, after.elemID.name)]
        : []
    })

  return errors
}

/**
 * It is forbidden to set more than one 'default' field as 'true' for some types.
 */
const changeValidator: ChangeValidator = async changes => {
  const instanceChangesErrors = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeElement)
    .flatMap(getInstancesMultipleDefaultsErrors)

  // special treatment for picklist & multipicklist valueSets
  const picklistChangesErrors = changes
    .filter(isAdditionOrModificationChange)
    .filter(isFieldChange)
    .map(getChangeElement)
    .filter(isFieldOfCustomObject)
    .filter(field => values.isDefined(field.annotations.valueSet))
    .map(field => field as FieldWithValueSet)
    .flatMap(getPicklistMultipleDefaultsErrors)

  return [...instanceChangesErrors, ...picklistChangesErrors]
}

export default changeValidator
