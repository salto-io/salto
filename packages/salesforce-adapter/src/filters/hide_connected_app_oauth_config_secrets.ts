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
import { CORE_ANNOTATIONS, Element, Field, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { FilterWith } from '../filter'
import { CONNECTED_APP_OAUTH_CONFIG_METADATA_TYPE, METADATA_TYPE } from '../constants'

const { isDefined } = values

const CONSUMER_KEY = 'consumerKey'
const CONSUMER_SECRET = 'consumerSecret'


type ConnectedAppOauthConfig = ObjectType & {
  fields: ObjectType['fields'] & {
    [CONSUMER_KEY]: Field
    [CONSUMER_SECRET]: Field
  }
}


const isConnectedAppOauthConfigType = (objectType: ObjectType): objectType is ConnectedAppOauthConfig => (
  objectType.annotations[METADATA_TYPE] === CONNECTED_APP_OAUTH_CONFIG_METADATA_TYPE
  && isDefined(objectType.fields[CONSUMER_KEY])
  && isDefined(objectType.fields[CONSUMER_SECRET])
)

const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'hideConnectedAppOauthConfigSecrets',
  onFetch: async (elements: Element[]) => {
    const connectedAppOauthConfigType = elements
      .filter(isObjectType)
      .find(isConnectedAppOauthConfigType)
    if (connectedAppOauthConfigType === undefined) {
      return
    }
    connectedAppOauthConfigType.fields[CONSUMER_KEY].annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
    connectedAppOauthConfigType.fields[CONSUMER_SECRET].annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
  },
})

export default filterCreator
