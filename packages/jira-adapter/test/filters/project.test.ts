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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import projectFilter from '../../src/filters/project'
import { mockClient, getDefaultAdapterConfig } from '../utils'

describe('projectFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let instance: InstanceElement
  beforeEach(async () => {
    const { client, paginator } = mockClient()
    filter = projectFilter({
      client,
      paginator,
      config: await getDefaultAdapterConfig(),
    }) as typeof filter

    const type = new ObjectType({ elemID: new ElemID(JIRA, 'Project') })

    instance = new InstanceElement(
      'instance',
      type,
    )
  })

  describe('onFetch', () => {
    beforeEach(async () => {
      instance.value = {
        lead: {
          accountId: '1',
        },
        workflowScheme: {
          workflowScheme: {
            id: 2,
          },
        },
        issueTypeScreenScheme: {
          issueTypeScreenScheme: {
            id: '3',
          },
        },
        fieldConfigurationScheme: {
          fieldConfigurationScheme: {
            id: '4',
          },
        },
        notificationScheme: {
          id: 5,
        },
        permissionScheme: {
          id: 6,
        },
      }
      await filter.onFetch([instance])
    })

    it('should set the leadAccountId', async () => {
      expect(instance.value.leadAccountId).toEqual('1')
    })

    it('should set the schemas ids', async () => {
      expect(instance.value.workflowScheme).toEqual('2')
      expect(instance.value.issueTypeScreenScheme).toEqual('3')
      expect(instance.value.fieldConfigurationScheme).toEqual('4')
      expect(instance.value.notificationScheme).toEqual('5')
      expect(instance.value.permissionScheme).toEqual('6')
    })

    it('For impartial instance should set undefined', async () => {
      instance.value = {
      }
      await filter.onFetch([instance])
      expect(instance.value).toEqual({})
    })
  })

  describe('onDeploy', () => {
    beforeEach(async () => {
      instance.value.id = 1
      await filter.onDeploy([toChange({ after: instance })])
    })

    it('should convert the id to string', async () => {
      expect(instance.value.id).toEqual('1')
    })
  })
})
