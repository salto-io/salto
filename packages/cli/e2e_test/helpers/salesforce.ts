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
  SalesforceClient,
  testHelpers as salesforceTestHelpers,
  testTypes as salesforceTestTypes,
  creator as salesforceAdapterCreator,
  Credentials,
} from '@salto-io/salesforce-adapter'
import _ from 'lodash'
import { InstanceElement, ElemID } from '@salto-io/adapter-api'

export const objectExists = async (client: SalesforceClient, name: string, fields: string[] = [],
  missingFields: string[] = []): Promise<boolean> => {
  const result = (
    (await client.readMetadata(salesforceTestHelpers().CUSTOM_OBJECT, name)).result
  )[0] as salesforceTestTypes.CustomObject
  if (!result || !result.fullName) {
    return false
  }
  let fieldNames: string[] = []
  if (result.fields) {
    fieldNames = _.isArray(result.fields) ? result.fields.map(rf => rf.fullName)
      : [result.fields.fullName]
  }
  if (fields && !fields.every(f => fieldNames.includes(f))) {
    return false
  }
  return (!missingFields || missingFields.every(f => !fieldNames.includes(f)))
}

export const instanceExists = async (client: SalesforceClient, type: string, name: string,
  expectedValues?: Record<string, string>): Promise<boolean> => {
  const result = (await client.readMetadata(type, name)).result[0]
  if (!result || !result.fullName) {
    return false
  }
  if (expectedValues) {
    return Object.entries(expectedValues).every(entry => _.get(result, entry[0]) === entry[1])
  }
  return true
}

export const getSalesforceCredsInstance = (creds: Credentials): InstanceElement => {
  const configValues = {
    username: creds.username,
    password: creds.password,
    token: creds.apiToken ?? '',
    sandbox: creds.isSandbox,
  }
  const { credentialsType } = salesforceAdapterCreator

  return new InstanceElement(
    ElemID.CONFIG_NAME,
    credentialsType,
    configValues,
  )
}
