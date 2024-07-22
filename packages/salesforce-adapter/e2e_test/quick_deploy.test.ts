/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { ChangeGroup, StaticFile, toChange } from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import SalesforceAdapter from '../index'
import realAdapter from './adapter'
import { API_VERSION } from '../src/client/client'
import { SalesforceConfig, UsernamePasswordCredentials } from '../src/types'
import { testHelpers } from './jest_environment'
import { mockTypes } from '../test/mock_elements'
import {
  createInstanceElement,
  MetadataInstanceElement,
} from '../src/transformers/transformer'
import { nullProgressReporter } from './utils'

const log = logger(module)

describe('validation and quick deploy e2e', () => {
  // Set long timeout as we communicate with salesforce API
  jest.setTimeout(1000000)

  let adapter: SalesforceAdapter
  let credLease: CredsLease<UsernamePasswordCredentials>
  let changeGroup: ChangeGroup
  let quickDeploySpy: jest.SpyInstance
  let deploySpy: jest.SpyInstance
  let apexClassInstance: MetadataInstanceElement
  let apexTestInstance: MetadataInstanceElement

  beforeAll(async () => {
    log.resetLogCount()
    apexClassInstance = createInstanceElement(
      {
        fullName: 'MyApexClass',
        apiVersion: API_VERSION,
        content: new StaticFile({
          filepath: 'MyApexClass.cls',
          content: Buffer.from(
            'public class MyApexClass {\n    public static Integer one(){\n          return 1;\n    }\n}',
          ),
        }),
      },
      mockTypes.ApexClass,
    )

    apexTestInstance = createInstanceElement(
      {
        fullName: 'MyApexTest',
        apiVersion: API_VERSION,
        content: new StaticFile({
          filepath: 'ApexTest.cls',
          content: Buffer.from(
            '@isTest\n private class MyApexTest {\n    @isTest static void inOne() {\n         System.assert(MyApexClass.one() == 1);\n    }\n}',
          ),
        }),
      },
      mockTypes.ApexClass,
    )

    changeGroup = {
      groupID: 'add test elements',
      changes: [
        toChange({ after: apexClassInstance }),
        toChange({ after: apexTestInstance }),
      ],
    }
    const validationConfig: SalesforceConfig = {
      client: {
        deploy: {
          runTests: ['myApexTest'],
          testLevel: 'RunSpecifiedTests',
        },
      },
    }

    credLease = await testHelpers().credentials()
    const adapterValidation = realAdapter(
      { credentials: new UsernamePasswordCredentials(credLease.value) },
      validationConfig,
    )
    const validationResult = await adapterValidation.adapter.validate({
      changeGroup,
      progressReporter: nullProgressReporter,
    })
    const groupResult = validationResult.extraProperties?.groups?.[0] ?? {}
    const { requestId, hash } = groupResult
    expect(requestId).toBeDefined()
    expect(hash).toBeDefined()
    const quickDeployConfig: SalesforceConfig = {
      client: {
        deploy: {
          quickDeployParams: {
            requestId: requestId ?? '',
            hash: hash ?? '',
          },
        },
      },
    }
    const adapterQuickDeploy = realAdapter(
      { credentials: new UsernamePasswordCredentials(credLease.value) },
      quickDeployConfig,
    )
    adapter = adapterQuickDeploy.adapter

    const { client } = adapterQuickDeploy
    deploySpy = jest.spyOn(client, 'deploy')
    quickDeploySpy = jest.spyOn(client, 'quickDeploy')
  })

  it('should perform quick deploy', async () => {
    const deployResult = await adapter.deploy({
      changeGroup,
      progressReporter: nullProgressReporter,
    })
    expect(deployResult.appliedChanges).toHaveLength(changeGroup.changes.length)
    // Make sure we don't fallback to deploy, and the only deploy call was the validation
    expect(deploySpy).not.toHaveBeenCalled()
    expect(quickDeploySpy).toHaveBeenCalledOnce()
  })

  afterAll(async () => {
    jest.clearAllMocks()
    const adapterDeploy = realAdapter({
      credentials: new UsernamePasswordCredentials(credLease.value),
    })
    try {
      const removeInstances: ChangeGroup = {
        groupID: 'remove test elements',
        changes: [
          toChange({ before: apexClassInstance }),
          toChange({ before: apexTestInstance }),
        ],
      }
      await adapterDeploy.adapter.deploy({
        changeGroup: removeInstances,
        progressReporter: nullProgressReporter,
      })
    } finally {
      if (credLease.return) {
        await credLease.return()
      }
    }
    log.info('quick deploy e2e: Log counts = %o', log.getLogCount())
  })
})
