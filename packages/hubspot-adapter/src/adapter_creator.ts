/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Adapter, BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import HubspotClient, { Credentials } from './client/client'
import HubspotAdapter from './adapter'

const configID = new ElemID('hubspot')

export const defaultCredentialsType = new ObjectType({
  elemID: configID,
  fields: { apiKey: { refType: BuiltinTypes.STRING } },
  annotationRefsOrTypes: {},
  annotations: {},
})

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  apiKey: config.value.apiKey,
})

const clientFromCredentials = (credentials: InstanceElement): HubspotClient =>
  new HubspotClient({
    credentials: credentialsFromConfig(credentials),
  })

export const adapter: Adapter = {
  operations: context => new HubspotAdapter({
    client: clientFromCredentials(context.credentials),
  }),
  validateCredentials: config => HubspotClient.validateCredentials(credentialsFromConfig(config)),
  authenticationMethods: {
    basic: {
      credentialsType: defaultCredentialsType,
    },
  },
}
