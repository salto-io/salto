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
  Adapter, BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import changeValidator from './change_validator'
import NetsuiteClient, { Credentials } from './client/client'
import NetsuiteAdapter, { NetsuiteConfig } from './adapter'
import { NETSUITE, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST } from './constants'

const log = logger(module)
const { makeArray } = collections.array

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

const configType = new ObjectType({
  elemID: configID,
  fields: {
    [TYPES_TO_SKIP]: {
      type: new ListType(BuiltinTypes.STRING),
    },
    [FILE_PATHS_REGEX_SKIP_LIST]: {
      type: new ListType(BuiltinTypes.STRING),
    },
  },
})

const netsuiteConfigFromConfig = (config: Readonly<InstanceElement> | undefined):
  NetsuiteConfig => {
  const netsuiteConfig = {
    [TYPES_TO_SKIP]: makeArray(config?.value?.[TYPES_TO_SKIP]),
    [FILE_PATHS_REGEX_SKIP_LIST]: makeArray(config?.value?.[FILE_PATHS_REGEX_SKIP_LIST]),
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(netsuiteConfig).includes(k))
    .forEach(k => log.debug('Unknown config property was found: %s', k))
  return netsuiteConfig
}

const netsuiteCredentialsFromCredentials = (credentials: Readonly<InstanceElement>): Credentials =>
  credentials.value as Credentials

const clientFromCredentials = (credentials: InstanceElement): NetsuiteClient =>
  new NetsuiteClient({
    credentials: netsuiteCredentialsFromCredentials(credentials),
  })

export const adapter: Adapter = {
  operations: context => new NetsuiteAdapter({
    client: clientFromCredentials(context.credentials),
    config: netsuiteConfigFromConfig(context.config),
    getElemIdFunc: context.getElemIdFunc,
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
  configType,
  deployModifiers: {
    changeValidator,
  },
}
