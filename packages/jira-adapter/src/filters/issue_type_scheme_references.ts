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
import { Element, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'

export const isIssueTypeSchemeInstance = (element: Element): element is InstanceElement =>
  isInstanceElement(element) && element.elemID.typeName === 'IssueTypeScheme'

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const isIssueTypeInstance = (element: Element): element is InstanceElement =>
      isInstanceElement(element) && element.elemID.typeName === 'IssueTypeDetails'
    const issueTypeInstances = elements.filter(isIssueTypeInstance)
    const issueTypesByIds = _.keyBy(
      issueTypeInstances,
      issueType => issueType.value.id as string
    )

    const setReferences = (scheme: InstanceElement): void => {
      const schemeIssueTypes: string[] = scheme.value.issueTypes
        .map((value: { issueTypeId: string }) => value.issueTypeId)
      scheme.value.issueTypes = schemeIssueTypes
        .map(issueTypeId => new ReferenceExpression(issueTypesByIds[issueTypeId].elemID))
    }
    elements
      .filter(isIssueTypeSchemeInstance)
      .forEach(setReferences)
  },
})

export default filter
