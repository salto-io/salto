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

import { ChangeError, ChangeValidator, InstanceElement, getChangeData, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import OktaClient, { getAdminUrl } from '../client/client'
import { APPLICATION_TYPE_NAME } from '../constants'

const SAML_2_0_APP = 'SAML_2_0'

const createChangeError = (instance: InstanceElement, baseUrl: string): ChangeError => {
  const suffixUrl = '/admin/apps/active'
  const url = (new URL(suffixUrl, baseUrl)).href
  return {
    elemID: instance.elemID,
    severity: 'Info',
    message: 'New app integration setup required',
    detailedMessage: 'In the service provider, follow the instructions provided by Okta to configure the app integration',
    deployActions: {
      postAction: {
        title: 'New app integration setup required',
        description: 'To complete the setup of the new app integration in Okta, follow these steps:',
        subActions: [
          `Go to application page at ${url}`,
          `Click on ${instance.value.name ?? instance.value.customName ?? 'the application'}.`,
          'Click on "Sign On" tab.',
          'On the right side, click on "View SAML setup instructions".',
          'Follow the instructions to complete the setup.',
        ],
      },
    },
  }
}

export const serviceProviderConnectionValidator: (client: OktaClient) =>
  ChangeValidator = client => async changes => (
    changes
      .filter(isAdditionChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
      .filter(instance => instance.value.signOnMode === SAML_2_0_APP)
      .flatMap(instance => ([createChangeError(instance, getAdminUrl(client.baseUrl) as string)]))
  )
