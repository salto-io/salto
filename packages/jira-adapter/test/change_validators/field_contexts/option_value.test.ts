/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, ChangeValidator, InstanceElement, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { FIELD_CONTEXT_OPTION_TYPE_NAME } from '../../../src/filters/fields/constants'
import { createEmptyType } from '../../utils'
import { optionValueValidator } from '../../../src/change_validators/field_contexts/option_value'

describe('optionValueValidator', () => {
  let config: JiraConfig
  let validator: ChangeValidator
  let changes: Change<InstanceElement>[] = []
  const optionType = createEmptyType(FIELD_CONTEXT_OPTION_TYPE_NAME)
  let optionInstance: InstanceElement
  beforeEach(() => {
    optionInstance = new InstanceElement('option', optionType, {})
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.splitFieldContextOptions = true
    validator = optionValueValidator(config)
    changes = []
  })
  it('should return no errors when feature flag is false', async () => {
    config.fetch.splitFieldContextOptions = false
    changes = [optionInstance].map(instance => toChange({ after: instance }))
    validator = optionValueValidator(config)
    expect(await validator(changes)).toHaveLength(0)
  })
  it('should return no errors when option value is defined', async () => {
    optionInstance.value.value = 'val'
    changes = [optionInstance].map(instance => toChange({ after: instance }))
    expect(await validator(changes)).toHaveLength(0)
  })
  it('should return an error when option value is not defined', async () => {
    changes = [optionInstance].map(instance => toChange({ after: instance }))
    expect(await validator(changes)).toEqual([
      {
        elemID: optionInstance.elemID,
        severity: 'Error',
        message: 'Option value must be defined',
        detailedMessage: "Cannot deploy a context option without the 'value' field",
      },
    ])
  })
})
