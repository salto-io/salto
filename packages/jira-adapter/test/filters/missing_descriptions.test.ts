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
import _ from 'lodash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { mockClient } from '../utils'
import missingDescriptionsFilter from '../../src/filters/missing_descriptions'
import { Filter } from '../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { JIRA, PROJECT_ROLE_TYPE } from '../../src/constants'

describe('missingDescriptionsFilter', () => {
  let filter: Filter
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = missingDescriptionsFilter({
      client,
      paginator,
      config,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_ROLE_TYPE),
    })

    instance = new InstanceElement(
      'instance',
      type,
    )
  })

  describe('onFetch', () => {
    it('should add description if missing', async () => {
      await filter.onFetch?.([instance])

      expect(instance.value).toEqual({
        description: '',
      })
    })

    it('should not change description if not missing', async () => {
      instance.value.description = 'description'
      await filter.onFetch?.([instance])

      expect(instance.value).toEqual({
        description: 'description',
      })
    })

    it('should not change description if not relevant type', async () => {
      instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID(JIRA, 'not_relevant_type'),
        }),
      )
      await filter.onFetch?.([instance])

      expect(instance.value).toEqual({})
    })
  })
})
