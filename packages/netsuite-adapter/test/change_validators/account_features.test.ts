/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { ElemID, InstanceElement, toChange } from '@salto-io/adapter-api'
import { featuresType } from '../../src/types/configuration_types'
import accountFeaturesObjectValidator from '../../src/change_validators/account_features'

describe('account feautures validator', () => {
  const origInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    featuresType().accountFeatures,
    {
      features: {
        ABC: { label: 'label1', id: 'ABC', status: 'DISABLED' },
        DEF: { label: 'label2', id: 'DEF', status: 'DISABLED' },
      },
    }
  )
  let instance: InstanceElement

  beforeEach(() => {
    instance = origInstance.clone()
  })

  it('should not have errors', async () => {
    instance.value.features.ABC.status = 'ENABLED'
    const changeErrors = await accountFeaturesObjectValidator(
      [toChange({ before: origInstance, after: instance })]
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('should have errors on addition and removal', async () => {
    const changeErrors = await accountFeaturesObjectValidator(
      [toChange({ before: origInstance }), toChange({ after: origInstance })]
    )
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[1].severity).toEqual('Error')
  })

  it('should have errors on adding/removing features', async () => {
    instance.value.features.NEW = { label: 'new', id: 'NEW', status: 'ENABLED' }
    const changeErrors = await accountFeaturesObjectValidator(
      [toChange({ before: origInstance, after: instance })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
  })

  it('should have errors on change in wrong field', async () => {
    instance.value.features.ABC.label = 'changed'
    const changeErrors = await accountFeaturesObjectValidator(
      [toChange({ before: origInstance, after: instance })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
  })

  it('should have errors on change to invalid value', async () => {
    instance.value.features.ABC.status = 'invalid'
    const changeErrors = await accountFeaturesObjectValidator(
      [toChange({ before: origInstance, after: instance })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
  })

  it('should have warning on change in undeployable feature', async () => {
    instance.value.features.SUITEAPPCONTROLCENTER = {
      label: 'SuiteApp Control Center',
      id: 'SUITEAPPCONTROLCENTER',
      status: 'DISABLED',
    }
    const changed = instance.clone()
    changed.value.features.SUITEAPPCONTROLCENTER.status = 'ENABLED'
    const changeErrors = await accountFeaturesObjectValidator(
      [toChange({ before: instance, after: changed })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
  })
})
