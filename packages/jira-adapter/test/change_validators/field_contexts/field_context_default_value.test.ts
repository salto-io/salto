/*
 * Copyright 2025 Salto Labs Ltd.
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
import { fieldContextDefaultValueValidator } from '../../../src/change_validators/field_contexts/field_context_default_value'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'
import { createEmptyType } from '../../utils'

describe('fieldContextDefaultValueValidator', () => {
  const optionType = createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME)
  const contextType = createEmptyType(FIELD_CONTEXT_TYPE_NAME)
  let optionInstance: InstanceElement
  let cascadeOptionInstance: InstanceElement
  let contextInstance: InstanceElement
  let config: JiraConfig
  let validator: ChangeValidator

  beforeEach(() => {
    contextInstance = new InstanceElement('context', contextType, {})
    optionInstance = new InstanceElement('option', optionType, {}, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
    })
    cascadeOptionInstance = new InstanceElement('cascadeOption', optionType, {}, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(optionInstance.elemID, optionInstance)],
    })
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldContextOptions = true
    validator = fieldContextDefaultValueValidator(config)
  })
  it('should not return errors when the feature flag is false', async () => {
    config.fetch.splitFieldContextOptions = false
    contextInstance.value.defaultValue = {
      cascadingOptionId: new ReferenceExpression(cascadeOptionInstance.elemID, cascadeOptionInstance),
    }
    validator = fieldContextDefaultValueValidator(config)
    const change = toChange({ after: contextInstance })
    const errors = await validator([change])
    expect(errors).toHaveLength(0)
  })
  it('should not return errors for valid default value', async () => {
    contextInstance.value.defaultValue = {
      optionId: new ReferenceExpression(optionInstance.elemID, optionInstance),
      cascadingOptionId: new ReferenceExpression(cascadeOptionInstance.elemID, cascadeOptionInstance),
    }
    const change = toChange({ after: contextInstance })
    const errors = await validator([change])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when the default cascading option is undefined', async () => {
    contextInstance.value.defaultValue = {
      optionId: new ReferenceExpression(optionInstance.elemID, optionInstance),
    }
    const change = toChange({ after: contextInstance })
    const errors = await validator([change])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when the default value is undefined', async () => {
    const change = toChange({ after: contextInstance })
    const errors = await validator([change])
    expect(errors).toHaveLength(0)
  })
  it('should throw an error when the default cascading option does not have a parent', async () => {
    contextInstance.value.defaultValue = {
      optionId: new ReferenceExpression(optionInstance.elemID, optionInstance),
      cascadingOptionId: new ReferenceExpression(cascadeOptionInstance.elemID, cascadeOptionInstance),
    }
    cascadeOptionInstance.annotations[CORE_ANNOTATIONS.PARENT] = undefined
    const change = toChange({ after: contextInstance })
    await expect(validator([change])).rejects.toThrow()
  })
  it('should return an error when the default option is not the parent of the default cascading option', async () => {
    contextInstance.value.defaultValue = {
      optionId: new ReferenceExpression(cascadeOptionInstance.elemID, cascadeOptionInstance),
      cascadingOptionId: new ReferenceExpression(cascadeOptionInstance.elemID, cascadeOptionInstance),
    }
    const change = toChange({ after: contextInstance })
    const errors = await validator([change])
    expect(errors).toEqual([
      {
        elemID: contextInstance.elemID,
        severity: 'Error',
        message: "Default value's references are not valid",
        detailedMessage: 'The context default value option must reference the parent of the default cascading option',
      },
    ])
  })
  it('should return an error when there is only default cascading option', async () => {
    contextInstance.value.defaultValue = {
      cascadingOptionId: new ReferenceExpression(cascadeOptionInstance.elemID, cascadeOptionInstance),
    }
    const change = toChange({ after: contextInstance })
    const errors = await validator([change])
    expect(errors).toEqual([
      {
        elemID: contextInstance.elemID,
        severity: 'Error',
        message: "Default value's references are not valid",
        detailedMessage: 'The context default value option must reference the parent of the default cascading option',
      },
    ])
  })
})
