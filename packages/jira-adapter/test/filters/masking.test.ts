/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import maskingFilter, { MASK_VALUE } from '../../src/filters/masking'
import { Filter } from '../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { AUTOMATION_TYPE, JIRA } from '../../src/constants'

describe('maskingFilter', () => {
  let filter: Filter
  let type: ObjectType
  let instance: InstanceElement
  let config: JiraConfig

  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = maskingFilter(getFilterParams({ config }))

    type = new ObjectType({
      elemID: new ElemID(JIRA, AUTOMATION_TYPE),
    })

    instance = new InstanceElement('instance', type, {
      headers: [
        {
          name: 'name1',
          value: 'value1',
        },
        {
          name: 'name2',
          value: 'value2',
        },
        {
          name: 'aname3',
          value: 'avalue3',
        },
      ],
    })
  })

  describe('onFetch', () => {
    describe('automationHeaders', () => {
      it('should mask the sensitive headers', async () => {
        config.masking.automationHeaders = ['name.*']

        await filter.onFetch?.([instance])

        expect(instance.value).toEqual({
          headers: [
            {
              name: 'name1',
              value: MASK_VALUE,
            },
            {
              name: 'name2',
              value: MASK_VALUE,
            },
            {
              name: 'aname3',
              value: 'avalue3',
            },
          ],
        })
      })
    })

    describe('secretRegexps', () => {
      it('should mask the sensitive strings', async () => {
        config.masking.secretRegexps = ['name.*']

        await filter.onFetch?.([instance])

        expect(instance.value).toEqual({
          headers: [
            {
              name: MASK_VALUE,
              value: 'value1',
            },
            {
              name: MASK_VALUE,
              value: 'value2',
            },
            {
              name: 'aname3',
              value: 'avalue3',
            },
          ],
        })
      })
    })
  })
})
