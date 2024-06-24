/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  ChangeError,
  ChangeValidator,
  Field,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import {
  FIELD_ANNOTATIONS,
  INSTANCE_FULL_NAME_FIELD,
  VALUE_SET_FIELDS,
} from '../constants'
import { Types } from '../transformers/transformer'

const { isDefined } = values
const { awu } = collections.asynciterable

type ValueSetValue = {
  [INSTANCE_FULL_NAME_FIELD]: string
}[]

type GlobalValueSetValue = InstanceElement['value'] & {
  customValue: ValueSetValue
}

const isValueSetValue = (value: unknown): value is ValueSetValue =>
  _.isArray(value) &&
  value.every((entry) => _.isString(entry[INSTANCE_FULL_NAME_FIELD]))

const isGlobalValueSetValue = (value: unknown): value is GlobalValueSetValue =>
  isValueSetValue(_.get(value, 'customValue'))

const getGlobalValueSetValue = (
  field: Field,
): GlobalValueSetValue | undefined => {
  const valueSetName = field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
  if (!isReferenceExpression(valueSetName)) {
    return undefined
  }
  const globalValueSetInstance = valueSetName.value
  return isInstanceElement(globalValueSetInstance) &&
    isGlobalValueSetValue(globalValueSetInstance.value)
    ? globalValueSetInstance.value
    : undefined
}

const getAllowedValues = (field: Field): string[] | undefined => {
  const valueSet = field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
  // ValueSet
  if (isValueSetValue(valueSet)) {
    return valueSet.map((entry) => entry[INSTANCE_FULL_NAME_FIELD])
  }
  // GlobalValueSet
  const globalValueSetValue = getGlobalValueSetValue(field)
  if (globalValueSetValue !== undefined) {
    return globalValueSetValue.customValue.map(
      (entry) => entry[INSTANCE_FULL_NAME_FIELD],
    )
  }
  return undefined
}

const createUnknownPicklistValueChangeError = (
  instance: InstanceElement,
  field: Field,
  unknownValue: string,
  allowedValues: string[],
): ChangeError => ({
  elemID: instance.elemID,
  message: 'Unknown picklist value',
  detailedMessage: `Unknown picklist value "${unknownValue}" on ${instance.elemID.getFullName()}.${field.elemID.name}, Supported values are ${safeJsonStringify(allowedValues)}. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/7907887-unknown-picklist-value`,
  severity: 'Warning',
})

const createUnknownPicklistValueChangeErrors = async (
  instance: InstanceElement,
): Promise<ChangeError[]> => {
  const { fields } = await instance.getType()
  const picklistFieldNames = Object.values(fields)
    // Only checking picklist fields for now and not multi-picklist fields because multi-picklist
    // fields require more manipulations
    .filter((field) =>
      field.refType.elemID.isEqual(Types.primitiveDataTypes.Picklist.elemID),
    )
    .map((field) => field.name)
  return picklistFieldNames
    .map((picklistFieldName) => {
      const field = fields[picklistFieldName]
      const fieldValue = instance.value[picklistFieldName]
      if (fieldValue === undefined) {
        return undefined
      }
      const allowedValues = getAllowedValues(field)
      return allowedValues !== undefined && !allowedValues.includes(fieldValue)
        ? createUnknownPicklistValueChangeError(
            instance,
            field,
            fieldValue,
            allowedValues,
          )
        : undefined
    })
    .filter(isDefined)
}

const changeValidator: ChangeValidator = async (changes) =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .flatMap(createUnknownPicklistValueChangeErrors)
    .toArray()

export default changeValidator
