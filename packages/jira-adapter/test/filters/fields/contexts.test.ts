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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { deployment, filterUtils, client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements, resolveChangeElement } from '@salto-io/adapter-utils'
import { mockClient } from '../../utils'
import { DEFAULT_CONFIG } from '../../../src/config'
import { JIRA } from '../../../src/constants'
import fieldsDeploymentFilter from '../../../src/filters/fields/field_deployment_filter'
import JiraClient from '../../../src/client/client'
import { deployContextChange } from '../../../src/filters/fields/contexts'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { getLookUpName } from '../../../src/reference_mapping'

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

describe('deployContextChange', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let contextType: ObjectType
  let parentField: InstanceElement

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

    filter = fieldsDeploymentFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as typeof filter

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    parentField = new InstanceElement(
      'parentField',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
      {
        id: '2',
      }
    )
  })
  it('should call deployChange', async () => {
    const beforeInstance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      }
    )

    const afterInstance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
        description: 'desc',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      }
    )

    const change = toChange({
      before: beforeInstance,
      after: afterInstance,
    })
    await deployContextChange(change, client, DEFAULT_CONFIG.apiDefinitions)

    expect(deployChangeMock).toHaveBeenCalledWith(
      await resolveChangeElement(change, getLookUpName),
      client,
      DEFAULT_CONFIG.apiDefinitions.types.CustomFieldContext.deployRequests,
      [
        'defaultValue',
        'options',
        'issueTypeIds',
        'projectIds',
      ],
      undefined,
      undefined,
    )
  })

  it('should not throw if deploy failed because the field was deleted', async () => {
    const beforeInstance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      }
    )

    deployChangeMock.mockImplementation(async () => {
      throw new clientUtils.HTTPError('message', {
        status: 404,
        data: {},
      })
    })

    const change = toChange({
      before: beforeInstance,
    })
    await deployContextChange(change, client, DEFAULT_CONFIG.apiDefinitions)
  })

  it('should throw for other error messages', async () => {
    const beforeInstance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      }
    )

    deployChangeMock.mockImplementation(async () => {
      throw new clientUtils.HTTPError('message', {
        status: 500,
        data: {},
      })
    })

    const change = toChange({
      before: beforeInstance,
    })
    await expect(deployContextChange(change, client, DEFAULT_CONFIG.apiDefinitions))
      .rejects.toThrow()
  })

  it('should throw if not removal', async () => {
    const instance = new InstanceElement(
      'instance',
      contextType,
      {
        id: '1',
        name: 'context1',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      }
    )

    deployChangeMock.mockImplementation(async () => {
      throw new clientUtils.HTTPError('message', {
        status: 404,
        data: {
          errorMessages: ['The custom field was not found.'],
        },
      })
    })

    const change = toChange({
      before: instance,
      after: instance,
    })
    await expect(deployContextChange(change, client, DEFAULT_CONFIG.apiDefinitions))
      .rejects.toThrow()
  })
})
