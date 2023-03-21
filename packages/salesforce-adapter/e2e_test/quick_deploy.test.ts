/*
*                      Copyright 2023 Salto Labs Ltd.
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
  ChangeGroup, DeployResult,
  StaticFile,
} from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import SalesforceAdapter, { SalesforceClient } from '../index'
import realAdapter, { Reals } from './adapter'
import { API_VERSION } from '../src/client/client'
import { UsernamePasswordCredentials } from '../src/types'
import { testHelpers } from './jest_environment'
import { mockTypes } from '../test/mock_elements'
import { createInstanceElement, MetadataInstanceElement } from '../src/transformers/transformer'
import { removeElement } from './utils'

describe('validation and quick deploy e2e', () => {
  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  let adapterParams: Reals
  let client: SalesforceClient
  let adapter: SalesforceAdapter
  let credLease: CredsLease<UsernamePasswordCredentials>
  let sfResult: DeployResult
  let changeGroup: ChangeGroup
  let quickDeploySpy: jest.SpyInstance
  let apexClassInstance: MetadataInstanceElement
  let apexTestInstance: MetadataInstanceElement

  beforeAll(async () => {
    apexClassInstance = createInstanceElement({ fullName: 'MyApexClass',
      apiVersion: API_VERSION,
      content: new StaticFile({
        filepath: 'MyApexClass.cls',
        content: Buffer.from('public class MyApexClass {\n    public static Integer one(){\n          return 1;\n    }\n}'),
      }) },
    mockTypes.ApexClass)

    apexTestInstance = createInstanceElement({ fullName: 'MyApexTest',
      apiVersion: API_VERSION,
      content: new StaticFile({
        filepath: 'ApexTest.cls',
        content: Buffer.from('@isTest\n private class MyApexTest {\n    @isTest static void inOne() {\n         System.assert(MyApexClass.one() == 1);\n    }\n}'),
      }) },
    mockTypes.ApexClass)

    changeGroup = {
      groupID: 'add test elements',
      changes: [{ action: 'add', data: { after: apexClassInstance } }, { action: 'add', data: { after: apexTestInstance } }],
    }
    const ValidationConfig = {
      client: {
        deploy: {
          runTests: ['myApexTest'],
          testLevel: 'RunSpecifiedTests' as const,
        },
      },
    }

    credLease = await testHelpers().credentials()
    adapterParams = realAdapter({
      credentials: new UsernamePasswordCredentials(credLease.value),
    }, ValidationConfig)
    adapter = adapterParams.adapter

    sfResult = await adapter.validate({ changeGroup })
    const groupResult = sfResult.extraProperties?.groups === undefined ? {} : sfResult.extraProperties?.groups[0]
    const { requestId } = groupResult
    const { hash } = groupResult
    expect(requestId).toBeDefined()
    expect(hash).toBeDefined()
    const quickDeployConfig = {
      client: {
        deploy: {
          quickDeployParams: {
            requestId: requestId ?? '',
            hash: hash ?? '',
          },
        },
      },
    }
    adapterParams = realAdapter({
      credentials: new UsernamePasswordCredentials(credLease.value),
    }, quickDeployConfig)
    adapter = adapterParams.adapter
    client = adapterParams.client
    quickDeploySpy = jest.spyOn(client, 'quickDeploy')
  })

  it('should preform quick deploy with the requestId and hash from the validation', async () => {
    sfResult = await adapter.deploy({ changeGroup })
    expect(sfResult.appliedChanges).toHaveLength(2)
    expect(quickDeploySpy).toHaveBeenCalledTimes(1)
  })

  afterAll(async () => {
    quickDeploySpy.mockClear()
    await removeElement(adapter, apexClassInstance)
    await removeElement(adapter, apexTestInstance)
    if (credLease.return) {
      await credLease.return()
    }
  })
})
