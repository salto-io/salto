/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import undeployableConfigFeaturesValidator from '../../src/change_validators/undeployable_config_features'

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
    const changeErrors = await undeployableConfigFeaturesValidator([
      toChange({ before: origInstance, after: instance }),
    ])
    expect(changeErrors).toHaveLength(0)
  })

  it('should have warning on change in undeployable feature', async () => {
    instance.value.SUITEAPPCONTROLCENTER = true
    const changeErrors = await undeployableConfigFeaturesValidator([
      toChange({ before: origInstance, after: instance }),
    ])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
  })
})
