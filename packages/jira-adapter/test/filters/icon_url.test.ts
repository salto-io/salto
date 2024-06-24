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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { getFilterParams } from '../utils'
import iconUrlFilter from '../../src/filters/icon_url'
import { Filter } from '../../src/filter'
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'

describe('iconUrlFilter', () => {
  let filter: Filter
  let type: ObjectType
  beforeEach(async () => {
    filter = iconUrlFilter(getFilterParams())

    type = new ObjectType({
      elemID: new ElemID(JIRA, STATUS_TYPE_NAME),
    })
  })

  describe('preDeploy', () => {
    it('should convert iconUrl to iconurl', async () => {
      const instance = new InstanceElement('instance', type, {
        iconUrl: 'someUrl',
      })

      await filter.preDeploy?.([toChange({ after: instance })])

      expect(instance.value).toEqual({
        iconurl: 'someUrl',
      })
    })
  })

  describe('onDeploy', () => {
    it('should convert iconurl to iconUrl', async () => {
      const instance = new InstanceElement('instance', type, {
        iconurl: 'someUrl',
      })

      await filter.onDeploy?.([toChange({ after: instance })])

      expect(instance.value).toEqual({
        iconUrl: 'someUrl',
      })
    })
  })
})
