/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { AdditionChange, BuiltinTypes, ElemID, Field, InstanceElement, MapType, ModificationChange, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployment, filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { mockClient } from '../../utils'
import { DEFAULT_CONFIG } from '../../../src/config'
import { JIRA } from '../../../src/constants'
import fieldsDeploymentFilter from '../../../src/filters/fields/fields_deployment'
import JiraClient from '../../../src/client/client'
import { deployContexts } from '../../../src/filters/fields/contexts'


jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

describe('deployContexts', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let fieldType: ObjectType
  let contextType: ObjectType
  let mockConnection: MockInterface<clientUtils.APIConnection>
  const deployChangeMock = deployment.deployChange as jest.MockedFunction<
    typeof deployment.deployChange
  >
  let client: JiraClient
  let paginator: clientUtils.Paginator

  beforeEach(() => {
    deployChangeMock.mockClear()

    const mockCli = mockClient()
    client = mockCli.client
    paginator = mockCli.paginator
    mockConnection = mockCli.connection

    filter = fieldsDeploymentFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, 'CustomFieldContext'),
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, 'Field'),
      fields: {
        contexts: {
          refType: new MapType(contextType),
        },
      },
    })
  })
  it('should call deployChange for all the contexts', async () => {
    const beforeInstance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
        contexts: {
          context1: {
            id: '1',
            name: 'context1',
          },
          context2: {
            id: '2',
            name: 'context2',
          },
        },
      },
    )

    const afterInstance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
        contexts: {
          context1: {
            id: '1',
            name: 'context1',
            description: 'desc',
          },
          context3: {
            id: '3',
            name: 'context3',
          },
        },
      },
    )

    const change = toChange({
      before: beforeInstance,
      after: afterInstance,
    }) as ModificationChange<InstanceElement>
    await deployContexts(change, client, DEFAULT_CONFIG.apiDefinitions)
    expect(deployChangeMock).toHaveBeenCalledWith(
      toChange({
        after: new InstanceElement(
          '3',
          contextType,
          {
            id: '3',
            name: 'context3',
          },
        ),
      }),
      client,
      DEFAULT_CONFIG.apiDefinitions.types.CustomFieldContext.deployRequests,
      [
        'defaultValue',
        'options',
      ],
      { fieldId: 'field_1' },
    )

    expect(deployChangeMock).toHaveBeenCalledWith(
      toChange({
        before: new InstanceElement(
          '2',
          contextType,
          {
            id: '2',
            name: 'context2',
          },
        ),
      }),
      client,
      DEFAULT_CONFIG.apiDefinitions.types.CustomFieldContext.deployRequests,
      [
        'defaultValue',
        'options',
        'issueTypeIds',
        'projectIds',
      ],
      { fieldId: 'field_1' },
    )

    expect(deployChangeMock).toHaveBeenCalledWith(
      toChange({
        before: new InstanceElement(
          '1',
          contextType,
          {
            id: '1',
            name: 'context1',
          },
        ),
        after: new InstanceElement(
          '1',
          contextType,
          {
            id: '1',
            name: 'context1',
            description: 'desc',
          },
        ),
      }),
      client,
      DEFAULT_CONFIG.apiDefinitions.types.CustomFieldContext.deployRequests,
      [
        'defaultValue',
        'options',
        'issueTypeIds',
        'projectIds',
      ],
      { fieldId: 'field_1' },
    )
  })

  it('when the field is new, should remove the default created context', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
        contexts: {
          context1: {
            id: '1',
            name: 'context1',
          },
        },
      },
    )

    mockConnection.get.mockImplementation(async url => ({
      status: 200,
      data: {
        values: url === '/rest/api/3/field/field_1/contexts'
          ? [{ id: '4' }]
          : [],
      },
    }))


    const change = toChange({ after: instance }) as AdditionChange<InstanceElement>
    await deployContexts(change, client, DEFAULT_CONFIG.apiDefinitions)
    expect(deployChangeMock).toHaveBeenCalledWith(
      toChange({
        before: new InstanceElement(
          '4',
          contextType,
          {
            id: '4',
          },
        ),
      }),
      client,
      DEFAULT_CONFIG.apiDefinitions.types.CustomFieldContext.deployRequests,
      [
        'defaultValue',
        'options',
        'issueTypeIds',
        'projectIds',
      ],
      { fieldId: 'field_1' },
    )

    expect(deployChangeMock).toHaveBeenCalledWith(
      toChange({
        after: new InstanceElement(
          '1',
          contextType,
          {
            id: '1',
            name: 'context1',
          },
        ),
      }),
      client,
      DEFAULT_CONFIG.apiDefinitions.types.CustomFieldContext.deployRequests,
      [
        'defaultValue',
        'options',
      ],
      { fieldId: 'field_1' },
    )
  })

  it('should not call deployChange if there are no contexts', async () => {
    const beforeInstance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
      },
    )

    const afterInstance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
      },
    )

    const change = toChange({
      before: beforeInstance,
      after: afterInstance,
    }) as ModificationChange<InstanceElement>
    await deployContexts(change, client, DEFAULT_CONFIG.apiDefinitions)
    expect(deployChangeMock).not.toHaveBeenCalled()
  })

  it('should throw an error when contexts type is not a Map', async () => {
    fieldType.fields.contexts = new Field(fieldType, 'contexts', BuiltinTypes.STRING)
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
      },
    )

    const change = toChange({ after: instance }) as AdditionChange<InstanceElement>
    await expect(deployContexts(change, client, DEFAULT_CONFIG.apiDefinitions)).rejects.toThrow()
    expect(deployChangeMock).not.toHaveBeenCalled()
  })

  it('should throw an error when contexts type inner value is not an object type', async () => {
    fieldType.fields.contexts = new Field(fieldType, 'contexts', new MapType(BuiltinTypes.STRING))
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
      },
    )

    const change = toChange({ after: instance }) as AdditionChange<InstanceElement>
    await expect(deployContexts(change, client, DEFAULT_CONFIG.apiDefinitions)).rejects.toThrow()
    expect(deployChangeMock).not.toHaveBeenCalled()
  })
})
