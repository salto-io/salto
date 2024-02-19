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
import { filterUtils } from '@salto-io/adapter-components'
import { InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import scriptRunnerInstanceDeploy from '../../../src/filters/script_runner/script_runner_instances_deploy'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { SCRIPTED_FIELD_TYPE } from '../../../src/constants'
import * as deployment from '../../../src/deployment/standard_deployment'

type FilterType = filterUtils.FilterWith<'deploy'>

describe('script_runner_instance_deploy', () => {
  let filter: FilterType
  let type: ObjectType
  let scriptInstance1: InstanceElement
  let scriptInstance2: InstanceElement
  let instance3: InstanceElement

  beforeEach(() => {
    type = createEmptyType(SCRIPTED_FIELD_TYPE)
    scriptInstance1 = new InstanceElement('instance', type)
    scriptInstance2 = new InstanceElement('instance2', type)
    instance3 = new InstanceElement('instance3', createEmptyType('type'))
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableScriptRunnerAddon = true
    filter = scriptRunnerInstanceDeploy(getFilterParams({ config })) as FilterType
    jest.spyOn(deployment, 'deployChanges').mockResolvedValueOnce({
      appliedChanges: [toChange({ after: scriptInstance1 })],
      errors: [{ message: '123', severity: 'Warning' }],
    })
  })
  it('should return correct applied changes and leftovers', async () => {
    const res = await filter.deploy([
      toChange({ after: scriptInstance1 }),
      toChange({ after: scriptInstance2 }),
      toChange({ after: instance3 }),
    ])
    expect(res.deployResult.appliedChanges).toEqual([toChange({ after: scriptInstance1 })])
    expect(res.deployResult.errors).toEqual([{ message: '123', severity: 'Warning' }])
    expect(res.leftoverChanges).toEqual([toChange({ after: instance3 })])
  })
  it('should return empty if no relevant changes', async () => {
    const res = await filter.deploy([toChange({ after: instance3 })])
    expect(res.deployResult.appliedChanges).toEqual([])
    expect(res.deployResult.errors).toEqual([])
    expect(res.leftoverChanges).toEqual([toChange({ after: instance3 })])
  })
  it('should not deploy if script runner is disabled', async () => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableScriptRunnerAddon = false
    filter = scriptRunnerInstanceDeploy(getFilterParams({ config })) as FilterType
    const res = await filter.deploy([
      toChange({ after: scriptInstance1 }),
      toChange({ after: scriptInstance2 }),
      toChange({ after: instance3 }),
    ])
    expect(res.deployResult.appliedChanges).toEqual([])
    expect(res.deployResult.errors).toEqual([])
    expect(res.leftoverChanges).toEqual([
      toChange({ after: scriptInstance1 }),
      toChange({ after: scriptInstance2 }),
      toChange({ after: instance3 }),
    ])
  })
})
