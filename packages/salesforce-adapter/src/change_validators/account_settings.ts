/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { isInstanceOfTypeSync } from '../filters/utils'
import { ACCOUNT_SETTINGS_METADATA_TYPE, ORGANIZATION_SETTINGS, SALESFORCE } from '../constants'

const log = logger(module)

const isRecordTypeInvalid = (globalSharingSettings: InstanceElement, instance: InstanceElement): boolean =>
  globalSharingSettings.value.defaultAccountAccess !== 'Read' && instance.value.enableAccountOwnerReport !== undefined

const invalidRecordTypeError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message:
    "Cannot set a value for 'enableAccountOwnerReport' unless your organization-wide sharing access level for Accounts is set to Private",
  detailedMessage: `enableAccountOwnerReport is set to '${instance.value.enableAccountOwnerReport}' but the organization-wide sharing access level for Accounts is not set to 'Private'.
See https://help.salesforce.com/s/articleView?id=sf.admin_sharing.htm for instruction on how to change the organization-wide sharing defaults, or remove the 'enableAccountOwnerReport' value from ${instance.value.fullName}.
      You can learn more about this deployment preview error here: https://help.salto.io/en/articles/7907434-account-owner-report-cannot-be-enabled`,
})

const changeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.error('Change validator did not receive an element source.')
    return []
  }

  const orgWideSettings = await elementsSource.get(new ElemID(SALESFORCE, ORGANIZATION_SETTINGS, 'instance'))

  if (!isInstanceElement(orgWideSettings)) {
    log.error('Expected a single Organization instance. Found %o instead', orgWideSettings)
    return []
  }

  return changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(ACCOUNT_SETTINGS_METADATA_TYPE))
    .filter(accountSettingsInstance => isRecordTypeInvalid(orgWideSettings, accountSettingsInstance))
    .map(invalidRecordTypeError)
}

export default changeValidator
