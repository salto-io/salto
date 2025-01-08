/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, toChange } from '@salto-io/adapter-api'
import { featuresType } from '../../src/types/configuration_types'
import undeployableConfigFeaturesValidator from '../../src/change_validators/undeployable_config_features'
import { mockChangeValidatorParams } from '../utils'

describe('undeployable config feautures validator', () => {
  const origInstance = new InstanceElement(ElemID.CONFIG_NAME, featuresType(), {
    ABC: true,
    SUITEAPPCONTROLCENTER: false,
  })
  let instance: InstanceElement

  beforeEach(() => {
    instance = origInstance.clone()
  })

  it('should not have errors', async () => {
    instance.value.ABC = false
    const changeErrors = await undeployableConfigFeaturesValidator(
      [toChange({ before: origInstance, after: instance })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should have warning on change in undeployable feature', async () => {
    instance.value.SUITEAPPCONTROLCENTER = true
    const changeErrors = await undeployableConfigFeaturesValidator(
      [toChange({ before: origInstance, after: instance })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
  })
})
