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
import { ChangeValidator, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, ReadOnlyElementsSource, SeverityLevel } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../constants'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'

const { awu } = collections.asynciterable

const getUnresolvedFieldConfigurationItems = async (
  instance: InstanceElement,
  elementsSource: ReadOnlyElementsSource
): Promise<string[]> => awu(Object.keys(instance.value.fields ?? {}))
  .filter(async fieldName => !(await elementsSource.has(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', fieldName))))
  .toArray()

export const unresolvedFieldConfigurationItemsValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }

  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
    .map(getChangeData)
    .map(async instance => {
      const unresolvedFields = await getUnresolvedFieldConfigurationItems(instance, elementsSource)
      return unresolvedFields.length > 0 ? {
        elemID: instance.elemID,
        severity: 'Warning' as SeverityLevel,
        message: 'Field configuration has configuration of fields that do not exist in the account',
        detailedMessage: `The following fields configuration items will not be deployed since their fields do not exist in the account: ${unresolvedFields.join(', ').slice(0, 100)}`,
      } : undefined
    })
    .filter(values.isDefined)
    .toArray()
}
