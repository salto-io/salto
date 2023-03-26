/*
*                      Copyright 2023 Salto Labs Ltd.
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
  CORE_ANNOTATIONS, Field, getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { isPicklistField } from '../filters/value_set'
import { FIELD_ANNOTATIONS, INSTANCE_FULL_NAME_FIELD } from '../constants'


const { isDefined } = values
const { awu } = collections.asynciterable

type ValueSetValue = {
  [INSTANCE_FULL_NAME_FIELD]: string
}[]

const isValueSetValue = (value: unknown): value is ValueSetValue => (
  _.isArray(value) && value.every(entry => _.isString(entry[INSTANCE_FULL_NAME_FIELD]))
)

const getAllowedValues = (field: Field): string[] | undefined => {
  const valueSet = field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
  if (isValueSetValue(valueSet)) {
    return valueSet.map(entry => entry[INSTANCE_FULL_NAME_FIELD])
  }
  // TODO: Global Value Set support
  return undefined
}

const createUnknownPicklistValueChangeError = (
  instance: InstanceElement,
  field: Field,
  unknownValue: string
): ChangeError => ({
  elemID: instance.elemID,
  message: `Unknown picklist value "${unknownValue}" on field ${field.elemID.name} of instance ${instance.elemID.getFullName()}`,
  detailedMessage: `Supported values are ${safeJsonStringify(field.annotations[CORE_ANNOTATIONS.RESTRICTION]?.values)}`,
  severity: 'Error',
})

const createUnknownPicklistValueChangeErrors = async (instance: InstanceElement): Promise<ChangeError[]> => {
  const { fields } = await instance.getType()
  const picklistFieldNames = Object.values(fields)
    .filter(isPicklistField)
    .map(field => field.name)
  return picklistFieldNames
    .map(picklistFieldName => {
      const field = fields[picklistFieldName]
      const fieldValue = instance.value[picklistFieldName]
      if (fieldValue === undefined) {
        return undefined
      }
      const allowedValues = getAllowedValues(field)
      return allowedValues !== undefined && !allowedValues.includes(fieldValue)
        ? createUnknownPicklistValueChangeError(instance, field, fieldValue)
        : undefined
    })
    .filter(isDefined)
}

const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .flatMap(createUnknownPicklistValueChangeErrors)
    .toArray()
)


export default changeValidator
