/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { WEBHOOK_TYPE_NAME, ZENDESK } from '../../src/constants'
import { externalSourceWebhook } from '../../src/change_validators'

describe('Webhooks with external_source', () => {
  const webhook = new InstanceElement(
    'webhook',
    new ObjectType({ elemID: new ElemID(ZENDESK, WEBHOOK_TYPE_NAME) }),
    { status: 'active', signing_secret: '123', external_source: { type: 'test' }, name: 'test' }
  )
  const regularWebhook = webhook.clone()
  delete regularWebhook.value.external_source

  it('webhook removal', async () => {
    const changes = [toChange({ before: webhook }), toChange({ before: regularWebhook })]
    const errors = await externalSourceWebhook(changes)

    expect(errors).toMatchObject([{
      elemID: webhook.elemID,
      severity: 'Error',
      message: 'Webhooks installed by an external app can\'t be removal TODO',
      detailedMessage: 'TODO',
    }])
  })
  it('webhook addition', async () => {
    const changes = [toChange({ after: webhook }), toChange({ after: regularWebhook })]
    const errors = await externalSourceWebhook(changes)

    expect(errors).toMatchObject([{
      elemID: webhook.elemID,
      severity: 'Warning',
      message: 'External app\' webhook installation, it wont be connected to the app',
      detailedMessage: 'TODO',
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
        message: 'external_source field change',
        detailedMessage: 'Cannot set \'external_source\' or \'signing_secret\' on change of a webhook',
      }])
    })
    it('modification of signing_secret', async () => {
      const changedWebhook = webhook.clone()
      changedWebhook.value.signing_secret = 'changed'
      const errors = await externalSourceWebhook([toChange({ before: webhook, after: changedWebhook })])

      expect(errors).toMatchObject([{
        elemID: webhook.elemID,
        severity: 'Error',
        message: 'external_source field change',
        detailedMessage: 'Cannot set \'external_source\' or \'signing_secret\' on change of a webhook',
      }])
    })
    it('deactivation of the webhook', async () => {
      const changedWebhook = webhook.clone()
      changedWebhook.value.status = 'inactive'
      const errors = await externalSourceWebhook([toChange({ before: webhook, after: changedWebhook })])

      expect(errors).toMatchObject([{
        elemID: webhook.elemID,
        severity: 'Warning',
        message: 'External source webhook deactivation',
        detailedMessage: 'If you deactivate this webhook, the app that created it might not work as intended. You\'ll need to reactivate it to use it again.',
      }])
    })
    it('regular change of the webhook', async () => {
      const changedWebhook = webhook.clone()
      changedWebhook.value.name = 'changed'
      const errors = await externalSourceWebhook([toChange({ before: webhook, after: changedWebhook })])

      expect(errors).toMatchObject([{
        elemID: webhook.elemID,
        severity: 'Warning',
        message: 'External source webhook change',
        detailedMessage: 'If you edit this webhook, the app that created it might not work as intended.',
      }])
    })
  })
})
