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
  Adapter, BuiltinTypes, ElemID, InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import changeValidator from './change_validator'
import NetsuiteClient, { Credentials } from './client/client'
import NetsuiteAdapter from './adapter'
import { NETSUITE } from './constants'


const configID = new ElemID(NETSUITE)

const credentialsType = new ObjectType({
  elemID: configID,
  fields: {
    accountId: { type: BuiltinTypes.STRING },
    tokenId: { type: BuiltinTypes.STRING },
    tokenSecret: { type: BuiltinTypes.STRING },
  },
  annotationTypes: {},
  annotations: {},
})

const netsuiteCredentialsFromCredentials = (credentials: Readonly<InstanceElement>): Credentials =>
  credentials.value as Credentials

const clientFromCredentials = (credentials: InstanceElement): NetsuiteClient =>
  new NetsuiteClient({
    credentials: netsuiteCredentialsFromCredentials(credentials),
  })

export const adapter: Adapter = {
  operations: context => new NetsuiteAdapter({
    client: clientFromCredentials(context.credentials),
  }),
  validateCredentials: async config => {
    try {
      // eslint-disable-next-line global-require,import/no-extraneous-dependencies
      require('@salto-io/suitecloud-cli')
    } catch (e) {
      // TODO: this is a temp solution as we can't distribute salto with suitecloud-cli
      throw new Error('Failed to load Netsuite adapter as @salto-io/suitecloud-cli dependency is missing')
    }
    const credentials = netsuiteCredentialsFromCredentials(config)
    return NetsuiteClient.validateCredentials(credentials)
  },
  credentialsType,
  deployModifiers: {
    changeValidator,
  },
}
