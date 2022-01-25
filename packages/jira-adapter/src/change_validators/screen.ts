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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange, isReferenceExpression, SaltoErrorSeverity, Values } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'

const { awu } = collections.asynciterable

export const screenValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === 'Screen')
    .map(async instance => {
      const usedFields = (Object.values(instance.value.tabs ?? {}) as Values[])
        .flatMap(tab => tab.fields ?? [])

      const duplicateFields = _(usedFields)
        .map(field => (isReferenceExpression(field) ? field.elemID.getFullName() : field))
        .countBy()
        .pickBy(count => count > 1)
        .keys()
        .value()

      if (duplicateFields.length > 0) {
        return {
          elemID: instance.elemID,
          severity: 'Error' as SaltoErrorSeverity,
          message: 'Fields cannot be used more than once in the same screen instance',
          detailedMessage: `The ${duplicateFields.length > 1 ? 'fields' : 'field'} ${duplicateFields.join(', ')} can only be used once in the tabs of screen ${instance.elemID.getFullName()}`,
        }
      }
      return undefined
    })
    .filter(values.isDefined)
    .toArray()
)
