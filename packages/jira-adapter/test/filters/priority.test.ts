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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange, getChangeData } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../utils'
import priorityFilter from '../../src/filters/priority'
import { Filter } from '../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { JIRA, PRIORITY_TYPE_NAME } from '../../src/constants'
import JiraClient from '../../src/client/client'

describe('priorityFilter', () => {
  let filter: Filter
  let type: ObjectType
  let config: JiraConfig
  let client: JiraClient

  beforeEach(async () => {
    const { client: cli, paginator } = mockClient()
    client = cli

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = priorityFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    )

    type = new ObjectType({
      elemID: new ElemID(JIRA, PRIORITY_TYPE_NAME),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        iconUrl: { refType: BuiltinTypes.STRING },
        statusColor: { refType: BuiltinTypes.STRING },
      },
    })
  })

  describe('onFetch', () => {
    it('should remove is default when it is false', async () => {
      const instance = new InstanceElement('instance', type, { isDefault: false })

      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({})
    })

    it('should not remove is default when it is true', async () => {
      const instance = new InstanceElement('instance', type, { isDefault: true })

      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({ isDefault: true })
    })
  })
  describe('preDeploy', () => {
    const iconUrlTruncatePath = '/folder/image.png'
    it('should concat the client base url to the instance icon url', () => {
      const instance = new InstanceElement('instance', type, { iconUrl: iconUrlTruncatePath })
      const changes = [toChange({ after: instance })]
      filter.preDeploy?.(changes)
      expect(getChangeData(changes[0]).value.iconUrl).toEqual(new URL(iconUrlTruncatePath, client.baseUrl).href)
    })
  })
  describe('onDeploy', () => {
    it('should remove the domain prefix from the iconUrl field', () => {
      const iconUrlTruncatePath = '/folder/image.png'
      const instance = new InstanceElement('instance', type, {
        iconUrl: new URL(iconUrlTruncatePath, client.baseUrl).href,
      })
      const changes = [toChange({ after: instance })]
      filter.onDeploy?.(changes)
      expect(getChangeData(changes[0]).value.iconUrl).toEqual(iconUrlTruncatePath)
    })
  })
})
