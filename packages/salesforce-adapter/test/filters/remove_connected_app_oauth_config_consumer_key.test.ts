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
import { InstanceElement } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/remove_connected_app_oauth_config_consumer_key'
import { mockTypes } from '../mock_elements'

const filter = filterCreator()

describe(filter.name, () => {
  describe('onFetch', () => {
    let connectedAppInstance: InstanceElement

    beforeEach(async () => {
      connectedAppInstance = new InstanceElement(
        'testApp',
        mockTypes.ConnectedApp,
        {
          oauthConfig: {
            consumerKey: 'testKey123435',
          },
        }
      )
      expect(connectedAppInstance.value.oauthConfig.consumerKey).toBeDefined()
      await filter.onFetch([connectedAppInstance])
    })

    it('should remove the consumerKey from the ConnectedApp instance', () => {
      expect(connectedAppInstance.value.oauthConfig.consumerKey).toBeUndefined()
    })
  })
})
