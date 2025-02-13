/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { OKTA, APPLICATION_TYPE_NAME } from '../../src/constants'
import OktaClient from '../../src/client/client'
import { getAdminUrl } from '../../src/client/admin'
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
  const appInstance = new InstanceElement('appInstance', appType, {
    name: 'appInstance',
    label: 'appInstance',
    signOnMode: 'SAML_2_0',
  })
  const appInstanceWithoutSAML = new InstanceElement('appInstanceWithoutSAML', appType, {
    name: 'appInstanceWithoutSAML',
    label: 'appInstanceWithoutSAML',
    signOnMode: 'AUTO_LOGIN',
  })
  const appInstanceWithoutLabel = new InstanceElement('appInstanceWithoutName', appType, { signOnMode: 'SAML_2_0' })

  it('should return message with app name if app has Saml sign on mode and name field', async () => {
    const changes = [toChange({ after: appInstance })]
    const changeErrors = await appIntegrationSetupValidator(client)(changes)
    expect(changeErrors).toEqual([
      {
        elemID: appInstance.elemID,
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
              `Go to application page at ${getAdminUrl(client.baseUrl)}/admin/apps/active`,
              `Click on ${appInstance.value.name}.`,
              'Click on "Sign On" tab.',
              'On the right side, click on "View SAML setup instructions".',
              'Follow the instructions to complete the setup.',
            ],
          },
        },
      },
    ])
  })
  it('should return empty array if app has not Saml sign on mode', async () => {
    const changes = [toChange({ after: appInstanceWithoutSAML })]
    const changeErrors = await appIntegrationSetupValidator(client)(changes)
    expect(changeErrors).toEqual([])
  })
  it('should return message if app has Saml sign on mode and no label field', async () => {
    const changes = [toChange({ after: appInstanceWithoutLabel })]
    const changeErrors = await appIntegrationSetupValidator(client)(changes)
    expect(changeErrors).toEqual([
      {
        elemID: appInstanceWithoutLabel.elemID,
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
              `Go to application page at ${getAdminUrl(client.baseUrl)}/admin/apps/active`,
              'Click on the application.',
              'Click on "Sign On" tab.',
              'On the right side, click on "View SAML setup instructions".',
              'Follow the instructions to complete the setup.',
            ],
          },
        },
      },
    ])
  })
})
