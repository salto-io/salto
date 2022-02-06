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
import _ from 'lodash'
import { mockClient } from '../utils'
import duplicateIdsFilter from '../../src/filters/duplicate_ids'
import { Filter } from '../../src/filter'
import { DEFAULT_CONFIG, JiraConfig } from '../../src/config'
import { ISSUE_TYPE_NAME, JIRA } from '../../src/constants'

describe('duplicateIdsFilter', () => {
  let filter: Filter
  let type: ObjectType
  let config: JiraConfig
  beforeEach(async () => {
    const { client, paginator } = mockClient()

    config = _.cloneDeep(DEFAULT_CONFIG)
    config.fetch.typesToFallbackToInternalId = [ISSUE_TYPE_NAME]

    filter = duplicateIdsFilter({
      client,
      paginator,
      config,
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, ISSUE_TYPE_NAME),
    })
  })

  describe('onFetch', () => {
    it('should add id to duplicate instances name', async () => {
      const dup1 = new InstanceElement(
        'dup',
        type,
        {
          id: '1',
          name: 'dup',
        }
      )
      const dup2 = new InstanceElement(
        'dup',
        type,
        {
          id: '2',
        }
      )

      const notDup = new InstanceElement(
        'notDup',
        type,
        {
          id: '1',
          name: 'notDup',
        }
      )

      const elements = [notDup, dup1, dup2]
      await filter.onFetch?.(elements)
      expect(elements.map(e => e.elemID.name)).toEqual(['notDup', 'dup_1', 'dup_2'])
    })

    it('should do nothing if there is no id', async () => {
      const dup1 = new InstanceElement(
        'dup',
        type,
        {
          name: 'dup',
        }
      )
      const dup2 = new InstanceElement(
        'dup',
        type,
        {
          name: 'dup',
        }
      )

      const elements = [dup1, dup2]
      await filter.onFetch?.(elements)
      expect(elements.map(e => e.elemID.name)).toEqual(['dup', 'dup'])
    })
  })

  it('should do nothing if typesToFallbackToInternalId is empty', async () => {
    config.fetch.typesToFallbackToInternalId = []
    const dup1 = new InstanceElement(
      'dup',
      type,
      {
        id: '1',
        name: 'dup',
      }
    )
    const dup2 = new InstanceElement(
      'dup',
      type,
      {
        id: '2',
        name: 'dup',
      }
    )

    const elements = [dup1, dup2]
    await filter.onFetch?.(elements)
    expect(elements.map(e => e.elemID.name)).toEqual(['dup', 'dup'])
  })
})
