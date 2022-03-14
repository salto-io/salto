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
import { Change, ElemID, getChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/account_features'
import { FeaturesDeployError } from '../../src/errors'
import { featuresType } from '../../src/types/configuration_types'

const getChange = (): Change<InstanceElement> => {
  const before = new InstanceElement(
    ElemID.CONFIG_NAME,
    featuresType().accountFeatures,
    {
      features: {
        ABC: { label: 'label1', id: 'ABC', status: 'DISABLED' },
        DEF: { label: 'label2', id: 'DEF', status: 'DISABLED' },
      },
    }
  )
  const after = new InstanceElement(
    ElemID.CONFIG_NAME,
    featuresType().accountFeatures,
    {
      features: {
        ABC: { label: 'label1', id: 'ABC', status: 'ENABLED' },
        DEF: { label: 'label2', id: 'DEF', status: 'ENABLED' },
      },
    }
  )
  return toChange({ before, after })
}

describe('account features filter', () => {
  it('should succeed', async () => {
    const change = getChange()
    await filterCreator().onDeploy([change], { errors: [new Error('error')], appliedChanges: [] })
    expect(getChangeData(change).value).toEqual({
      features: {
        ABC: { label: 'label1', id: 'ABC', status: 'ENABLED' },
        DEF: { label: 'label2', id: 'DEF', status: 'ENABLED' },
      },
    })
  })
  it('should restore failed to deploy features', async () => {
    const change = getChange()
    await filterCreator().onDeploy([change], { errors: [new FeaturesDeployError('error', ['ABC'])], appliedChanges: [] })
    expect(getChangeData(change).value).toEqual({
      features: {
        ABC: { label: 'label1', id: 'ABC', status: 'DISABLED' },
        DEF: { label: 'label2', id: 'DEF', status: 'ENABLED' },
      },
    })
  })
})
