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
import _ from 'lodash'
import { ChangeValidator, compareSpecialValues, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isReferenceExpression, ModificationChange, SaltoErrorSeverity, Values } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'

const getFieldId = (field: Values): string => (
  isReferenceExpression(field.id) ? field.id.value.value.id : field.id
)

const getDiffFields = (change: ModificationChange<InstanceElement>): Values[] => {
  const beforeIdToField = _(change.data.before.value.fields)
    .values()
    .keyBy(getFieldId)
    .value()

  return (Object.values(change.data.after.value.fields ?? []) as Values[])
    .filter(
      (field: Values) => !_.isEqualWith(
        field,
        beforeIdToField[getFieldId(field)],
        compareSpecialValues
      )
    )
}

export const unsupportedFieldConfigurationsValidator: ChangeValidator = async changes => (
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === 'FieldConfiguration')
    .map(change => {
      const fields = isAdditionChange(change)
        ? Object.values(change.data.after.value.fields ?? []) as Values[]
        : getDiffFields(change)

      const unsupportedIds = fields
        .filter((field: Values) => field.id.value.value.isLocked)
        .map(getFieldId)

      const { elemID } = getChangeData(change)
      if (unsupportedIds.length !== 0) {
        return {
          elemID,
          severity: 'Warning' as SaltoErrorSeverity,
          message: `Salto can't deploy fields configuration of ${elemID.getFullName()} because they are locked`,
          detailedMessage: `Salto can't deploy the configuration of fields: ${unsupportedIds.join(', ')}. If continuing, they will be omitted from the deployment`,
        }
      }
      return undefined
    })
    .filter(values.isDefined)
)
