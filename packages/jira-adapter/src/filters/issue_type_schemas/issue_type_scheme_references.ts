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
import { Element, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { ISSUE_TYPE_SCHEMA_NAME } from '../../constants'
import { FilterCreator } from '../../filter'

const filter: FilterCreator = () => ({
  name: 'issueTypeSchemeReferences',
  onFetch: async (elements: Element[]) => {
    const isIssueTypeScheme = (element: Element): boolean =>
      element.elemID.typeName === ISSUE_TYPE_SCHEMA_NAME
    const setReferences = (scheme: InstanceElement): void => {
      type IssueTypeMapping = { issueTypeId: ReferenceExpression }
      scheme.value.issueTypeIds = scheme.value.issueTypeIds
        ?.map((issueTypeMapping: IssueTypeMapping) => issueTypeMapping.issueTypeId)
    }
    elements
      .filter(isInstanceElement)
      .filter(isIssueTypeScheme)
      .forEach(setReferences)
  },
})

export default filter
