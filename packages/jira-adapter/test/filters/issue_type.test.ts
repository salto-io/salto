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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ISSUE_TYPE_NAME, JIRA } from '../../src/constants'
import { getFilterParams, mockClient } from '../utils'
import issueTypeFilter from '../../src/filters/issue_type'
import { Filter } from '../../src/filter'
import JiraClient from '../../src/client/client'

describe('issueTypeFilter', () => {
  let instance: InstanceElement
  let filter: Filter
  let client: JiraClient
  beforeEach(async () => {
    const { client: cli, paginator } = mockClient(true)
    client = cli

    filter = issueTypeFilter(getFilterParams({
      client,
      paginator,
    }))
    const issueType = new ObjectType({
      elemID: new ElemID(JIRA, ISSUE_TYPE_NAME),
      fields: {
        issueTypeId: { refType: BuiltinTypes.STRING },
        screenSchemeId: { refType: BuiltinTypes.STRING },
      },
    })
    instance = new InstanceElement(
      'instance',
      issueType,
      {
        subtask: true,
      },
    )
  })

  describe('onFetch', () => {
    it('should convert sub task to the right hierarchy', async () => {
      await filter.onFetch?.([instance])
      expect(instance.value.hierarchyLevel).toBe(-1)
      expect(instance.value.subtask).toBeUndefined()
    })

    it('should convert task to the right hierarchy', async () => {
      instance.value.subtask = false
      await filter.onFetch?.([instance])
      expect(instance.value.hierarchyLevel).toBe(0)
      expect(instance.value.subtask).toBeUndefined()
    })

    it('when cloud should only delete subtask', async () => {
      const { client: cli, paginator } = mockClient(false)
      client = cli

      filter = issueTypeFilter(getFilterParams({
        client,
        paginator,
      }))
      await filter.onFetch?.([instance])
      expect(instance.value.hierarchyLevel).toBeUndefined()
      expect(instance.value.subtask).toBeUndefined()
    })
  })

  describe('preDeploy', () => {
    it('should convert subtask hierarchy level to type', async () => {
      instance.value = {
        hierarchyLevel: -1,
      }
      await filter.preDeploy?.([
        toChange({ after: instance }),
      ])
      expect(instance.value).toEqual({
        type: 'subtask',
      })
    })

    it('should convert task hierarchy level to type', async () => {
      instance.value = {
        hierarchyLevel: 0,
      }
      await filter.preDeploy?.([
        toChange({ after: instance }),
      ])
      expect(instance.value).toEqual({
        type: 'standard',
      })
    })

    it('should do nothing if cloud', async () => {
      const { client: cli, paginator } = mockClient(false)
      client = cli

      filter = issueTypeFilter(getFilterParams({
        client,
        paginator,
      }))
      instance.value = {
        hierarchyLevel: 0,
      }
      await filter.preDeploy?.([
        toChange({ after: instance }),
      ])
      expect(instance.value).toEqual({
        hierarchyLevel: 0,
      })
    })
  })

  describe('onDeploy', () => {
    it('should convert subtask type to hierarchy level', async () => {
      instance.value = {
        type: 'subtask',
      }
      await filter.onDeploy?.([
        toChange({ after: instance }),
      ])
      expect(instance.value).toEqual({
        hierarchyLevel: -1,
      })
    })

    it('should convert task type to hierarchy level', async () => {
      instance.value = {
        type: 'standard',
      }
      await filter.onDeploy?.([
        toChange({ after: instance }),
      ])
      expect(instance.value).toEqual({
        hierarchyLevel: 0,
      })
    })

    it('should do nothing if cloud', async () => {
      const { client: cli, paginator } = mockClient(false)
      client = cli

      filter = issueTypeFilter(getFilterParams({
        client,
        paginator,
      }))
      instance.value = {
        type: 'standard',
      }
      await filter.onDeploy?.([
        toChange({ after: instance }),
      ])
      expect(instance.value).toEqual({
        type: 'standard',
      })
    })
  })
})
