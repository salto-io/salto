/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  AdapterCreator, BuiltinTypes, ElemID, Field, InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import NetsuiteClient, { Credentials } from './client/client'
import NetsuiteAdapter from './adapter'
import { NETSUITE } from './constants'

const configID = new ElemID(NETSUITE)

const configType = new ObjectType({
  elemID: configID,
  fields: {
    account: new Field(configID, 'account', BuiltinTypes.STRING),
    consumerKey: new Field(configID, 'consumerKey', BuiltinTypes.STRING),
    consumerSecret: new Field(configID, 'consumerSecret', BuiltinTypes.STRING),
    tokenId: new Field(configID, 'tokenId', BuiltinTypes.STRING),
    tokenSecret: new Field(configID, 'tokenSecret', BuiltinTypes.STRING),
  },
  annotationTypes: {},
  annotations: {},
})

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  account: config.value.account,
  consumerKey: config.value.consumerKey,
  consumerSecret: config.value.consumerSecret,
  tokenId: config.value.tokenId,
  tokenSecret: config.value.tokenSecret,
})

const clientFromConfig = (config: InstanceElement): NetsuiteClient =>
  new NetsuiteClient({
    credentials: credentialsFromConfig(config),
  })

export const creator: AdapterCreator = {
  create: ({ config }) => new NetsuiteAdapter({
    client: clientFromConfig(config),
  }),
  validateConfig: config => {
    const credentials = credentialsFromConfig(config)
    return NetsuiteClient.validateCredentials(credentials)
  },
  configType,
}
