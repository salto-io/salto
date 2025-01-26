/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Values,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { JIRA } from '../../../src/constants'
import { customFieldsWith10KOptionValidator } from '../../../src/change_validators/field_contexts/custom_field_with_10K_options'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { createEmptyType } from '../../utils'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from '../../../src/filters/fields/constants'

const generateOptions = (count: number): Values => {
  const options: { [key: string]: { value: string; disabled: boolean; position: number } } = {}
  Array.from({ length: count }, (_length, i) => i).forEach(i => {
    const key = `p${i}`
    options[key] = {
      value: key,
      disabled: false,
      position: i,
    }
  })
  return options
}

describe('customFieldsWith10KOptionValidator', () => {
  let parentField: InstanceElement
  let contextInstance: InstanceElement
  let config: JiraConfig
  const tenKOptions = generateOptions(10010)
  beforeEach(() => {
    parentField = new InstanceElement('parentField', new ObjectType({ elemID: new ElemID(JIRA, 'Field') }), { id: 2 })
    contextInstance = new InstanceElement(
      'context',
      new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') }),
      {
        id: 3,
        options: [],
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentField.elemID, parentField)],
      },
    )
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
  })
  describe('without splitFieldContextOptions', () => {
    beforeEach(() => {
      config.fetch.splitFieldContextOptions = false
    })
    it('should return info message when context has more than 10K options', async () => {
      const largeOptionsObject = tenKOptions
      contextInstance.value.options = largeOptionsObject
      const changes = [toChange({ after: contextInstance })]
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        {
          elemID: contextInstance.elemID,
          severity: 'Info',
          message: 'Slow deployment due to field with more than 10K options',
          detailedMessage:
            "The deployment of custom field parentField's options will be slower because there are more than 10K options.",
        },
      ])
    })
    it('should not return info message when context has less than 10K options', async () => {
      const smallOptionsObject = generateOptions(100)
      contextInstance.value.options = smallOptionsObject
      const changes = [toChange({ after: contextInstance })]
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
      expect(changeErrors).toHaveLength(0)
    })
    it('handle multy changes', async () => {
      const largeOptionsObject = tenKOptions
      const contextInstanceAfterOne = contextInstance.clone()
      const contextInstanceAfterTwo = contextInstance.clone()
      contextInstanceAfterTwo.value.id = '2'
      contextInstanceAfterOne.value.options = largeOptionsObject
      contextInstanceAfterTwo.value.options = largeOptionsObject
      const changes = [toChange({ after: contextInstanceAfterOne }), toChange({ after: contextInstanceAfterTwo })]
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors).toEqual([
        {
          elemID: contextInstanceAfterOne.elemID,
          severity: 'Info',
          message: 'Slow deployment due to field with more than 10K options',
          detailedMessage:
            "The deployment of custom field parentField's options will be slower because there are more than 10K options.",
        },
        {
          elemID: contextInstanceAfterTwo.elemID,
          severity: 'Info',
          message: 'Slow deployment due to field with more than 10K options',
          detailedMessage:
            "The deployment of custom field parentField's options will be slower because there are more than 10K options.",
        },
      ])
    })
    it('should not return error if context has no new options', async () => {
      contextInstance.value.options = tenKOptions
      const contextInstanceAfter = contextInstance.clone()
      contextInstanceAfter.value.disabled = true
      const changes = [toChange({ before: contextInstance, after: contextInstanceAfter })]
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
      expect(changeErrors).toHaveLength(0)
    })
    it('should return error for modification change', async () => {
      contextInstance.value.options = tenKOptions
      const contextInstanceAfter = contextInstance.clone()
      contextInstanceAfter.value.options.p20002 = {
        value: 'p20002',
        disabled: false,
        position: 20002,
      }
      const changes = [toChange({ before: contextInstance, after: contextInstanceAfter })]
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        {
          elemID: contextInstance.elemID,
          severity: 'Info',
          message: 'Slow deployment due to field with more than 10K options',
          detailedMessage:
            "The deployment of custom field parentField's options will be slower because there are more than 10K options.",
        },
      ])
    })
  })

  describe('with splitFieldContextOptions', () => {
    it('should return error for modification change', async () => {
      config.fetch.splitFieldContextOptions = true
      const orderInstance = new InstanceElement(
        'orderInstance',
        createEmptyType(OPTIONS_ORDER_TYPE_NAME),
        { options: _.range(0, 10001) },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
        },
      )
      const orderInstanceAfter = orderInstance.clone()
      orderInstanceAfter.value.options.p20002 = {
        value: 'p20002',
        disabled: false,
        position: 20002,
      }
      const changes = [toChange({ before: orderInstance, after: orderInstanceAfter })]
      const elementsSource = buildElementsSourceFromElements([orderInstanceAfter, contextInstance])
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors).toEqual([
        {
          elemID: orderInstanceAfter.elemID,
          severity: 'Info',
          message: 'Slow deployment due to field with more than 10K options',
          detailedMessage:
            "The deployment of custom field parentField's options will be slower because there are more than 10K options.",
        },
      ])
    })
    it('should not return error for modification change with less than 10K options', async () => {
      config.fetch.splitFieldContextOptions = true
      const orderInstance = new InstanceElement(
        'orderInstance',
        createEmptyType(OPTIONS_ORDER_TYPE_NAME),
        { options: _.range(0, 9999) },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
        },
      )
      const orderInstanceAfter = orderInstance.clone()
      orderInstanceAfter.value.options.p20002 = {
        value: 'p20002',
        disabled: false,
        position: 20002,
      }
      const changes = [toChange({ before: orderInstance, after: orderInstanceAfter })]
      const elementsSource = buildElementsSourceFromElements([orderInstanceAfter, contextInstance])
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
      expect(changeErrors).toHaveLength(0)
    })
    it('should return error for context with cascading options with more than 10K options overall', async () => {
      config.fetch.splitFieldContextOptions = true
      const orderInstance = new InstanceElement(
        'orderInstance',
        createEmptyType(OPTIONS_ORDER_TYPE_NAME),
        { options: _.range(0, 9000) },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
        },
      )
      const optionInstance = new InstanceElement(
        'optionInstance',
        createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME),
        {},
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
        },
      )
      const innerOrderInstance = new InstanceElement(
        'innerOrderInstance',
        createEmptyType(OPTIONS_ORDER_TYPE_NAME),
        { options: _.range(0, 1001) },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
        },
      )
      const changes = [toChange({ after: orderInstance }), toChange({ after: innerOrderInstance })]
      const elementsSource = buildElementsSourceFromElements([
        orderInstance,
        innerOrderInstance,
        optionInstance,
        contextInstance,
      ])
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
      expect(changeErrors).toHaveLength(2)
      expect(changeErrors).toEqual([
        {
          elemID: orderInstance.elemID,
          severity: 'Info',
          message: 'Slow deployment due to field with more than 10K options',
          detailedMessage:
            "The deployment of custom field parentField's options will be slower because there are more than 10K options.",
        },
        {
          elemID: innerOrderInstance.elemID,
          severity: 'Info',
          message: 'Slow deployment due to field with more than 10K options',
          detailedMessage:
            "The deployment of custom field parentField's options will be slower because there are more than 10K options.",
        },
      ])
    })
    it('should not return error without order changes', async () => {
      config.fetch.splitFieldContextOptions = true
      const changes = [toChange({ after: contextInstance })]
      const elementsSource = buildElementsSourceFromElements([contextInstance])
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
      expect(changeErrors).toHaveLength(0)
    })
    it('should not return error with undefined elements source', async () => {
      config.fetch.splitFieldContextOptions = true
      const orderInstance = new InstanceElement(
        'orderInstance',
        createEmptyType(OPTIONS_ORDER_TYPE_NAME),
        { options: _.range(0, 10001) },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
        },
      )
      const changes = [toChange({ after: orderInstance })]
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, undefined)
      expect(changeErrors).toHaveLength(0)
    })
    it('should handle order instances without options field', async () => {
      config.fetch.splitFieldContextOptions = true
      const orderInstance = new InstanceElement(
        'orderInstance',
        createEmptyType(OPTIONS_ORDER_TYPE_NAME),
        {},
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
        },
      )
      const changes = [toChange({ after: orderInstance })]
      const elementsSource = buildElementsSourceFromElements([orderInstance, contextInstance])
      const changeErrors = await customFieldsWith10KOptionValidator(config)(changes, elementsSource)
      expect(changeErrors).toHaveLength(0)
    })
  })
})
