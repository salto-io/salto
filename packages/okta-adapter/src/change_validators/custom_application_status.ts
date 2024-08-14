/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { INACTIVE_STATUS, APPLICATION_TYPE_NAME } from '../constants'
import { isInactiveCustomAppChange } from '../definitions/deploy/types/application'

/**
 * Modifications of custom application in status 'INACTIVE' are not supported via the Okta API
 * Therefore, we notify the user the application will be activated in order to apply changes
 */
export const customApplicationStatusValidator: ChangeValidator = async changes => {
  const relevantChanges = changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(instance => getChangeData(instance).elemID.typeName === APPLICATION_TYPE_NAME)
    .filter(change => isInactiveCustomAppChange(change))

  return relevantChanges.map(change => ({
    elemID: getChangeData(change).elemID,
    severity: 'Warning',
    message: 'Application will be activated in order to apply those changes',
    detailedMessage: `Modifications of custom applications in status ${INACTIVE_STATUS} are not supported via the Okta API. Therefore, Salto will activate the application in order to apply changes, and deactivate it afterwards. Alternatively, you can make this change in Okta and fetch.`,
  }))
}
