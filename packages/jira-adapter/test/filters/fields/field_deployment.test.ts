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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, MapType, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { deployment, filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { mockClient } from '../../utils'
import { DEFAULT_CONFIG } from '../../../src/config'
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

  const deployChangeMock = deployment.deployChange as jest.MockedFunction<
    typeof deployment.deployChange
  >
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

    filter = fieldsDeploymentFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    }) as typeof filter

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
      fields: {
        contexts: { refType: new MapType(contextType) },
      },
    })
  })
  it('should call deployChange', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {},
    )

    const change = toChange({ after: instance })
    await filter.deploy([change])
    expect(deployChangeMock).toHaveBeenCalledWith(
      change,
      client,
      DEFAULT_CONFIG.apiDefinitions.types.Field.deployRequests,
      [],
      undefined,
    )
  })

  it('if an addition should remove default context', async () => {
    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
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
          }
        ),
      }),
      client,
      DEFAULT_CONFIG.apiDefinitions,
    )
  })

  it('should throw if contexts is not a map', async () => {
    fieldType.fields.contexts = new Field(fieldType, 'contexts', BuiltinTypes.STRING)

    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
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


    const change = toChange({ after: instance })

    const res = await filter.deploy([change])
    expect(res.deployResult.errors).toHaveLength(1)
  })

  it('should throw if contexts inner type is not an object type', async () => {
    fieldType.fields.contexts = new Field(fieldType, 'contexts', new MapType(BuiltinTypes.STRING))

    const instance = new InstanceElement(
      'instance',
      fieldType,
      {
        id: 'field_1',
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


    const change = toChange({ after: instance })

    const res = await filter.deploy([change])
    expect(res.deployResult.errors).toHaveLength(1)
  })
})
