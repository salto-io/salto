/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { addressFormType } from '../../src/autogen/types/standard_types/addressForm'
import { roleType } from '../../src/autogen/types/standard_types/role'
import invalidValuesValidator from '../../src/change_validators/standard_types_invalid_values'
import { SCRIPT_ID } from '../../src/constants'
import { mockChangeValidatorParams } from '../utils'

describe('invalid values validator', () => {
  const origInstance = new InstanceElement('instance', roleType().type, {
    isinactive: false,
    [SCRIPT_ID]: 'customrole1009',
    name: 'workato_intg',
    subsidiaryoption: 'ALL',
  })
  let instance: InstanceElement

  beforeEach(() => {
    instance = origInstance.clone()
  })

  it("should not have ChangeError when deployoong a type that doesn't have invalid value", async () => {
    const anotherInstance = new InstanceElement('instance', addressFormType().type, {
      [SCRIPT_ID]: 'custform_2_t1440050_248',
      name: 'My Address Form',
    })

    const after = anotherInstance.clone()
    after.value.name = 'Changed'
    const changeErrors = await invalidValuesValidator(
      [toChange({ before: instance, after })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not have ChangeError when deploying an instance without invalid value', async () => {
    const after = instance.clone()
    after.value.subsidiaryoption = 'OWN'
    const changeErrors = await invalidValuesValidator(
      [toChange({ before: instance, after })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should have error ChangeError when modifying an invalid value', async () => {
    const after = instance.clone()
    after.value.subsidiaryoption = 'SELECTED'
    const changeErrors = await invalidValuesValidator(
      [toChange({ before: instance, after })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instance.elemID.createNestedID('subsidiaryoption'))
  })

  it('should not have error ChangeError when modifying an instance with unchanged invalid value', async () => {
    const before = instance.clone()
    const after = instance.clone()
    before.value.subsidiaryoption = 'SELECTED'
    after.value.subsidiaryoption = 'SELECTED'
    after.value.name = 'changed'
    const changeErrors = await invalidValuesValidator([toChange({ before, after })], mockChangeValidatorParams())
    expect(changeErrors).toHaveLength(0)
  })
})
