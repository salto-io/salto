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
import {
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../../src/constants'
import fieldConfigurationItemsFilter from '../../../src/filters/field_configuration/field_configuration_items'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { getFilterParams, mockClient } from '../../utils'

describe('fieldConfigurationItemsFilter', () => {
  let filter: filterUtils.FilterWith<'deploy'>
  let type: ObjectType
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator, connection } = mockClient()
    mockConnection = connection

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldConfiguration = true

    filter = fieldConfigurationItemsFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter

    type = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME),
    })
  })

  describe('deploy', () => {
    let changes: Change<InstanceElement>[]

    beforeEach(async () => {
      mockConnection.put.mockClear()

      const fieldConfigurationType = new ObjectType({
        elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME),
      })

      changes = _.range(0, 150).map(i =>
        toChange({
          after: new InstanceElement(
            `instance${i}`,
            type,
            {
              id: `supported${i}`,
            },
            undefined,
            {
              [CORE_ANNOTATIONS.PARENT]: [
                new ReferenceExpression(
                  new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME, 'instance', 'inst'),
                  new InstanceElement('instance', fieldConfigurationType, {
                    id: '1',
                  }),
                ),
              ],
            },
          ),
        }),
      )
    })

    it('should deploy configuration items in chunks', async () => {
      const { deployResult } = await filter.deploy(changes)
      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(150)

      expect(mockConnection.put).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfiguration/1/fields',
        {
          fieldConfigurationItems: changes.slice(0, 100).map(change => getChangeData(change).value),
        },
        undefined,
      )
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/rest/api/3/fieldconfiguration/1/fields',
        {
          fieldConfigurationItems: changes.slice(100, changes.length).map(change => getChangeData(change).value),
        },
        undefined,
      )
    })

    it('should return error when failed', async () => {
      mockConnection.put.mockRejectedValue(new Error('failed'))
      const { deployResult } = await filter.deploy(changes)

      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(deployResult.errors).toHaveLength(1)
    })

    it('should not deploy if there are no items', async () => {
      await filter.deploy([])
      expect(mockConnection.put).not.toHaveBeenCalledWith()
    })

    it('should do nothing when splitFieldConfiguration is disabled', async () => {
      config.fetch.splitFieldConfiguration = false
      const { deployResult, leftoverChanges } = await filter.deploy(changes)

      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(deployResult.errors).toHaveLength(0)
      expect(leftoverChanges).toHaveLength(changes.length)
    })
  })
})
