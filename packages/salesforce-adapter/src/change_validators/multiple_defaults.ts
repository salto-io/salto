/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ChangeError, getChangeData, ChangeValidator, isAdditionOrModificationChange,
  isInstanceChange, Field, InstanceElement,
  isFieldChange, isListType, TypeElement, isMapType, Value, Values, isReferenceExpression,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FIELD_ANNOTATIONS, LABEL } from '../constants'
import { isFieldOfCustomObject } from '../transformers/transformer'

const { awu } = collections.asynciterable
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

const isFieldWithValueSet = (field: Field): field is FieldWithValueSet => (
  _.isArray(field.annotations[FIELD_ANNOTATIONS.VALUE_SET])
)

const formatContext = (context: Value): string => {
  if (isReferenceExpression(context)) {
    return context.elemID.getFullName()
  }
  if (_.isString(context)) {
    return context
  }
  return safeJsonStringify(context)
}

const createInstanceChangeError = (field: Field, contexts: string[], instance: InstanceElement):
  ChangeError => {
  const instanceName = instance.elemID.name
  return {
    elemID: instance.elemID,
    severity: 'Warning',
    message: `There cannot be more than one 'default' field set to 'true'. Field name: ${field.name} in instance: ${instanceName} type ${field.parent.elemID.name}.`,
    detailedMessage: `There cannot be more than one 'default' ${field.name} in instance: ${instanceName} type ${field.parent.elemID.name}. The following ${fieldNameToInnerContextField[field.name] ?? LABEL}s are set to default: ${contexts}`,
  }
}

const createFieldChangeError = (field: Field, contexts: string[]):
  ChangeError => ({
  elemID: field.elemID,
  severity: 'Warning',
  message: `There cannot be more than one 'default' field set to 'true'. Field name: ${field.name} in type ${field.parent.elemID.name}.`,
  detailedMessage: `There cannot be more than one 'default' ${field.name} in type ${field.parent.elemID.name}. The following ${fieldNameToInnerContextField[field.name] ?? LABEL}s are set to default: ${contexts}`,
})

const getPicklistMultipleDefaultsErrors = (field: FieldWithValueSet): ChangeError[] => {
  const contexts = field.annotations.valueSet
    .filter(obj => obj.default)
    .map(obj => obj[LABEL])
    .map(formatContext)
  return contexts.length > 1 ? [createFieldChangeError(field, contexts)] : []
}

const getInstancesMultipleDefaultsErrors = async (
  after: InstanceElement
): Promise<ChangeError[]> => {
  const getDefaultObjectsList = async (val: Value, type: TypeElement): Promise<Value[]> => {
    if (isMapType(type)) {
      return awu(Object.values(val))
        .flatMap(async inner => getDefaultObjectsList(inner, await type.getInnerType()))
        .toArray()
    }
    if (isListType(type) && _.isArray(val)) {
      return awu(val)
        .flatMap(async inner => getDefaultObjectsList(inner, await type.getInnerType()))
        .toArray()
    }
    return val
  }

  const errors: ChangeError[] = await awu(Object.entries(after.value))
    .filter(([fieldName]) => Object.keys(fieldNameToInnerContextField).includes(fieldName))
    .flatMap(async ([fieldName, value]) => {
      const defaultObjects = await getDefaultObjectsList(
        value,
        await (await after.getType()).fields[fieldName].getType()
      )
      const contexts = defaultObjects
        .filter(val => val.default)
        .map(obj => obj[fieldNameToInnerContextField[fieldName]])
        .map(formatContext)
      return contexts.length > 1
        ? [
          createInstanceChangeError((
            await after.getType()).fields[fieldName],
          contexts,
          after),
        ] : []
    }).toArray()

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
