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
import {
  AdditionChange,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  MapType,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { deployment, filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA } from '../../../src/constants'
import fieldsDeploymentFilter from '../../../src/filters/fields/field_deployment_filter'
import JiraClient from '../../../src/client/client'
import * as contexts from '../../../src/filters/fields/contexts'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

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

describe('fields_deployment', () => {
  let filter: filterUtils.FilterWith<'deploy'>
  let fieldType: ObjectType
  let contextType: ObjectType

  const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>
  let client: JiraClient
  let paginator: clientUtils.Paginator
  const deployContextChangeMock = jest.spyOn(contexts, 'deployContextChange')
  let mockConnection: MockInterface<clientUtils.APIConnection>

  beforeEach(() => {
    deployChangeMock.mockClear()
    deployContextChangeMock.mockClear()

    const mockCli = mockClient()
    client = mockCli.client
    paginator = mockCli.paginator
    mockConnection = mockCli.connection

    filter = fieldsDeploymentFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
      fields: {
        contexts: { refType: new ListType(contextType) },
      },
    })
  })
  it('should call deployChange', async () => {
    const instance = new InstanceElement('instance', fieldType, {})

    const change = toChange({ after: instance })
    await filter.deploy([change])
    expect(deployChangeMock).toHaveBeenCalledWith({
      change,
      client,
      endpointDetails: getDefaultConfig({ isDataCenter: false }).apiDefinitions.types.Field.deployRequests,
      fieldsToIgnore: ['contexts'],
    })
  })

  it('if an addition should remove default context', async () => {
    const instance = new InstanceElement('instance', fieldType, {
      id: 'field_1',
    })

    mockConnection.get.mockImplementation(async url => ({
      status: 200,
      data: {
        values: url === '/rest/api/3/field/field_1/context' ? [{ id: '4' }] : [],
      },
    }))

    const change = toChange({ after: instance })

    await filter.deploy([change])

    expect(deployContextChangeMock).toHaveBeenCalledWith(
      toChange({
        before: new InstanceElement(
          '4',
          contextType,
          {
            id: '4',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(instance.elemID, instance)],
          },
        ),
      }),
      client,
      getDefaultConfig({ isDataCenter: false }).apiDefinitions,
    )
  })

  it('should throw if contexts is not a map', async () => {
    fieldType.fields.contexts = new Field(fieldType, 'contexts', BuiltinTypes.STRING)

    const instance = new InstanceElement('instance', fieldType, {
      id: 'field_1',
    })

    mockConnection.get.mockImplementation(async url => ({
      status: 200,
      data: {
        values: url === '/rest/api/3/field/field_1/contexts' ? [{ id: '4' }] : [],
      },
    }))

    const change = toChange({ after: instance })

    const res = await filter.deploy([change])
    expect(res.deployResult.errors).toHaveLength(1)
  })

  it('should throw if contexts inner type is not an object type', async () => {
    fieldType.fields.contexts = new Field(fieldType, 'contexts', new MapType(BuiltinTypes.STRING))

    const instance = new InstanceElement('instance', fieldType, {
      id: 'field_1',
    })

    mockConnection.get.mockImplementation(async url => ({
      status: 200,
      data: {
        values: url === '/rest/api/3/field/field_1/contexts' ? [{ id: '4' }] : [],
      },
    }))

    const change = toChange({ after: instance })

    const res = await filter.deploy([change])
    expect(res.deployResult.errors).toHaveLength(1)
  })
  describe('deploy jsm locked fields', () => {
    let filedInstance: InstanceElement
    beforeEach(() => {
      const mockCli = mockClient()
      client = mockCli.client
      paginator = mockCli.paginator
      mockConnection = mockCli.connection
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          startAt: 0,
          total: 1,
          values: [
            {
              id: 'myfield',
              name: 'myField',
              isLocked: true,
            },
          ],
        },
      })
      filedInstance = new InstanceElement('instance', fieldType, {
        name: 'myField',
        isLocked: true,
      })
      filter = fieldsDeploymentFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as typeof filter
    })
    it('should deploy jsm locked field if it auto-created in the service', async () => {
      const change = toChange({ after: filedInstance }) as AdditionChange<InstanceElement>
      const res = await filter.deploy([change])
      expect(deployChangeMock).toHaveBeenCalledTimes(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(change.data.after.value.id).toEqual('myfield')
    })
    it('should return error if jsm locked field is not auto-created in the service', async () => {
      filedInstance = new InstanceElement('instance', fieldType, {
        name: 'myField2',
        isLocked: true,
      })
      const change = toChange({ after: filedInstance }) as AdditionChange<InstanceElement>
      const res = await filter.deploy([change])
      expect(deployChangeMock).toHaveBeenCalledTimes(0)
      expect(res.deployResult.errors).toHaveLength(1)
    })
  })
})
