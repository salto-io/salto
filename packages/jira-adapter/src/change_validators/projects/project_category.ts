/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isModificationChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { PROJECT_TYPE } from '../../constants'
import JiraClient from '../../client/client'
import { isNeedToDeleteCategory } from '../../filters/project_category'

export const projectCategoryValidator: (client: JiraClient) => ChangeValidator = client => async changes => {
  if (!client.isDataCenter) {
    return []
  }

  return changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => change.data.after.elemID.typeName === PROJECT_TYPE)
    .filter(isNeedToDeleteCategory)
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Warning' as SeverityLevel,
      message: "Can't remove an existing project's category",
      detailedMessage:
        "Jira Data Center does not support removing an existing project's category. The existing category will be retained.",
    }))
}
