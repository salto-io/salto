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
import SalesforceAdapter, {
  SalesforceClient,
  testHelpers as salesforceTestHelpers,
  testTypes as salesforceTestTypes,
  adapter as salesforceAdapter,
  Credentials,
} from '@salto-io/salesforce-adapter'
import _ from 'lodash'
import { InstanceElement, ElemID, ObjectType, ChangeGroup, getChangeElement } from '@salto-io/adapter-api'

export const naclNameToSFName = (objName: string): string => `${objName}__c`
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
  const { credentialsType } = salesforceAdapter

  return new InstanceElement(
    ElemID.CONFIG_NAME,
    credentialsType,
    configValues,
  )
}

export const addElements = async <T extends InstanceElement | ObjectType>(
  client: SalesforceClient,
  elements: T[]
): Promise<T[]> => {
  const adapter = new SalesforceAdapter({ client, config: {} })
  const changeGroup: ChangeGroup = {
    groupID: elements[0].elemID.getFullName(),
    changes: elements.map(e => ({ action: 'add', data: { after: e } })),
  }
  const deployResult = await adapter.deploy(changeGroup)
  if (deployResult.errors.length > 0) {
    throw new Error(`Failed to remove elements with: ${deployResult.errors.join('\n')}`)
  }
  const updatedElements = deployResult.appliedChanges.map(getChangeElement)
  return updatedElements as T[]
}

export const removeElements = async <T extends InstanceElement | ObjectType>(
  client: SalesforceClient,
  elements: T[]
): Promise<void> => {
  const adapter = new SalesforceAdapter({ client, config: {} })
  const changeGroup: ChangeGroup = {
    groupID: elements[0].elemID.getFullName(),
    changes: elements.map(e => ({ action: 'remove', data: { before: e } })),
  }
  const deployResult = await adapter.deploy(changeGroup)
  if (deployResult.errors.length > 0) {
    throw new Error(`Failed to remove elements with: ${deployResult.errors.join('\n')}`)
  }
}
