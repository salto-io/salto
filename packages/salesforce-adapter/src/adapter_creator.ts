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
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  BuiltinTypes, ObjectType, ElemID, InstanceElement, Field, AdapterCreator,
} from '@salto-io/adapter-api'
import SalesforceClient, { Credentials, validateCredentials } from './client/client'
import { changeValidator } from './change_validator'
import { dependencyChanger } from './dependency_changer'
import SalesforceAdapter, { SalesforceConfig } from './adapter'

const { makeArray } = collections.array
const log = logger(module)

const configID = new ElemID('salesforce')

const credentialsType = new ObjectType({
  elemID: configID,
  fields: {
    username: new Field(configID, 'username', BuiltinTypes.STRING),
    password: new Field(configID, 'password', BuiltinTypes.STRING),
    token: new Field(configID, 'token', BuiltinTypes.STRING,
      { message: 'Token (empty if your org uses IP whitelisting)' }),
    sandbox: new Field(configID, 'sandbox', BuiltinTypes.BOOLEAN),
  },
})

const configType = new ObjectType({
  elemID: configID,
  fields: {
    metadataTypesBlacklist: new Field(
      configID, 'metadataTypesBlacklist', BuiltinTypes.STRING, {}, true,
    ),
    instancesRegexBlacklist: new Field(
      configID, 'instancesRegexBlacklist', BuiltinTypes.STRING, {}, true,
    ),
  },
})

const defaultConfig = new InstanceElement(
  ElemID.CONFIG_NAME,
  configType,
  {
    metadataTypesBlacklist: [],
    instancesRegexBlacklist: ['CustomObject.InvoiceLine$'],
  },
)

const credentialsFromConfig = (config: Readonly<InstanceElement>): Credentials => ({
  username: config.value.username,
  password: config.value.password,
  apiToken: config.value.token,
  isSandbox: config.value.sandbox,
})

const adapterConfigFromConfig = (config: Readonly<InstanceElement> | undefined):
SalesforceConfig => {
  const adapterConfig = {
    metadataTypesBlacklist: makeArray(config?.value?.metadataTypesBlacklist),
    instancesRegexBlacklist: makeArray(config?.value?.instancesRegexBlacklist),
  }
  Object.keys(config?.value ?? {})
    .filter(k => !Object.keys(adapterConfig).includes(k))
    .forEach(k => log.debug('Unknon config property was found: %s', k))
  return adapterConfig
}

const clientFromCredentials = (credentials: InstanceElement): SalesforceClient =>
  new SalesforceClient({ credentials: credentialsFromConfig(credentials) })

export const creator: AdapterCreator = {
  create: opts => new SalesforceAdapter({
    client: clientFromCredentials(opts.credentials),
    config: adapterConfigFromConfig(opts.config),
    getElemIdFunc: opts.getElemIdFunc,
  }),
  validateConfig: config => validateCredentials(credentialsFromConfig(config)),
  credentialsType,
  configType,
  defaultConfig,
  changeValidator,
  dependencyChanger,
}
