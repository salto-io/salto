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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange, SaltoErrorSeverity, Values } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-utils'
import { getLookUpName } from '../reference_mapping'

const { awu } = collections.asynciterable

export const screenValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === 'Screen')
    .map(async instance => {
      const resolvedInstance = await resolveValues(instance, getLookUpName)

      const usedFields = (Object.values(resolvedInstance.value.tabs ?? {}) as Values[])
        .flatMap(tab => tab.fields ?? [])

      if (usedFields.length !== new Set(usedFields).size) {
        return {
          elemID: instance.elemID,
          severity: 'Error' as SaltoErrorSeverity,
          message: `A field can only be used once in the tabs of screen ${instance.elemID.getFullName()}`,
          detailedMessage: 'The field cannot be used more than once in the same screen instance',
        }
      }
      return undefined
    })
    .filter(values.isDefined)
    .toArray()
)
