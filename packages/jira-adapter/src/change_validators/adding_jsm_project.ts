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
  SeverityLevel,
  isAdditionChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { PROJECT_TYPE, SERVICE_DESK } from '../constants'
import { hasJiraServiceDeskLicense } from '../utils'

const { awu } = collections.asynciterable

/*
 * This validator prevents addition of jsm project when JSM is disabled in the service.
 */
export const addJsmProjectValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }
  if ((await hasJiraServiceDeskLicense(elementsSource)) === true) {
    return []
  }

  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
    .filter(project => project.value.projectTypeKey === SERVICE_DESK)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'JSM Project cannot be deployed to instance without JSM',
      detailedMessage:
        'This JSM project can not be deployed, as JSM is not enabled in the target instance. Enable JSM on your target first, then try again.',
    }))
    .toArray()
}
