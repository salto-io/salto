/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  Change,
  ChangeValidator,
  CORE_ANNOTATIONS,
  InstanceElement,
  ReadOnlyElementsSource,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { fieldContextOptionsValidator } from '../../../src/change_validators/field_contexts/field_context_options'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../../src/filters/fields/constants'
import { createEmptyType } from '../../utils'

describe('fieldContextOptionsValidator', () => {
  let changes: Change<InstanceElement>[] = []
  let elementsSource: ReadOnlyElementsSource
  const optionType = createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME)
  const orderType = createEmptyType(OPTIONS_ORDER_TYPE_NAME)
  const contextInstance = new InstanceElement('context', createEmptyType(FIELD_CONTEXT_TYPE_NAME), {})
  let optionInstance: InstanceElement
  let orderInstance: InstanceElement
  let config: JiraConfig
  let validator: ChangeValidator

  beforeEach(() => {
    optionInstance = new InstanceElement('option', optionType, {}, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
    })
    orderInstance = new InstanceElement(
      'order',
      orderType,
      {
        options: [],
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
      },
    )
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldContextOptions = true
    validator = fieldContextOptionsValidator(config)
    changes = []
    elementsSource = buildElementsSourceFromElements([])
  })
  it('should return no errors when feature flag is false', async () => {
    config.fetch.splitFieldContextOptions = false
    changes = [optionInstance, orderInstance].map(instance => toChange({ after: instance }))
    validator = fieldContextOptionsValidator(config)
    const result = await validator(changes)
    expect(result).toEqual([])
  })
  it('should return an empty array when no changes', async () => {
    const result = await validator(changes)
    expect(result).toEqual([])
  })
  describe('option addition', () => {
    it('should not return an error when the order contains the option', async () => {
      orderInstance.value.options = [new ReferenceExpression(optionInstance.elemID, optionInstance)]
      changes = [optionInstance, orderInstance].map(instance => toChange({ after: instance }))
      const result = await validator(changes)
      expect(result).toEqual([])
    })

    it('should return an error if there is no order change', async () => {
      changes = [toChange({ after: optionInstance })]
      const result = await validator(changes)
      expect(result).toEqual([
        {
          elemID: optionInstance.elemID,
          severity: 'Error',
          message: "There is no order instance for this option's scope",
          detailedMessage: "There should be an order instance related to this option's parent",
        },
      ])
    })
    it('should return an error if there is no order change but there is an order in the elements source', async () => {
      elementsSource = buildElementsSourceFromElements([orderInstance])
      changes = [toChange({ after: optionInstance })]
      const result = await validator(changes, elementsSource)
      expect(result).toEqual([
        {
          elemID: optionInstance.elemID,
          severity: 'Error',
          message: "This option is not being referenced by it's corresponding order",
          detailedMessage: "The order instance context_order_child should reference all it's options",
        },
      ])
    })
    it('should return an error if there is an order change but does not contain it in the options', async () => {
      changes = [optionInstance, orderInstance].map(instance => toChange({ after: instance }))
      const result = await validator(changes)
      expect(result).toEqual([
        {
          elemID: optionInstance.elemID,
          severity: 'Error',
          message: "This option is not being referenced by it's corresponding order",
          detailedMessage: "The order instance context_order_child should reference all it's options",
        },
      ])
    })
    it('should return an error for order of cascading options with wrong deletion', async () => {
      const cascadeOption = new InstanceElement('cascadeOption', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
      })
      const cascadeOrder = new InstanceElement('cascadeOrder', orderType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
      })
      orderInstance.value.options = [new ReferenceExpression(optionInstance.elemID, optionInstance)]
      changes = [optionInstance, orderInstance, cascadeOption, cascadeOrder].map(instance =>
        toChange({ after: instance }),
      )
      const result = await validator(changes)
      expect(result).toEqual([
        {
          elemID: cascadeOption.elemID,
          severity: 'Error',
          message: "This option is not being referenced by it's corresponding order",
          detailedMessage: "The order instance option_order_child should reference all it's options",
        },
      ])
    })
    it('should return an error if the order does not have an options field', async () => {
      orderInstance.value = {}
      changes = [optionInstance, orderInstance].map(instance => toChange({ after: instance }))
      const result = await validator(changes)
      expect(result).toEqual([
        {
          elemID: optionInstance.elemID,
          severity: 'Error',
          message: "This option is not being referenced by it's corresponding order",
          detailedMessage: "The order instance context_order_child should reference all it's options",
        },
      ])
    })
  })
  describe('option removal', () => {
    it('should not return an error when the option is removed and deleted from the order', async () => {
      const before = orderInstance.clone()
      before.value.options = [new ReferenceExpression(optionInstance.elemID, optionInstance)]
      changes = [toChange({ before, after: orderInstance }), toChange({ before: optionInstance })]
      const result = await validator(changes)
      expect(result).toEqual([])
    })
    it('should return an error when the option is deleted from the order but not removed', async () => {
      const before = orderInstance.clone()
      const optionInstance2 = new InstanceElement('option2', optionType, {}, undefined, {})
      before.value.options = [
        new ReferenceExpression(optionInstance.elemID, optionInstance),
        new ReferenceExpression(optionInstance2.elemID, optionInstance2),
      ]
      orderInstance.value.options = [new ReferenceExpression(optionInstance2.elemID, optionInstance2)]
      changes = [toChange({ before, after: orderInstance })]
      const result = await validator(changes)
      expect(result).toEqual([
        {
          elemID: orderInstance.elemID,
          severity: 'Error',
          message: "This order is not referencing all it's options",
          detailedMessage:
            'The option jira.CustomFieldContextOption.instance.option was deleted from the order but was not removed',
        },
      ])
    })
    it('should return an error when a cascade option is deleted from the order but not removed', async () => {
      const cascadeOption1 = new InstanceElement('cascadeOption', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
      })
      const cascadeOption2 = new InstanceElement('cascadeOption2', optionType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
      })

      const cascadeOrder = new InstanceElement('cascadeOrder', orderType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
      })
      const before = cascadeOrder.clone()
      before.value.options = [
        new ReferenceExpression(cascadeOption1.elemID, cascadeOption1),
        new ReferenceExpression(cascadeOption2.elemID, cascadeOption2),
      ]
      changes = [toChange({ before, after: cascadeOrder })]
      const result = await validator(changes)
      expect(result).toEqual([
        {
          elemID: cascadeOrder.elemID,
          severity: 'Error',
          message: "This order is not referencing all it's options",
          detailedMessage:
            'The options jira.CustomFieldContextOption.instance.cascadeOption,jira.CustomFieldContextOption.instance.cascadeOption2 were deleted from the order but were not removed',
        },
      ])
    })
  })
})
