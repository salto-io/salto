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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { filterUtils } from '@salto-io/adapter-components'
import { mockClient } from '../../utils'
import automationStructureFilter from '../../../src/filters/automation/automation_structure'
import { DEFAULT_CONFIG } from '../../../src/config'
import { AUTOMATION_TYPE, JIRA } from '../../../src/constants'


describe('automationFetchFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let type: ObjectType
  let instance: InstanceElement


  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = automationStructureFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
      elementsSource: buildElementsSourceFromElements([]),
    }) as filterUtils.FilterWith<'onFetch'>

    type = new ObjectType({
      elemID: new ElemID(JIRA, AUTOMATION_TYPE),
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        id: '1',
        trigger: {
          component: 'TRIGGER',
          type: 'jira.issue.event.trigger:created',
        },
        components: [
          {
            id: '2',
            component: 'ACTION',
            value: null,
            created: 1234,
          },
        ],
        projects: [
          {
            projectId: '3',
          },
        ],
      }
    )
  })

  describe('onFetch', () => {
    it('should remove trigger.component', async () => {
      await filter.onFetch([instance])
      expect(instance.value.trigger.component).toBeUndefined()
    })

    it('should remove null values', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[0].value).toBeUndefined()
    })

    it('should remove inner ids', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[0].id).toBeUndefined()
    })

    it('should remove redundant keys', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[0].created).toBeUndefined()
    })

    it('should restructure projects value', async () => {
      await filter.onFetch([instance])
      expect(instance.value.projects).toEqual(['3'])
    })
  })
})
