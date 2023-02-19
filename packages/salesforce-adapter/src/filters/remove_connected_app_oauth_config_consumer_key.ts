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
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterWith } from '../filter'
import { CONNECTED_APP_METADATA_TYPE } from '../constants'
import { isInstanceOfType } from './utils'

const { awu } = collections.asynciterable

const OAUTH_CONFIG = 'oauthConfig'
const CONSUMER_KEY = 'consumerKey'


type ConnectedAppWithOAuthConfigInstance = InstanceElement & {
  value: InstanceElement['value'] & {
    [OAUTH_CONFIG]: {
      [CONSUMER_KEY]?: string
    }
  }
}


const isConnectedAppWithOAuthConfig = (
  connectedAppInstance: InstanceElement
): connectedAppInstance is ConnectedAppWithOAuthConfigInstance => (
  _.isString(_.get(connectedAppInstance.value, [OAUTH_CONFIG, CONSUMER_KEY]))
)

const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'removeConnectedAppOauthConfigConsumerKey',
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(isInstanceOfType(CONNECTED_APP_METADATA_TYPE))
      .filter(isConnectedAppWithOAuthConfig)
      .forEach(instance => {
        delete instance.value[OAUTH_CONFIG][CONSUMER_KEY]
      })
  },
})

export default filterCreator
