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
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  BuiltinTypes,
  TemplateExpression,
  MapType,
  toChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../../../src/config/config'
import filterCreator from '../../../../src/filters/automation/smart_values/smart_value_reference_filter'
import { getFilterParams } from '../../../utils'

describe('smart_value_reference_filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType
  let automationType: ObjectType
  let fieldType: ObjectType
  let fieldInstance: InstanceElement
  let automationInstance: InstanceElement
  let emptyAutomationInstance: InstanceElement
  let config: JiraConfig

  beforeEach(() => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = filterCreator(getFilterParams({ config })) as FilterType

    automationType = new ObjectType({
      elemID: new ElemID('jira', 'Automation'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        actions: { refType: new MapType(BuiltinTypes.STRING) },
      },
    })

    fieldType = new ObjectType({
      elemID: new ElemID('jira', 'Field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        actions: { refType: new MapType(BuiltinTypes.STRING) },
      },
    })

    fieldInstance = new InstanceElement('field_one', fieldType, { name: 'fieldOne', id: 'fieldId' })

    automationInstance = new InstanceElement('autom', automationType, {
      trigger: {},
      components: [
        {
          value: {
            inner: 'Field is: {{issue.fieldOne}} {{issue.fieldId}} ending',
          },
          rawValue: 'Field is: {{issue.fieldOne}} {{issue.fieldId}} ending',
        },
      ],
    })

    emptyAutomationInstance = new InstanceElement('emptyAutom', automationType)
  })

  const generateElements = (): (InstanceElement | ObjectType)[] =>
    [fieldInstance, automationInstance, fieldType, automationType, emptyAutomationInstance].map(element =>
      element.clone(),
    )

  describe('on fetch successful', () => {
    let elements: (InstanceElement | ObjectType)[]
    let automation: InstanceElement

    beforeEach(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
      const automationResult = elements.filter(isInstanceElement).find(i => i.elemID.name === 'autom')
      expect(automationResult).toBeDefined()
      automation = automationResult as InstanceElement
    })

    it('should ignore empty automation', () => {
      expect(elements.filter(isInstanceElement).find(i => i.elemID.name === 'emptyAutom')).toEqual(
        emptyAutomationInstance,
      )
    })

    it('should resolve simple template in value', () => {
      expect(automation.value.components[0].value.inner).toEqual(
        new TemplateExpression({
          parts: [
            'Field is: {{issue.',
            new ReferenceExpression(fieldInstance.elemID.createNestedID('name'), 'fieldOne'),
            '}} {{issue.',
            new ReferenceExpression(fieldInstance.elemID, fieldInstance),
            '}} ending',
          ],
        }),
      )
    })

    it('should resolve simple template in rawValue', () => {
      expect(automation.value.components[0].rawValue).toEqual(
        new TemplateExpression({
          parts: [
            'Field is: {{issue.',
            new ReferenceExpression(fieldInstance.elemID.createNestedID('name'), 'fieldOne'),
            '}} {{issue.',
            new ReferenceExpression(fieldInstance.elemID, fieldInstance),
            '}} ending',
          ],
        }),
      )
    })
    it('should not fail if value is boolean', async () => {
      const automation2 = new InstanceElement('autom2', automationType, {
        trigger: { value: true },
        components: [
          {
            value: true,
            rawValue: 'Field is: {{issue.fieldOne}} {{issue.fieldId}} ending',
          },
        ],
      })
      await expect(filter.onFetch([automation2])).resolves.not.toThrow()
    })
  })

  describe('on fetch failure', () => {
    it('should do nothing for components without a value', async () => {
      delete automationInstance.value.components[0].value
      delete automationInstance.value.components[0].rawValue
      const originalAutomation = automationInstance.clone()
      await filter.onFetch([automationInstance])
      expect(automationInstance.value).toEqual(originalAutomation.value)
    })

    it('should do nothing if was disabled in the config', async () => {
      const elements = generateElements()
      const automationResult = elements.filter(isInstanceElement).find(i => i.elemID.name === 'autom')
      expect(automationResult).toBeDefined()
      const automation = automationResult as InstanceElement

      const originalAutomation = automation.clone()
      config.fetch.parseTemplateExpressions = false
      await filter.onFetch(elements)
      expect(automation.value).toEqual(originalAutomation.value)
    })

    it('should not parse if there are two fields with the same name', async () => {
      const auto = automationInstance.clone()
      const field = fieldInstance.clone()
      field.value.id = 'id'
      await filter.onFetch([auto, field, field])
      expect(auto.value.components[0].value.inner).toBe('Field is: {{issue.fieldOne}} {{issue.fieldId}} ending')
    })
  })
  describe('preDeploy', () => {
    let elementsBeforeFetch: (InstanceElement | ObjectType)[]
    let elementsAfterPreDeploy: (InstanceElement | ObjectType)[]

    beforeEach(async () => {
      elementsBeforeFetch = generateElements()
      const elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
    })

    it('Returns elements to origin after predeploy', () => {
      expect(elementsAfterPreDeploy).toEqual(elementsBeforeFetch)
    })
  })

  describe('on preDeploy failure', () => {
    it('should do nothing for components without a value', async () => {
      delete automationInstance.value.components[0].value
      delete automationInstance.value.components[0].rawValue
      const originalAutomation = automationInstance.clone()
      await filter.preDeploy([
        toChange({
          before: automationInstance,
          after: automationInstance,
        }),
      ])
      expect(automationInstance.value).toEqual(originalAutomation.value)
    })
  })

  describe('onDeploy', () => {
    let elementsAfterFetch: (InstanceElement | ObjectType)[]
    let elementsAfterOnDeploy: (InstanceElement | ObjectType)[]

    beforeEach(async () => {
      // we recreate fetch and onDeploy to have the templates in place to be restored by onDeploy
      const elementsBeforeFetch = generateElements()
      elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      const elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
      elementsAfterOnDeploy = elementsAfterPreDeploy.map(e => e.clone())
      await filter.onDeploy(elementsAfterOnDeploy.map(e => toChange({ before: e, after: e })))
    })

    it('Returns elements to after fetch state (with templates) after onDeploy', () => {
      expect(elementsAfterOnDeploy).toEqual(elementsAfterFetch)
    })
  })

  describe('on onDeploy failure', () => {
    it('should do nothing for components without a value', async () => {
      delete automationInstance.value.components[0].value
      delete automationInstance.value.components[0].rawValue
      const originalAutomation = automationInstance.clone()
      await filter.onDeploy([
        toChange({
          before: automationInstance,
          after: automationInstance,
        }),
      ])
      expect(automationInstance.value).toEqual(originalAutomation.value)
    })
  })
})
