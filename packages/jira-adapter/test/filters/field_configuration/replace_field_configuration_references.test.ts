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
import { ElemID, InstanceElement, MapType, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../../src/constants'
import replaceFieldConfigurationReferencesFilter from '../../../src/filters/field_configuration/replace_field_configuration_references'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

import { getFilterParams } from '../../utils'

describe('replaceFieldConfigurationReferencesFilter', () => {
  let filter: filterUtils.FilterWith<'deploy'>
  let fieldConfigType: ObjectType
  let fieldConfigItemType: ObjectType
  let fieldType: ObjectType
  let instance: InstanceElement
  let fieldInstance: InstanceElement
  let config: JiraConfig

  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldConfiguration = false

    fieldConfigItemType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME),
    })

    fieldConfigType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME),
      fields: {
        fields: {
          refType: new MapType(fieldConfigItemType),
        },
      },
    })

    instance = new InstanceElement('instance', fieldConfigType, {
      fields: [
        {
          id: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'fieldInstance'), {}),
          isRequired: true,
        },
      ],
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
    })

    fieldInstance = new InstanceElement('fieldInstance', fieldType)

    const elementsSource = buildElementsSourceFromElements([fieldInstance])
    filter = replaceFieldConfigurationReferencesFilter(
      getFilterParams({
        config,
        elementsSource,
      }),
    ) as typeof filter
  })

  describe('fetch', () => {
    it('should convert fields to a map', async () => {
      await filter.onFetch?.([instance, fieldConfigType])
      expect(instance.value.fields).toEqual({
        fieldInstance: {
          isRequired: true,
        },
      })
    })

    it('should convert the fields field', async () => {
      await filter.onFetch?.([instance, fieldConfigType])
      expect(await fieldConfigType.fields.fields.getType()).toBeInstanceOf(MapType)
    })

    it('should do nothing if splitFieldConfiguration is true', async () => {
      config.fetch.splitFieldConfiguration = true
      await filter.onFetch?.([instance, fieldConfigType])
      expect(instance.value.fields).toBeArray()
    })
  })

  describe('preDeploy onDeploy', () => {
    beforeEach(() => {
      instance = new InstanceElement('instance', fieldConfigType, {
        fields: {
          fieldInstance: {
            isRequired: true,
          },
        },
      })
    })
    it('should convert fields to a list', async () => {
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toBeArrayOfSize(1)
      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toEqual({
        fieldInstance: {
          isRequired: true,
        },
      })
    })

    it('should do nothing if splitFieldConfiguration is true', async () => {
      config.fetch.splitFieldConfiguration = true
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toEqual({
        fieldInstance: {
          isRequired: true,
        },
      })

      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value.fields).toEqual({
        fieldInstance: {
          isRequired: true,
        },
      })
    })
  })
})
