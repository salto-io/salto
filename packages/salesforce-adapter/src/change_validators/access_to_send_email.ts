/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isObjectType,
} from '@salto-io/adapter-api'
import { QUICK_ACTION_METADATA_TYPE, SALESFORCE } from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'

export const TYPES_EMAILS: string[] = [QUICK_ACTION_METADATA_TYPE]

const accessToSendEmailsError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message:
    "Cannot deploy instances of 'emailActions' when 'Access to Send Email (All Email Services)' is not set to 'All email'",
  detailedMessage:
    "In order to deploy, you can go to the service, go to setup, in the 'quick find' box search for 'Deliverability', choose it and change the 'Access to Send Email (All Email Services)' to 'All email'",
})

const changeValidator: ChangeValidator = async (changes, elementSource) => {
  const elements = changes.map(getChangeData).filter(isInstanceOfTypeSync(...TYPES_EMAILS))
  const userSettings: unknown = await elementSource?.get(new ElemID(SALESFORCE, 'User'))
  if (
    isObjectType(userSettings) &&
    userSettings.fields.UserPreferencesNativeEmailClient === undefined &&
    elements.length > 0
  ) {
    return elements.map(accessToSendEmailsError)
  }
  return []
}

export default changeValidator
