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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import { mockClient } from '../utils'
import workflowSchemeFilter from '../../src/filters/workflow_scheme'
import { Filter } from '../../src/filter'
import { DEFAULT_CONFIG } from '../../src/config'
import JiraClient from '../../src/client/client'

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

describe('workflowScheme', () => {
  let workflowSchemeType: ObjectType
  let filter: Filter
  let client: JiraClient
  beforeEach(async () => {
    const { client: cli, paginator } = mockClient()
    client = cli

    filter = workflowSchemeFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    })
    workflowSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'WorkflowScheme'),
    })
  })

  describe('onFetch', () => {
    it('replace field issueTypeMappings with items', async () => {
      workflowSchemeType.fields.issueTypeMappings = new Field(workflowSchemeType, 'issueTypeMappings', BuiltinTypes.STRING)
      await filter.onFetch?.([workflowSchemeType])
      expect(workflowSchemeType.fields.issueTypeMappings).toBeUndefined()
      expect(workflowSchemeType.fields.items).toBeDefined()
      expect(workflowSchemeType.fields.items.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('replace value of issueTypeMappings with items', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          issueTypeMappings: {
            additionalProperties: {
              1234: 'workflow name',
            },
          },
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        items: [
          {
            issueType: '1234',
            workflow: 'workflow name',
          },
        ],
      })
    })

    it('do nothing if there are no issueTypeMappings', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          val: 1,
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        val: 1,
      })
    })
  })

  describe('preDeploy', () => {
    it('add issueTypeMappings to instance', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
        }
      )
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        items: [
          {
            issueType: 1234,
            workflow: 'workflow name',
          },
        ],
        issueTypeMappings: {
          1234: 'workflow name',
        },
      })
    })

    it('should do nothing if there are no items', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          val: 1,
        }
      )
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        val: 1,
      })
    })
  })

  describe('deploy', () => {
    const deployChangeMock = deployment.deployChange as jest.MockedFunction<
        typeof deployment.deployChange
      >
    it('ignore items when deploying', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
        }
      )

      const change = toChange({ after: instance })
      await filter.deploy?.([change])
      expect(deployChangeMock).toHaveBeenCalledWith(
        change,
        client,
        DEFAULT_CONFIG.apiDefinitions.types.WorkflowScheme.deployRequests,
        ['items'],
        undefined
      )
    })
  })

  describe('onDeploy', () => {
    it('should remove issueTypeMappings', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowSchemeType,
        {
          items: [
            {
              issueType: 1234,
              workflow: 'workflow name',
            },
          ],
          issueTypeMappings: {
            1234: 'workflow name',
          },
        }
      )
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        items: [
          {
            issueType: 1234,
            workflow: 'workflow name',
          },
        ],
      })
    })
  })
})
