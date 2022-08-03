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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { mockClient } from '../../utils'
import statusDeploymentFilter from '../../../src/filters/statuses/status_deployment'
import { Filter } from '../../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, STATUS_TYPE_NAME } from '../../../src/constants'
import { deployWithJspEndpoints } from '../../../src/deployment/jsp_deployment'
import JiraClient from '../../../src/client/client'

jest.mock('../../../src/deployment/jsp_deployment', () => ({
  ...jest.requireActual<{}>('../../../src/deployment/jsp_deployment'),
  deployWithJspEndpoints: jest.fn(),
}))

describe('statusDeploymentFilter', () => {
  let filter: Filter
  let type: ObjectType
  let config: JiraConfig
  let client: JiraClient

  beforeEach(async () => {
    const { client: cli, paginator } = mockClient()
    client = cli

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = statusDeploymentFilter({
      client,
      paginator,
      config,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, STATUS_TYPE_NAME),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        iconUrl: { refType: BuiltinTypes.STRING },
        statusCategory: { refType: BuiltinTypes.STRING },
      },
    })
  })

  describe('onFetch', () => {
    it('should replace status category with id', async () => {
      const instances = [new InstanceElement(
        'instance',
        type,
        { statusCategory: 'TODO' }
      ),
      new InstanceElement(
        'instance',
        type,
        { statusCategory: 'IN_PROGRESS' }
      ),
      new InstanceElement(
        'instance',
        type,
        { statusCategory: 'DONE' }
      )]

      await filter.onFetch?.([...instances, type])
      expect(instances[0].value).toEqual({
        statusCategory: 2,
      })
      expect(instances[1].value).toEqual({
        statusCategory: 4,
      })
      expect(instances[2].value).toEqual({
        statusCategory: 3,
      })
    })

    it('should do nothing if the status category is different', async () => {
      const instance = new InstanceElement(
        'instance',
        type,
        {
          statusCategory: 'NEW',
        },
      )
      await filter.onFetch?.([instance, type])
      expect(instance.value.statusCategory).toEqual('NEW')
    })

    it('should add deployment annotations', async () => {
      await filter.onFetch?.([type])
      expect(type.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      })

      expect(type.fields.id.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(type.fields.name.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(type.fields.description.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(type.fields.statusCategory.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should do nothing when usePrivateAPI config is off', async () => {
      config.client.usePrivateAPI = false

      await filter.onFetch?.([type])

      expect(type.annotations).toEqual({})
      expect(type.fields.id.annotations).toEqual({})
      expect(type.fields.name.annotations).toEqual({})
      expect(type.fields.description.annotations).toEqual({})
      expect(type.fields.iconUrl.annotations).toEqual({})
      expect(type.fields.statusCategory.annotations).toEqual({})
    })
  })

  describe('deploy', () => {
    let deployWithJspEndpointsMock: jest.MockedFunction<typeof deployWithJspEndpoints>
    beforeEach(() => {
      deployWithJspEndpointsMock = deployWithJspEndpoints as jest.MockedFunction<
        typeof deployWithJspEndpoints
      >
    })

    it('should call deployWithJspEndpoints', async () => {
      const instance = new InstanceElement(
        'instance',
        type,
      )
      await filter.deploy?.([toChange({ after: instance })])

      expect(deployWithJspEndpointsMock).toHaveBeenCalledWith({
        changes: [toChange({ after: instance })],
        client,
        urls: {
          add: '/secure/admin/AddStatus.jspa',
          modify: '/secure/admin/EditStatus.jspa',
          remove: '/secure/admin/DeleteStatus.jspa',
          query: '/rest/workflowDesigner/1.0/statuses',
        },
        serviceValuesTransformer: expect.toBeFunction(),
      })
    })

    it('should throw if there are no jsp urls', async () => {
      const instance = new InstanceElement(
        'instance',
        type,
      )

      delete config.apiDefinitions.types[STATUS_TYPE_NAME].jspRequests

      await expect(filter.deploy?.([toChange({ after: instance })])).rejects.toThrow()
    })

    it('should throw if there is no type definition', async () => {
      const instance = new InstanceElement(
        'instance',
        type,
      )

      delete config.apiDefinitions.types[STATUS_TYPE_NAME]

      await expect(filter.deploy?.([toChange({ after: instance })])).rejects.toThrow()
    })
  })
})
