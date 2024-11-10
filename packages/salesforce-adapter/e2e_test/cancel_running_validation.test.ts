/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { ChangeGroup, DeployResult, StaticFile, toChange } from '@salto-io/adapter-api'
import { UsernamePasswordCredentials } from '../src/types'
import { createInstanceElement, MetadataInstanceElement } from '../src/transformers/transformer'
import { API_VERSION } from '../src/client/client'
import { mockTypes } from '../test/mock_elements'
import { testHelpers } from './jest_environment'
import realAdapter from './adapter'
import { nullProgressReporter } from './utils'

const log = logger(module)

/**
 * In this scenario we run a validation that executes a very long-running test (LongRunningTest).
 * We then run a second validation to cancel the first validation.
 */
describe('Salesforce cancel running validation', () => {
  jest.setTimeout(1000000)
  let credLease: CredsLease<UsernamePasswordCredentials>
  let credentials: UsernamePasswordCredentials
  let apexClassInstance: MetadataInstanceElement
  let longRunningTestInstance: MetadataInstanceElement

  beforeAll(async () => {
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
    longRunningTestInstance = createInstanceElement(
      {
        fullName: 'LongRunningTest',
        apiVersion: API_VERSION,
        content: new StaticFile({
          filepath: 'LongRunningTest.cls',
          content: Buffer.from(
            `@IsTest
public class LongRunningTest {
    @IsTest
    public static void testLongRunningProcess() {
        Test.startTest();
        Integer count = 0;
        // Use a large loop to simulate a delay. Adjust the loop size based on your org's processing speed. mod
        for (Integer i = 0; i < 100000000; i++) {
            count++;
        }
        System.assertEquals(100000000, count);
        // Stop the test context
        Test.stopTest();
    }
}`,
          ),
        }),
      },
      mockTypes.ApexClass,
    )

    credLease = await testHelpers().credentials()
    credentials = new UsernamePasswordCredentials(credLease.value)
    const { adapter } = realAdapter({ credentials }, {})
    // Deploy the LongRunningTest so we can later execute it as part of the validation that will be canceled
    await adapter.deploy({
      changeGroup: {
        groupID: 'Metadata Deploy',
        changes: [toChange({ after: longRunningTestInstance })],
      },
      progressReporter: nullProgressReporter,
    })
  })

  afterAll(async () => {
    jest.clearAllMocks()
    const adapterDeploy = realAdapter({ credentials }, {})
    try {
      const removeInstances: ChangeGroup = {
        groupID: 'remove test elements',
        changes: [toChange({ before: longRunningTestInstance }), toChange({ before: apexClassInstance })],
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

  it('should cancel the previous validation', async () => {
    let secondValidationResultPromise: Promise<DeployResult> | undefined
    const { adapter: firstAdapter } = realAdapter(
      { credentials },
      {
        client: {
          deploy: {
            runTests: ['LongRunningTest'],
            testLevel: 'RunSpecifiedTests',
          },
        },
      },
    )
    const { adapter: secondAdapter } = realAdapter({ credentials }, {})
    const firstValidationResultPromise = firstAdapter.validate({
      changeGroup: {
        groupID: 'Metadata Deploy (First Validation)',
        changes: [toChange({ after: apexClassInstance })],
      },
      progressReporter: {
        ...nullProgressReporter,
        reportDeployOperationInfo: operationInfo => {
          const validationId = operationInfo.serviceDeploymentId as string
          expect(validationId).toBeDefined()
          secondValidationResultPromise = secondAdapter.validate({
            changeGroup: {
              groupID: 'Metadata Deploy (Second Validation)',
              changes: [toChange({ after: apexClassInstance })],
            },
            progressReporter: nullProgressReporter,
            deployRequestsToCancel: [validationId],
          })
        },
      },
    })
    // Wait till the second validation has started
    while (!secondValidationResultPromise) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    const [firstResult, secondResult] = await Promise.all([firstValidationResultPromise, secondValidationResultPromise])
    expect(firstResult.errors).toHaveLength(1)
    expect(firstResult.errors[0].message).toEqual('Validation was canceled.')
    expect(secondResult.errors).toBeEmpty()
  })
})
