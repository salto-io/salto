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
import { filterUtils } from '@salto-io/adapter-components'
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import filterCreator from '../../src/filters/add_alias'
import { getFilterParams } from '../utils'
import JiraClient from '../../src/client/client'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { JIRA } from '../../src/constants'

describe('add alias filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let client: JiraClient
  let config: JiraConfig

  const fieldTypeName = 'Field'
  const dashboardGadgetTypeName = 'DashboardGadget'
  const fieldConfigurationTypeName = 'FieldConfiguration'
  const fieldConfigurationItemTypeName = 'FieldConfigurationItem'
  const customFieldContextTypeName = 'CustomFieldContext'

  const fieldType = new ObjectType({ elemID: new ElemID(JIRA, fieldTypeName) })
  const dashboardGadgetType = new ObjectType({ elemID: new ElemID(JIRA, dashboardGadgetTypeName) })
  const fieldConfigurationType = new ObjectType({ elemID: new ElemID(JIRA, fieldConfigurationTypeName) })
  const fieldConfigurationItemType = new ObjectType({ elemID: new ElemID(JIRA, fieldConfigurationItemTypeName) })
  const customFieldContextType = new ObjectType({ elemID: new ElemID(JIRA, customFieldContextTypeName) })

  const fieldInstance = new InstanceElement('instance1', fieldType, { name: 'field name alias' })
  const fieldConfigurationInstance = new InstanceElement('instance3', fieldConfigurationType, { name: 'field config' })

  beforeEach(async () => {
    client = new JiraClient({
      credentials: { baseUrl: 'http://myjira.net', user: 'me', token: 'tok' },
      isDataCenter: false,
    })
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.addAlias = true
    filter = filterCreator(getFilterParams({ client, config })) as FilterType
  })

  describe('onFetch', () => {
    it('should add alias annotation correctly', async () => {
      const dashboardGadgetInstance = new InstanceElement('instance2', dashboardGadgetType, {
        title: 'gadget name alias',
      })
      const fieldConfigurationItemInstance = new InstanceElement(
        'instance4',
        fieldConfigurationItemType,
        {
          id: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
        },
        undefined,
        {
          _parent: [new ReferenceExpression(fieldConfigurationInstance.elemID, fieldConfigurationInstance)],
        },
      )
      const customFieldContextInstance = new InstanceElement(
        'instance5',
        customFieldContextType,
        {
          name: 'c name',
        },
        undefined,
        {
          _parent: [new ReferenceExpression(fieldInstance.elemID, fieldInstance)],
        },
      )
      const dashboardGadgetInstanceInvalid = new InstanceElement('instance5', dashboardGadgetType, {})
      const elements = [
        fieldInstance,
        dashboardGadgetInstance,
        fieldConfigurationInstance,
        fieldConfigurationItemInstance,
        customFieldContextInstance,
        dashboardGadgetInstanceInvalid,
      ]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([
        'field name alias',
        'gadget name alias',
        undefined,
        'field config:field name alias',
        'field name alias context in c name',
        undefined,
      ])
    })
    it('should not add alias if flag is false', async () => {
      config.fetch.addAlias = false
      filter = filterCreator(getFilterParams({ client, config })) as FilterType
      const dashboardGadgetInstance = new InstanceElement('instance2', dashboardGadgetType, {
        title: 'gadget name alias',
      })
      const elements = [dashboardGadgetInstance]
      await filter.onFetch(elements)
      expect(dashboardGadgetInstance.annotations[CORE_ANNOTATIONS.ALIAS]).not.toBeDefined()
    })
    it('should not crush when one of the values is undefined', async () => {
      const dashboardGadgetInstanceInvalid = new InstanceElement('instance1', dashboardGadgetType, { title: undefined })
      const elements = [dashboardGadgetInstanceInvalid]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([undefined])
    })
    it('should not crush when there is not parent', async () => {
      const fieldConfigurationItemInstance = new InstanceElement('instance4', fieldConfigurationItemType, {
        id: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
      })
      const elements = [fieldConfigurationItemInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([undefined])
    })
    it('should not crush when there is a value instead of a reference', async () => {
      const fieldConfigurationItemInstance = new InstanceElement(
        'instance4',
        fieldConfigurationItemType,
        {
          id: 123,
        },
        undefined,
        {
          _parent: [new ReferenceExpression(fieldConfigurationInstance.elemID, fieldConfigurationInstance)],
        },
      )
      const elements = [fieldConfigurationItemInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([undefined])
    })
    it('should not crush when there is a reference instead of a value', async () => {
      const dashboardGadgetInstance = new InstanceElement('instance2', dashboardGadgetType, {
        title: new ReferenceExpression(fieldConfigurationInstance.elemID, fieldConfigurationInstance),
      })

      const elements = [dashboardGadgetInstance]
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([undefined])
    })
  })
})
