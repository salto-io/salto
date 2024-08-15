/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  ChangeValidator,
  InstanceElement,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import OktaClient from '../client/client'
import { getAdminUrl } from '../client/admin'
import { APPLICATION_TYPE_NAME, SAML_2_0_APP } from '../constants'

const createAppSetupMsg = (instance: InstanceElement, baseUrl: string | undefined): ChangeError => {
  const suffixUrl = '/admin/apps/active'
  const url = baseUrl ? new URL(suffixUrl, baseUrl).href : undefined
  return {
    elemID: instance.elemID,
    severity: 'Info',
    message: 'New application integration setup required',
    detailedMessage:
      'In the service provider, follow the instructions provided by Okta to configure the app integration',
    deployActions: {
      postAction: {
        title: 'New application integration setup required',
        description: 'To complete the setup of the new app integration in Okta, follow these steps:',
        showOnFailure: false,
        subActions: [
          `Go to application page at ${url ?? 'Okta Admin console'}`,
          `Click on ${instance.value.label ?? 'the application'}.`,
          'Click on "Sign On" tab.',
          'On the right side, click on "View SAML setup instructions".',
          'Follow the instructions to complete the setup.',
        ],
      },
    },
  }
}
/**
 * Ensures that a service provider application integrates with Okta using the SAML 2.0 protocol.
 */
export const appIntegrationSetupValidator: (client: OktaClient) => ChangeValidator = client => async changes =>
  changes
    .filter(isAdditionChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
    .filter(instance => instance.value.signOnMode === SAML_2_0_APP)
    .map(instance => createAppSetupMsg(instance, getAdminUrl(client.baseUrl)))
