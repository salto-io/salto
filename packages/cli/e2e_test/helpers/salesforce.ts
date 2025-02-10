/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import SalesforceAdapter, {
  SalesforceClient,
  adapter as salesforceAdapter,
  UsernamePasswordCredentials,
  DeployProgressReporter,
} from '@salto-io/salesforce-adapter'
// eslint-disable-next-line no-restricted-imports
import {
  testHelpers as salesforceTestHelpers,
  testTypes as salesforceTestTypes,
} from '@salto-io/salesforce-adapter/dist/e2e_test/jest_environment'
import _ from 'lodash'
import {
  InstanceElement,
  ElemID,
  ObjectType,
  ChangeGroup,
  getChangeData,
  SaltoError,
  SaltoElementError,
  isSaltoElementError,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'

export const naclNameToSFName = (objName: string): string => `${objName}__c`
export const objectExists = async (
  client: SalesforceClient,
  name: string,
  fields: string[] = [],
  missingFields: string[] = [],
): Promise<boolean> => {
  const result = (await client.readMetadata(salesforceTestHelpers().CUSTOM_OBJECT, name))
    .result[0] as salesforceTestTypes.CustomObject
  if (!result || !result.fullName) {
    return false
  }
  let fieldNames: string[] = []
  if (result.fields) {
    fieldNames = _.isArray(result.fields) ? result.fields.map(rf => rf.fullName) : [result.fields.fullName]
  }
  if (fields && !fields.every(f => fieldNames.includes(f))) {
    return false
  }
  return !missingFields || missingFields.every(f => !fieldNames.includes(f))
}

export const instanceExists = async (
  client: SalesforceClient,
  type: string,
  name: string,
  expectedValues?: Record<string, string>,
): Promise<boolean> => {
  const result = (await client.readMetadata(type, name)).result[0]
  if (!result || !result.fullName) {
    return false
  }
  if (expectedValues) {
    return Object.entries(expectedValues).every(entry => _.get(result, entry[0]) === entry[1])
  }
  return true
}

export const getSalesforceCredsInstance = (creds: UsernamePasswordCredentials): InstanceElement => {
  const configValues = {
    username: creds.username,
    password: creds.password,
    token: creds.apiToken ?? '',
    sandbox: creds.isSandbox,
  }
  const { authenticationMethods } = salesforceAdapter

  return new InstanceElement(ElemID.CONFIG_NAME, authenticationMethods.basic.credentialsType, configValues)
}

export const getSalesforceClient = (credentials: UsernamePasswordCredentials): SalesforceClient =>
  new SalesforceClient({
    credentials: new UsernamePasswordCredentials(credentials),
    // Default to purge on delete to avoid leaving definitions in the recycle bin
    config: { deploy: { purgeOnDelete: true } },
  })

const nullProgressReporter: DeployProgressReporter = {
  reportProgress: () => {},
  reportMetadataProgress: () => {},
  reportDataProgress: () => {},
}

const errorToString = (error: SaltoError | SaltoElementError): string =>
  `[${error.severity}] ${error.detailedMessage}${isSaltoElementError(error) ? error.elemID.getFullName() : ''}`

export const addElements = async <T extends InstanceElement | ObjectType>(
  client: SalesforceClient,
  elements: T[],
): Promise<T[]> => {
  const adapter = new SalesforceAdapter({ client, config: {}, elementsSource: buildElementsSourceFromElements([]) })
  const changeGroup: ChangeGroup = {
    groupID: elements[0].elemID.getFullName(),
    changes: elements.map(e => ({ action: 'add', data: { after: e } })),
  }
  const deployResult = await adapter.deploy({ changeGroup, progressReporter: nullProgressReporter })
  if (deployResult.errors.filter(error => error.severity === 'Error').length > 0) {
    throw new Error(`Failed to add elements with: ${deployResult.errors.map(errorToString).join('\n')}`)
  }
  const updatedElements = deployResult.appliedChanges.map(getChangeData)
  return updatedElements as T[]
}

export const removeElements = async <T extends InstanceElement | ObjectType>(
  client: SalesforceClient,
  elements: T[],
): Promise<void> => {
  const adapter = new SalesforceAdapter({ client, config: {}, elementsSource: buildElementsSourceFromElements([]) })
  const changeGroup: ChangeGroup = {
    groupID: elements[0].elemID.getFullName(),
    changes: elements.map(e => ({ action: 'remove', data: { before: e } })),
  }
  const deployResult = await adapter.deploy({ changeGroup, progressReporter: nullProgressReporter })
  if (deployResult.errors.filter(error => error.severity === 'Error').length > 0) {
    throw new Error(`Failed to remove elements with: ${deployResult.errors.map(errorToString).join('\n')}`)
  }
}
