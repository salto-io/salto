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
import { CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { addAnnotationRecursively, findObject, setTypeDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { ISSUE_EVENT_TYPE_NAME } from '../../constants'

/**
 * Filter to support deploy in DC, handles annotations of IssueEvents
 */
const filter: FilterCreator = ({ client }) => ({
  name: 'deployDcIssueEventsFilter',
  onFetch: async elements => {
    if (!client.isDataCenter) {
      return
    }
    const issueEventType = findObject(elements, ISSUE_EVENT_TYPE_NAME)
    if (issueEventType === undefined) {
      return
    }
    setTypeDeploymentAnnotations(issueEventType)
    await addAnnotationRecursively(issueEventType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(issueEventType, CORE_ANNOTATIONS.UPDATABLE)
    issueEventType.fields.id.annotations[CORE_ANNOTATIONS.CREATABLE] = false
  },
})

export default filter
