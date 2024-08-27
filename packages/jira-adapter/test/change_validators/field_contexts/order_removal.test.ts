/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeValidator,
  CORE_ANNOTATIONS,
  InstanceElement,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { fieldContextOrderRemovalValidator } from '../../../src/change_validators/field_contexts/order_removal'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  OPTIONS_ORDER_TYPE_NAME,
} from '../../../src/filters/fields/constants'
import { createEmptyType } from '../../utils'

describe('fieldContextOptionsValidator', () => {
  const contextInstance = new InstanceElement('context', createEmptyType(FIELD_CONTEXT_TYPE_NAME), {})
  const optionInstance = new InstanceElement('option', createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME), {})
  let orderInstance: InstanceElement
  let config: JiraConfig
  let validator: ChangeValidator
  beforeEach(() => {
    orderInstance = new InstanceElement(
      'order',
      createEmptyType(OPTIONS_ORDER_TYPE_NAME),
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
    validator = fieldContextOrderRemovalValidator(config)
  })
  it('should return no errors when feature flag is false', async () => {
    config.fetch.splitFieldContextOptions = false
    const changes = [toChange({ before: orderInstance })]
    const errors = await validator(changes)
    expect(errors).toHaveLength(0)
  })
  it("should return no errors when the order is removed with it's context parent", async () => {
    const changes = [toChange({ before: contextInstance }), toChange({ before: orderInstance })]
    const errors = await validator(changes)
    expect(errors).toHaveLength(0)
  })
  it("should return no errors when the order is removed with it's option parent", async () => {
    orderInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(optionInstance.elemID, optionInstance),
    ]
    const changes = [toChange({ before: optionInstance }), toChange({ before: orderInstance })]
    const errors = await validator(changes)
    expect(errors).toHaveLength(0)
  })
  it("should return an error when the order is removed without it's parent", async () => {
    const changes = [toChange({ before: orderInstance })]
    const errors = await validator(changes)
    expect(errors).toEqual([
      {
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: "This order was removed while it's parent wasn't",
        detailedMessage: "Order should be removed with it's parent",
      },
    ])
  })
  it('should throw an error when the order does not have a parent', async () => {
    delete orderInstance.annotations[CORE_ANNOTATIONS.PARENT]
    const changes = [toChange({ before: orderInstance })]
    await expect(validator(changes)).rejects.toThrow()
  })
})
