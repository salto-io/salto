/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, CORE_ANNOTATIONS, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { fieldContextOptionsValidator } from '../../../src/change_validators/field_contexts/field_context_options'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../../src/filters/fields/constants'
import { createEmptyType } from '../../utils'

describe('fieldContextOptionsValidator', () => {
  let changes: Change<InstanceElement>[] = []
  const optionType = createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME)
  const orderType = createEmptyType(OPTIONS_ORDER_TYPE_NAME)
  const contextInstance = new InstanceElement('context', createEmptyType(FIELD_CONTEXT_TYPE_NAME), {})
  let optionInstance: InstanceElement
  let orderInstance: InstanceElement

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
  })
  it('should return an empty array when no changes', async () => {
    const result = await fieldContextOptionsValidator(changes)
    expect(result).toEqual([])
  })

  it('should not return an error when the order contains the option', async () => {
    orderInstance.value.options = [new ReferenceExpression(optionInstance.elemID, optionInstance)]
    changes = [optionInstance, orderInstance].map(instance => toChange({ after: instance }))
    const result = await fieldContextOptionsValidator(changes)
    expect(result).toEqual([])
  })

  it('should return an error if there is no order change', async () => {
    changes = [toChange({ after: optionInstance })]
    const result = await fieldContextOptionsValidator(changes)
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
    const result = await fieldContextOptionsValidator(changes)
    expect(result).toEqual([
      {
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: "This option is not being referenced by it's corresponding order",
        detailedMessage: "The order instance context_order_child should reference all it's options",
      },
    ])
  })
  it('should return an error for cascading changes', async () => {
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
    const result = await fieldContextOptionsValidator(changes)
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
    const result = await fieldContextOptionsValidator(changes)
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
