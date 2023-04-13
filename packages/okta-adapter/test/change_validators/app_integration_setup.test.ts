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

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { OKTA, APPLICATION_TYPE_NAME } from '../../src/constants'
import OktaClient, { getAdminUrl } from '../../src/client/client'
import { mockClient } from '../utils'
import { appIntegrationSetupValidator } from '../../src/change_validators/app_integration_setup'

describe('appIntegrationSetupValidator', () => {
  let client: OktaClient
  beforeEach(async () => {
    jest.clearAllMocks()
    const mockCli = mockClient()
    client = mockCli.client
  })

  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const appInstance = new InstanceElement(
    'appInstance',
    appType,
    { name: 'appInstance', label: 'appInstance', signOnMode: 'SAML_2_0' }
  )
  const appInstanceWithoutSAML = new InstanceElement(
    'appInstanceWithoutSAML',
    appType,
    { name: 'appInstanceWithoutSAML', label: 'appInstanceWithoutSAML', signOnMode: 'AUTO_LOGIN' }
  )
  const appInstanceWithoutLabel = new InstanceElement(
    'appInstanceWithoutName',
    appType,
    { signOnMode: 'SAML_2_0' }
  )

  it('should return message with app name if app has Saml sign on mode and label field', async () => {
    const changes = [toChange({ after: appInstance })]
    const changeErrors = await appIntegrationSetupValidator(client)(changes)
    expect(changeErrors).toEqual([{
      elemID: appInstance.elemID,
      severity: 'Info',
      message: 'New application integration setup required',
      detailedMessage: 'In the service provider, follow the instructions provided by Okta to configure the application integration',
      deployActions: {
        postAction: {
          title: 'New application integration setup required',
          description: 'To complete the setup of the new application integration in Okta, follow these steps:',
          subActions: [
            `Go to application page at ${getAdminUrl(client.baseUrl)}/admin/apps/active`,
            `Click on ${appInstance.value.name}.`,
            'Click on "Sign On" tab.',
            'On the right side, click on "View SAML setup instructions".',
            'Follow the instructions to complete the setup.',
          ],
        },
      },
    }])
  })
  it('should return empty array if app has no Saml sign on mode', async () => {
    const changes = [toChange({ after: appInstanceWithoutSAML })]
    const changeErrors = await appIntegrationSetupValidator(client)(changes)
    expect(changeErrors).toEqual([])
  })
  it('should return message if app has Saml sign on mode and no label field', async () => {
    const changes = [toChange({ after: appInstanceWithoutLabel })]
    const changeErrors = await appIntegrationSetupValidator(client)(changes)
    expect(changeErrors).toEqual([{
      elemID: appInstanceWithoutLabel.elemID,
      severity: 'Info',
      message: 'New application integration setup required',
      detailedMessage: 'In the service provider, follow the instructions provided by Okta to configure the application integration',
      deployActions: {
        postAction: {
          title: 'New application integration setup required',
          description: 'To complete the setup of the new application integration in Okta, follow these steps:',
          subActions: [
            `Go to application page at ${getAdminUrl(client.baseUrl)}/admin/apps/active`,
            'Click on the application.',
            'Click on "Sign On" tab.',
            'On the right side, click on "View SAML setup instructions".',
            'Follow the instructions to complete the setup.',
          ],
        },
      },
    }])
  })
})
