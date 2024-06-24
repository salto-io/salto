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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import behaviorFieldUuidFilter from '../../../src/filters/script_runner/behaviors_field_uuid'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { BEHAVIOR_TYPE, SCRIPTED_FIELD_TYPE } from '../../../src/constants'

type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('my-uuid'),
}))

describe('behavior_field_uuid', () => {
  let filter: FilterType
  let instance: InstanceElement
  describe('when script runner is enabled', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = true
      filter = behaviorFieldUuidFilter(getFilterParams({ config })) as FilterType
    })
    it('should add uuids', async () => {
      instance = new InstanceElement('instance', createEmptyType(BEHAVIOR_TYPE), {
        config: [
          {
            name: 'name',
          },
          {
            name: 'name2',
          },
        ],
      })
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.config[0].fieldUuid).toEqual('my-uuid')
      expect(instance.value.config[1].fieldUuid).toEqual('my-uuid')
    })
    it('should remove uuid', async () => {
      instance = new InstanceElement('instance', createEmptyType(BEHAVIOR_TYPE), {
        config: [
          {
            name: 'name',
            fieldUuid: 'my-uuid',
          },
          {
            name: 'name2',
            fieldUuid: 'my-uuid2',
          },
        ],
      })
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.config[0].fieldUuid).toBeUndefined()
      expect(instance.value.config[1].fieldUuid).toBeUndefined()
    })
    it('should not fail when no config', async () => {
      instance = new InstanceElement('instance', createEmptyType(BEHAVIOR_TYPE), {})
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.config).toBeUndefined()
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.config).toBeUndefined()
    })
  })
  describe('when script runner is disabled', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = false
      filter = behaviorFieldUuidFilter(getFilterParams({ config })) as FilterType
    })
    it('should not add uuid on deploy', async () => {
      instance = new InstanceElement('instance', createEmptyType(SCRIPTED_FIELD_TYPE), {
        config: [
          {
            name: 'name',
          },
          {
            name: 'name2',
          },
        ],
      })
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.auditData).toBeUndefined()
    })
  })
})
