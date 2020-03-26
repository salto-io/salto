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
  AdapterCreator, ElemID, InstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import NetsuiteClient, { Credentials } from './client/client'
import NetsuiteAdapter from './adapter'
import { NETSUITE } from './constants'

const configID = new ElemID(NETSUITE)

const credentialsType = new ObjectType({
  elemID: configID,
  fields: {},
  annotationTypes: {},
  annotations: {},
})

const netsuiteCredentialsFromCredentials = (credentials: Readonly<InstanceElement>): Credentials =>
  credentials.value as Credentials

const clientFromCredentials = (credentials: InstanceElement): NetsuiteClient =>
  new NetsuiteClient({
    credentials: netsuiteCredentialsFromCredentials(credentials),
  })

export const creator: AdapterCreator = {
  create: opts => new NetsuiteAdapter({
    client: clientFromCredentials(opts.credentials),
  }),
  validateConfig: config => {
    const credentials = netsuiteCredentialsFromCredentials(config)
    return NetsuiteClient.validateCredentials(credentials)
  },
  credentialsType,
}
