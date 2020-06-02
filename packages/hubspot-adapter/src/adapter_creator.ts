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
  AdapterCreator, BuiltinTypes, ElemID, InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import HubspotClient, { Credentials } from './client/client'
import HubspotAdapter from './adapter'
import changeValidator from './change_validator'

const configID = new ElemID('hubspot')

const credentialsType = new ObjectType({
  elemID: configID,
  fields: { apiKey: { type: BuiltinTypes.STRING } },
  annotationTypes: {},
  annotations: {},
})

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  apiKey: config.value.apiKey,
})

const clientFromCredentials = (credentials: InstanceElement): HubspotClient =>
  new HubspotClient({
    credentials: credentialsFromConfig(credentials),
  })

export const creator: AdapterCreator = {
  create: opts => new HubspotAdapter({
    client: clientFromCredentials(opts.credentials),
  }),
  validateCredentials: config => HubspotClient.validateCredentials(credentialsFromConfig(config)),
  credentialsType,
  changeValidator,
}
