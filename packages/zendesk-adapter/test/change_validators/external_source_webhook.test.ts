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

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { WEBHOOK_TYPE_NAME, ZENDESK } from '../../src/constants'
import { externalSourceWebhook } from '../../src/change_validators'
import { APP_INSTALLATION_TYPE_NAME } from '../../src/filters/app'

describe('Webhooks with external_source', () => {
  const appInstallation = new InstanceElement(
    'someAppInstallation',
    new ObjectType({ elemID: new ElemID(ZENDESK, APP_INSTALLATION_TYPE_NAME) }),
    { settings: { name: 'test' } }
  )
  const webhook = new InstanceElement(
    'webhook',
    new ObjectType({ elemID: new ElemID(ZENDESK, WEBHOOK_TYPE_NAME) }),
    {
      status: 'active',
      name: 'test',
      not_relevant_field: { external_source: 'test' },
      external_source: { data: { installation_id: new ReferenceExpression(appInstallation.elemID, appInstallation) } },
    }
  )
  const regularWebhook = webhook.clone()
  delete regularWebhook.value.external_source
  const appInstallationMessage = `This webhook was installed by the external app '${appInstallation.elemID.name}'`

  it('webhook removal', async () => {
    const changes = [toChange({ before: webhook }), toChange({ before: regularWebhook })]
    const errors = await externalSourceWebhook(changes)

    expect(errors).toMatchObject([{
      elemID: webhook.elemID,
      severity: 'Error',
      message: 'Removing a webhook that was installed by an external app',
      detailedMessage: `${appInstallationMessage}, In order to remove it, please uninstall that app.`,
    }])
  })
  it('webhook addition', async () => {
    const changes = [toChange({ after: webhook }), toChange({ after: regularWebhook })]
    const errors = await externalSourceWebhook(changes)

    expect(errors).toMatchObject([{
      elemID: webhook.elemID,
      severity: 'Error',
      message: 'Installing a webhook that was installed by an external app',
      detailedMessage: `${appInstallationMessage}, In order to add it, please install that app.`,
    }])
  })

  describe('webhook modification', () => {
    it('modification of external_source', async () => {
      const changedWebhook = webhook.clone()
      changedWebhook.value.external_source.type = 'changed'
      const errors = await externalSourceWebhook([toChange({ before: webhook, after: changedWebhook })])

      expect(errors).toMatchObject([{
        elemID: webhook.elemID,
        severity: 'Error',
        message: 'Illegal webhook modification',
        detailedMessage: `Cannot modify 'external_source' field of a webhook (${changedWebhook.elemID.name})`,
      }])
    })
    it('deactivation of the webhook', async () => {
      const changedWebhook = webhook.clone()
      changedWebhook.value.status = 'inactive'
      const errors = await externalSourceWebhook([toChange({ before: webhook, after: changedWebhook })])

      expect(errors).toMatchObject([{
        elemID: webhook.elemID,
        severity: 'Warning',
        message: 'Deactivating a webhook that was installed by an external app',
        detailedMessage: `${appInstallationMessage}, If you deactivate this webhook (${changedWebhook.elemID.name}), the app that created it might not work as intended. You'll need to reactivate it to use it again.`,
      }])
    })
    it('regular change of the webhook', async () => {
      const beforeWebhook = webhook.clone()
      const afterWebhook = webhook.clone()
      afterWebhook.value.name = 'changed'
      afterWebhook.value.not_relevant_field.external_source = 'changed'
      afterWebhook.value.external_source.data.installation_id = 123 // To check the detailedMessage without an app name
      beforeWebhook.value.external_source.data.installation_id = 123
      const errors = await externalSourceWebhook([toChange({ before: beforeWebhook, after: afterWebhook })])

      expect(errors).toMatchObject([{
        elemID: webhook.elemID,
        severity: 'Warning',
        message: 'Changing a webhook that was installed by an external app',
        detailedMessage: `This webhook was installed an external app, If you edit this webhook (${afterWebhook.elemID.name}), the app that created it might not work as intended.`,
      }])
    })
  })
})
