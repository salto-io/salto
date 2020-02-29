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
  AdapterCreator, BuiltinTypes, ElemID, Field,
  InstanceElement, ObjectType, AdapterCreatorConfig,
} from '@salto-io/adapter-api'
import HubspotClient, { Credentials } from './client/client'
import HubspotAdapter from './adapter'
import { changeValidator } from './change_validator'

const credentialsID = new ElemID('hubspot', 'credentials')
const configID = new ElemID('hubspot', 'config')

export const credentialsType = new ObjectType({
  elemID: credentialsID,
  fields: {
    apiKey: new Field(configID, 'apiKey', BuiltinTypes.STRING),
  },
  annotationTypes: {},
  annotations: {},
})

export const configType = new ObjectType({
  elemID: configID,
  fields: {},
  annotationTypes: {},
  annotations: {},
})

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  apiKey: config.value.apiKey,
})

const clientFromConfig = (config: AdapterCreatorConfig): HubspotClient =>
  new HubspotClient(
    {
      credentials: credentialsFromConfig(config.credentials as InstanceElement),
    }
  )

export const creator: AdapterCreator = {
  create: ({ config }) => new HubspotAdapter({
    client: clientFromConfig(config),
  }),
  validateConfig: config => HubspotClient.validateCredentials(credentialsFromConfig(config)),
  credentialsType,
  configType,
  changeValidator,
}
