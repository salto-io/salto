/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, Value } from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, WalkOnFunc, walkOnValue } from '@salto-io/adapter-utils'
import { createEmptyType } from '../../utils'
import { AUTOMATION_TYPE } from '../../../src/constants'
import { AutomationInstance } from '../../../src/filters/automation/smart_values/smart_value_reference_filter'
import {
  advancedFieldsReferenceFunc,
  walkOnAutomation,
  walkOnAutomations,
} from '../../../src/filters/automation/walk_on_automation'

describe('walk_on_automation', () => {
  let instance: InstanceElement
  const changeValueFunc: WalkOnFunc = ({ value }): WALK_NEXT_STEP => {
    if (value == null) {
      return WALK_NEXT_STEP.SKIP
    }
    if (value.value !== undefined) {
      value.value = 'replaced'
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  beforeEach(async () => {
    instance = new InstanceElement('instance', createEmptyType(AUTOMATION_TYPE), {
      id: '111',
      trigger: {
        children: [
          {
            id: '0',
            value: null,
            updated: 1234,
          },
        ],
        type: 'jira.issue.event.trigger:created',
      },
      components: [
        {
          id: '0',
          value: { a: '12' },
          updated: 1234,
        },
        {
          id: '1',
          component: 'CONDITION',
          value: { a: 'priority > Medium' },
          updated: 1111,
        },
        {
          id: '3',
          component: 'CONDITION',
          otherValue: {
            selectedFieldType: 'priority',
            comparison: 'NOT_ONE_OF',
            compareValue: {
              type: 'ID',
              multiValue: true,
              value: '["\\"123","234","345","a]"]',
            },
          },
        },
      ],
      projects: [
        {
          value: 'doNotReplaceMe',
        },
      ],
    })
  })
  describe('walkOnAutomation', () => {
    it('should walk on trigger and components', () => {
      walkOnAutomation({ instance: instance as AutomationInstance, func: changeValueFunc })
      expect(instance.value.trigger.children[0].value).toEqual('replaced')
      expect(instance.value.components[0].value).toEqual('replaced')
      expect(instance.value.components[1].value).toEqual('replaced')
      expect(instance.value.components[2].otherValue.compareValue.value).toEqual('replaced')
    })
    it('should not walk on projects', () => {
      walkOnAutomation({ instance: instance as AutomationInstance, func: changeValueFunc })
      expect(instance.value.projects[0].value).toEqual('doNotReplaceMe')
    })
  })
  describe('walkOnAutomations', () => {
    it('should walk on all automations', () => {
      const automation2 = instance.clone()
      walkOnAutomations([instance, automation2], changeValueFunc)
      expect(instance.value.trigger.children[0].value).toEqual('replaced')
      expect(automation2.value.trigger.children[0].value).toEqual('replaced')
    })
    it('should not walk on other instances', () => {
      const automation2 = instance.clone()
      delete automation2.value.trigger
      walkOnAutomations([instance, automation2], changeValueFunc)
      expect(instance.value.trigger.children[0].value).toEqual('replaced')
      expect(automation2.value.components[0].value).toEqual({ a: '12' })
    })
  })
  describe('advancedFieldsReferenceFunc', () => {
    it('should operate the function on advancedFields', () => {
      const advancedFieldsInstance = new InstanceElement('advancedFieldsInstance', createEmptyType(AUTOMATION_TYPE), {
        a: {
          advancedFields: { value: 'toBeReplaced' },
        },
        b: {
          bb: {
            advancedFields: { value: 'toBeReplaced' },
          },
        },
        c: {
          value: 'doNotReplaceMe',
        },
        d: {
          value: undefined,
        },
      })
      const changeAdvancedFieldsFunc = (value: Value, fieldName: string): void => {
        value[fieldName].value = 'replaced'
      }
      walkOnValue({
        elemId: advancedFieldsInstance.elemID,
        value: advancedFieldsInstance.value,
        func: advancedFieldsReferenceFunc(changeAdvancedFieldsFunc),
      })
      expect(advancedFieldsInstance.value.a.advancedFields.value).toEqual('replaced')
      expect(advancedFieldsInstance.value.b.bb.advancedFields.value).toEqual('replaced')
      expect(advancedFieldsInstance.value.c.value).toEqual('doNotReplaceMe')
    })
  })
})
