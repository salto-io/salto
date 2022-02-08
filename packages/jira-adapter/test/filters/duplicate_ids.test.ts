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
import { JIRA } from '../../src/constants'

describe('duplicateIdsFilter', () => {
  let filter: Filter
  let type: ObjectType
  let config: JiraConfig
  beforeEach(async () => {
    const { client, paginator } = mockClient()

    config = _.cloneDeep(DEFAULT_CONFIG)

    filter = duplicateIdsFilter({
      client,
      paginator,
      config,
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'Status'),
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
      const filterRes = await filter.onFetch?.(elements)
      expect(elements.map(e => e.elemID.name)).toEqual(['notDup', 'dup_1', 'dup_2'])
      expect(filterRes).toEqual({
        errors: [{
          message: 'The name of jira.Status.instance.dup is not unique in the account, so the ids of the instances were added to their names, the new names are dup_1, dup_2. However, that way Salto will not be able to identify that instances between environments are the same instance which will impact comparing and cloning elements between environments. It is strongly recommended to change the names of the instances to be unique in the account and then re-fetch with "Regenerate Salto IDs".',
          severity: 'Warning',
        }],
      })
    })

    it('should create the right warning message when there are multiple dups', async () => {
      const dupA1 = new InstanceElement(
        'dupA',
        type,
        {
          id: '1',
          name: 'dupA',
        }
      )
      const dupA2 = new InstanceElement(
        'dupA',
        type,
        {
          id: '2',
        }
      )

      const dupB1 = new InstanceElement(
        'dupB',
        type,
        {
          id: '3',
          name: 'dupB',
        }
      )
      const dupB2 = new InstanceElement(
        'dupB',
        type,
        {
          id: '4',
        }
      )

      const elements = [dupA1, dupA2, dupB1, dupB2]
      const filterRes = await filter.onFetch?.(elements)
      expect(elements.map(e => e.elemID.name)).toEqual(['dupA_1', 'dupA_2', 'dupB_3', 'dupB_4'])
      expect(filterRes).toEqual({
        errors: [{
          message: 'The names of jira.Status.instance.dupA, jira.Status.instance.dupB are not unique in the account, so the ids of the instances were added to their names, the new names are dupA_1, dupA_2, dupB_3, dupB_4. However, that way Salto will not be able to identify that instances between environments are the same instance which will impact comparing and cloning elements between environments. It is strongly recommended to change the names of the instances to be unique in the account and then re-fetch with "Regenerate Salto IDs".',
          severity: 'Warning',
        }],
      })
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
    config.apiDefinitions.typesToFallbackToInternalId = []
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
    const filterRes = await filter.onFetch?.(elements)
    expect(elements.map(e => e.elemID.name)).toEqual(['dup', 'dup'])

    expect(filterRes).toEqual({})
  })
})
