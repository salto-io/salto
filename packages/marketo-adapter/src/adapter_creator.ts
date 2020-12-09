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
  Adapter, BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression,
} from '@salto-io/adapter-api'
import MarketoClient from './client/client'
import MarketoAdapter from './adapter'
import changeValidator from './change_validator'
import { Credentials } from './client/types'

const configID = new ElemID('marketo')

const credentialsType = new ObjectType({
  elemID: configID,
  fields: {
    endpoint: {
      refType: new ReferenceExpression(BuiltinTypes.STRING.elemID, BuiltinTypes.STRING),
    },
    clientId: {
      refType: new ReferenceExpression(BuiltinTypes.STRING.elemID, BuiltinTypes.STRING),
    },
    clientSecret: {
      refType: new ReferenceExpression(BuiltinTypes.STRING.elemID, BuiltinTypes.STRING),
    },
  },
  annotationTypes: {},
  annotations: {},
})

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  endpoint: config.value.endpoint,
  clientId: config.value.clientId,
  clientSecret: config.value.clientSecret,
})

const clientFromCredentials = (credentials: InstanceElement): MarketoClient =>
  new MarketoClient({
    credentials: credentialsFromConfig(credentials),
  })

export const adapter: Adapter = {
  operations: context => new MarketoAdapter({
    client: clientFromCredentials(context.credentials),
  }),
  validateCredentials: config => MarketoClient.validateCredentials(credentialsFromConfig(config)),
  authenticationMethods: {
    basic: {
      credentialsType,
    },
  },
  deployModifiers: {
    changeValidator,
  },
}
