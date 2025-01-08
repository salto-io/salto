/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/managed_apex_component'
import { mockInstances } from '../mock_elements'

describe('Managed Apex Components Change Validator', () => {
  const createInstance = (content: string): InstanceElement => {
    const instance = mockInstances().ApexClass.clone()
    instance.value.content = content
    return instance
  }
  it('should return error when instance has hidden content', async () => {
    const instanceWithHiddenContent = createInstance('(hidden)')
    const errors = await changeValidator([toChange({ after: instanceWithHiddenContent })])
    expect(errors).toHaveLength(1)
  })

  it('should not return error when instance has no hidden content', async () => {
    const instanceWithNoHiddenContent = createInstance('non hidden')
    const errors = await changeValidator([toChange({ after: instanceWithNoHiddenContent })])
    expect(errors).toBeEmpty()
  })
})
