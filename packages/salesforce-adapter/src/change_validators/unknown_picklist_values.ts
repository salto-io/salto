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
import { isPicklistField } from '../filters/value_set'


const { isDefined } = values
const { awu } = collections.asynciterable

const createUnknownPicklistValueChangeError = (
  instance: InstanceElement,
  field: Field,
  unknownValue: string
): ChangeError => ({
  elemID: instance.elemID,
  message: `Unknown picklist value ${unknownValue} on field ${field.elemID.name} of instance `,
  detailedMessage: `Supported values are ${field.annotations[CORE_ANNOTATIONS.RESTRICTION]?.values}`,
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
      const allowedValues = field.annotations[CORE_ANNOTATIONS.RESTRICTION]?.values
      return fieldValue === undefined || !_.isArray(allowedValues) || allowedValues.includes(fieldValue)
        ? undefined
        : createUnknownPicklistValueChangeError(instance, field, fieldValue)
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
