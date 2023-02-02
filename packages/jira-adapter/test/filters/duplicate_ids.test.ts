/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { getFilterParams } from '../utils'
import duplicateIdsFilter from '../../src/filters/duplicate_ids'
import { Filter } from '../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'

describe('duplicateIdsFilter', () => {
  let filter: Filter
  let type: ObjectType
  let config: JiraConfig
  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    config.fetch.fallbackToInternalId = true

    filter = duplicateIdsFilter(getFilterParams({
      config,
    }))

    type = new ObjectType({
      elemID: new ElemID(JIRA, STATUS_TYPE_NAME),
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
          message: 'The following elements had duplicate names in Jira and therefore their internal id was added to their names: dup_1, dup_2. It is strongly recommended to rename these instances so they are unique in Jira, then re-fetch with the "Regenerate Salto IDs" fetch option. Read more here: https://help.salto.io/en/articles/6927157-salto-id-collisions.',
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

  it('should only remove the duplicates if typesToFallbackToInternalId is empty', async () => {
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
    await filter.onFetch?.(elements)
    expect(elements).toHaveLength(0)
  })

  it('should only remove the duplicates if fallbackToInternalId is false', async () => {
    config.fetch.fallbackToInternalId = false
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
    expect(elements).toHaveLength(0)

    expect(filterRes).toEqual({
      errors: [{
        message: `The following elements had duplicate names in Jira: jira.Status.instance.dup. It is strongly recommended to rename these instances so they are unique in Jira, then re-fetch.
If changing the names is not possible, you can add the fetch.fallbackToInternalId option to the configuration file; that will add their internal ID to their names and fetch them. Read more here: https://help.salto.io/en/articles/6927157-salto-id-collisions`,
        severity: 'Warning',
      }],
    })
  })
})
