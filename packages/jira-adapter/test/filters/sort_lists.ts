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
import { ElemID, InstanceElement, ObjectType, toChange, Values } from '@salto-io/adapter-api'
import { mockClient } from '../utils'
import sortListsFilter from '../../src/filters/sort_lists'
import { Filter } from '../../src/filter'
import { DEFAULT_CONFIG } from '../../src/config'
import { JIRA } from '../../src/constants'

describe('sortListsFilter', () => {
  let filter: Filter
  let type: ObjectType
  let instance: InstanceElement
  let sortedValues: Values
  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = sortListsFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'type'),
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        permissions: [
          {
            permission: 'A',
          },
          {
            permission: 'C',
          },
          {
            permission: 'B',
          },
        ],
      }
    )

    sortedValues = {
      permissions: [
        {
          permission: 'A',
        },
        {
          permission: 'C',
        },
        {
          permission: 'B',
        },
      ],
    }
  })

  describe('onFetch', () => {
    it('should sort the permissions', async () => {
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual(sortedValues)
    })
  })

  describe('onDeploy', () => {
    it('should sort the permissions', async () => {
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value).toEqual(sortedValues)
    })
  })
})
