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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange, isReferenceExpression, SeverityLevel, Values } from '@salto-io/adapter-api'
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
          severity: 'Error' as SeverityLevel,
          message: 'Can’t deploy screen which uses fields more than once',
          detailedMessage: `This screen uses the following ${duplicateFields.length > 1 ? 'fields' : 'field'} more than once: ${duplicateFields.join(', ')}. Make sure each field is used only once, and try again.`,
        }
      }
      return undefined
    })
    .filter(values.isDefined)
    .toArray()
)
