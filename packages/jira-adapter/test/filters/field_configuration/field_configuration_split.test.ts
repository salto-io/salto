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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../../src/constants'
import fieldConfigurationSplitFilter from '../../../src/filters/field_configuration/field_configuration_split'
import { getFilterParams, mockClient } from '../../utils'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'

describe('fieldConfigurationItemsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let fieldConfigurationType: ObjectType
  let fieldConfigurationItemType: ObjectType
  let config: JiraConfig

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldConfiguration = true

    filter = fieldConfigurationSplitFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter

    fieldConfigurationItemType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME),
    })

    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME),
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations to FieldConfigurationItem', async () => {
      await filter.onFetch([fieldConfigurationType, fieldConfigurationItemType])
      expect(fieldConfigurationItemType.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      })
    })

    it('should remove fields field', async () => {
      await filter.onFetch([fieldConfigurationType, fieldConfigurationItemType])
      delete fieldConfigurationType.fields.fields
    })

    it('should split to different instances', async () => {
      const instance = new InstanceElement(
        'instance',
        fieldConfigurationType,
        {
          fields: [
            {
              id: {
                elemID: new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1'),
              },
            },
            {
              id: {
                elemID: new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field2'),
              },
            },
          ],
        },
        ['Jira', 'Records', 'field_configuration', 'instance'],
      )

      const elements = [fieldConfigurationType, fieldConfigurationItemType, instance]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(5)

      expect(instance.value.fields).toBeUndefined()

      const [item1, item2] = elements.slice(3) as InstanceElement[]
      expect(item1.elemID).toEqual(new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME, 'instance', 'instance_field1'))
      expect(item1.value).toEqual({
        id: {
          elemID: new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1'),
        },
      })
      expect(item2.elemID).toEqual(new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME, 'instance', 'instance_field2'))
      expect(item2.value).toEqual({
        id: {
          elemID: new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field2'),
        },
      })
    })

    it('should not split to different instances if disabled in the config', async () => {
      config.fetch.splitFieldConfiguration = false
      const instance = new InstanceElement(
        'instance',
        fieldConfigurationType,
        {
          fields: [
            {
              id: {
                elemID: new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field1'),
              },
            },
            {
              id: {
                elemID: new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'field2'),
              },
            },
          ],
        },
        ['Jira', 'Records', 'field_configuration', 'instance'],
      )

      const elements = [fieldConfigurationType, fieldConfigurationItemType, instance]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(3)

      expect(instance.value.fields).toBeDefined()
    })
  })
})
