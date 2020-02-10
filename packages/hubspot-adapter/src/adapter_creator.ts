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
  InstanceElement, ObjectType,
} from 'adapter-api'
import HubspotClient, { Credentials } from './client/client'
import HubspotAdapter from './adapter'
import { changeValidator } from './change_validator'

const configID = new ElemID('hubspot')

const configType = new ObjectType({
  elemID: configID,
  fields: {
    apiKey: new Field(configID, 'apiKey', BuiltinTypes.STRING),
  },
  annotationTypes: {},
  annotations: {},
})

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  apiKey: config.value.apiKey,
})

const clientFromConfig = (config: InstanceElement): HubspotClient =>
  new HubspotClient(
    {
      credentials: credentialsFromConfig(config),
    }
  )

export const creator: AdapterCreator = {
  create: ({ config }) => new HubspotAdapter({
    client: clientFromConfig(config),
  }),
  validateConfig: config => {
    const credentials = credentialsFromConfig(config)
    return HubspotClient.validateCredentials(credentials)
  },
  configType,
  changeValidator,
}
