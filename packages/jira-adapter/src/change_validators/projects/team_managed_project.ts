/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { PROJECT_TYPE } from '../../constants'
import JiraClient from '../../client/client'

export const teamManagedProjectValidator: (client: JiraClient) => ChangeValidator = client => async changes => {
  if (client.isDataCenter) {
    return []
  }

  return changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => change.data.after.elemID.typeName === PROJECT_TYPE)
    .map(getChangeData)
    .filter(instance => instance.value.style === 'next-gen')
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: "Can't deploy a team-managed project",
      detailedMessage: 'Currently team-managed projects are not supported. The project will not be deployed.',
    }))
}
