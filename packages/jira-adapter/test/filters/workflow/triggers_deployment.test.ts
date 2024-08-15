/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AdditionChange, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { deployTriggers } from '../../../src/filters/workflow/triggers_deployment'
import JiraClient from '../../../src/client/client'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { mockClient } from '../../utils'
import { PRIVATE_API_HEADERS } from '../../../src/client/headers'
import { WorkflowV1Instance } from '../../../src/filters/workflow/types'

describe('triggersDeployment', () => {
  let workflowType: ObjectType
  let instance: InstanceElement
  let client: JiraClient
  let mockConnection: MockInterface<clientUtils.APIConnection>
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })
    instance = new InstanceElement('instance', workflowType, {
      name: 'workflowName',
      transitions: {
        'name__From__any_status__Circular@fffssff': {
          id: '1',
          name: 'name',
          rules: {
            triggers: [
              {
                key: 'key',
                configuration: { a: 'b' },
              },
            ],
          },
        },
      },
    })

    const { client: cli, connection } = mockClient()
    client = cli
    mockConnection = connection
  })

  it('should call the deploy triggers endpoint', async () => {
    await deployTriggers(toChange({ after: instance }) as AdditionChange<WorkflowV1Instance>, client)

    expect(mockConnection.put).toHaveBeenCalledWith(
      '/rest/triggers/1.0/workflow/config',
      {
        definitionConfig: { a: 'b' },
        triggerDefinitionKey: 'key',
      },
      {
        headers: PRIVATE_API_HEADERS,
        params: {
          workflowName: 'workflowName',
          actionId: '1',
        },
      },
    )
  })

  it('should throw when workflow does not have a name', async () => {
    delete instance.value.name
    await expect(
      deployTriggers(toChange({ after: instance }) as AdditionChange<WorkflowV1Instance>, client),
    ).rejects.toThrow()
  })
})
