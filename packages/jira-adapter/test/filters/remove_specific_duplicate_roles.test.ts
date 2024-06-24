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
import { InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { createEmptyType, getFilterParams } from '../utils'
import removeDuplicateProjectRoles from '../../src/filters/remove_specific_duplicate_roles'
import { Filter } from '../../src/filter'
import { getDefaultConfig } from '../../src/config/config'
import { PROJECT_ROLE_TYPE } from '../../src/constants'

const BUILT_IN_PROJECT_ROLE_NAME = 'atlassian-addons-project-access'

const type = createEmptyType(PROJECT_ROLE_TYPE)
const noBuiltIn = new InstanceElement('noBuiltIn', type, {
  id: 10000,
  name: 'noBuiltIn',
})

const builtIn1 = new InstanceElement('builtIn1', type, {
  id: 10001,
  name: BUILT_IN_PROJECT_ROLE_NAME,
})

const builtIn2 = new InstanceElement('builtIn2', type, {
  id: 10002,
  name: BUILT_IN_PROJECT_ROLE_NAME,
})

const builtIn3 = new InstanceElement('builtIn3', type, {
  id: 10003,
  name: BUILT_IN_PROJECT_ROLE_NAME,
})

describe('projectRoleRemoveTeamManagedDuplicatesFilter', () => {
  let filter: Filter
  beforeEach(async () => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.removeDuplicateProjectRoles = true
    filter = removeDuplicateProjectRoles(
      getFilterParams({
        config,
      }),
    )
  })
  it('should remove duplicate roles', async () => {
    const elements = [noBuiltIn, builtIn3, builtIn2, builtIn1]
    await filter.onFetch?.(elements)
    expect(elements).toHaveLength(2)
    expect(elements.map(e => e.elemID.name)).toEqual(['noBuiltIn', 'builtIn1'])
  })
  it('should not remove if single addOn role', async () => {
    const elements = [noBuiltIn, builtIn1]
    await filter.onFetch?.(elements)
    expect(elements).toHaveLength(2)
  })
  it('should not remove if no addOn roles', async () => {
    const elements = [noBuiltIn]
    await filter.onFetch?.(elements)
    expect(elements).toHaveLength(1)
  })
  it('should not remove duplicate roles if config is false', async () => {
    const configOff = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    configOff.fetch.removeDuplicateProjectRoles = false
    filter = removeDuplicateProjectRoles(
      getFilterParams({
        config: configOff,
      }),
    )
    const elements = [noBuiltIn, builtIn3, builtIn2, builtIn1]
    await filter.onFetch?.(elements)
    expect(elements).toHaveLength(4)
  })
})
