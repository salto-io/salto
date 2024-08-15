/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
