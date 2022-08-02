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
import { ElemID, InstanceElement, ListType, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig } from '../../../src/config'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import workflowPropertiesFilter from '../../../src/filters/workflow/workflow_properties_filter'
import { mockClient } from '../../utils'

describe('workflowPropertiesFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let workflowType: ObjectType
  let workflowStatusType: ObjectType
  let client: JiraClient
  beforeEach(async () => {
    workflowStatusType = new ObjectType({ elemID: new ElemID(JIRA, 'WorkflowStatus') })
    workflowType = new ObjectType({
      elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
      fields: {
        statuses: { refType: new ListType(workflowStatusType) },
      },
    })

    const { client: cli, paginator } = mockClient()
    client = cli
    filter = workflowPropertiesFilter({
      client,
      paginator,
      config: getDefaultConfig({ isDataCenter: false }),
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as typeof filter
  })

  describe('onFetch', () => {
    it('should set the properties field in WorkflowStatus', async () => {
      const elements = [workflowStatusType]
      await filter.onFetch(elements)
      expect(workflowStatusType.fields.properties).toBeDefined()
      expect(elements).toHaveLength(2)
    })

    it('should replace properties from map to list', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          statuses: [
            {
              properties: {
                a: '1',
                b: '2',
              },
            },
            {
              properties: {
                c: '3',
                d: '4',
              },
            },
          ],
        }
      )
      await filter.onFetch([instance])
      expect(instance.value).toEqual({
        statuses: [
          {
            properties: [
              { key: 'a', value: '1' },
              { key: 'b', value: '2' },
            ],
          },
          {
            properties: [
              { key: 'c', value: '3' },
              { key: 'd', value: '4' },
            ],
          },
        ],
      })
    })
  })

  describe('preDeploy', () => {
    it('should replace properties from list to map', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          statuses: [
            {
              properties: [
                { key: 'a', value: '1' },
                { key: 'b', value: '2' },
              ],
            },
            {
              properties: [
                { key: 'c', value: '3' },
                { key: 'd', value: '4' },
              ],
            },
          ],
        }
      )
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        statuses: [
          {
            properties: {
              a: '1',
              b: '2',
            },
          },
          {
            properties: {
              c: '3',
              d: '4',
            },
          },
        ],
      })
    })
  })

  describe('onDeploy', () => {
    it('should replace properties from map to list', async () => {
      const instance = new InstanceElement(
        'instance',
        workflowType,
        {
          statuses: [
            {
              properties: {
                a: '1',
                b: '2',
              },
            },
            {
              properties: {
                c: '3',
                d: '4',
              },
            },
          ],
        }
      )
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual({
        statuses: [
          {
            properties: [
              { key: 'a', value: '1' },
              { key: 'b', value: '2' },
            ],
          },
          {
            properties: [
              { key: 'c', value: '3' },
              { key: 'd', value: '4' },
            ],
          },
        ],
      })
    })
  })
})
