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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JIRA } from '../../../src/constants'
import deployPermissionScheme from '../../../src/filters/permission_scheme/deploy_permission_scheme_filter'
import { createEmptyType, getFilterParams, getLicenseElementSource } from '../../utils'

describe('deploy permission scheme', () => {
  let filter: filterUtils.FilterWith<'deploy'>
  const schemeType = new ObjectType({
    elemID: new ElemID(JIRA, 'PermissionScheme'),
  })
  const otherType = new ObjectType({
    elemID: new ElemID(JIRA, 'Other'),
  })
  const instances = [
    new InstanceElement('instance1', schemeType, {}),
    new InstanceElement('instance2', otherType, {}),
    new InstanceElement('instance3', schemeType, {}),
  ]
  const changes = instances.map(instance => toChange({ after: instance }))
  const otherChanges = [toChange({ before: instances[0] }), toChange({ before: instances[0], after: instances[2] })]

  beforeEach(async () => {
    const elementsSource = getLicenseElementSource(true)
    filter = deployPermissionScheme(getFilterParams({ elementsSource })) as typeof filter
  })
  it('should deploy of addition schemes on free license', async () => {
    const { deployResult, leftoverChanges } = await filter.deploy(changes)
    expect(deployResult).toEqual({
      appliedChanges: [changes[0], changes[2]],
      errors: [],
    })
    expect(leftoverChanges).toEqual([changes[1]])
  })
  it('should not deploy removal and modification schemes on free license', async () => {
    const { deployResult, leftoverChanges } = await filter.deploy(otherChanges)
    expect(deployResult).toEqual({
      appliedChanges: [],
      errors: [],
    })
    expect(leftoverChanges).toEqual(otherChanges)
  })
  it('should not deploy on paid license', async () => {
    const elementsSource = getLicenseElementSource(false)
    filter = deployPermissionScheme(getFilterParams({ elementsSource })) as typeof filter
    const { deployResult, leftoverChanges } = await filter.deploy(changes)
    expect(deployResult).toEqual({
      appliedChanges: [],
      errors: [],
    })
    expect(leftoverChanges).toEqual(changes)
  })
  it('should not deploy on paid license due to account info with some paid app', async () => {
    const accountInfoWithSomePaidApp = new InstanceElement('_config', createEmptyType('AccountInfo'), {
      license: {
        applications: [
          {
            id: 'jira-serviceDesk',
            plan: 'PAID',
          },
          {
            id: 'jira-software',
            plan: 'FREE',
          },
        ],
      },
    })
    const elementsSource = buildElementsSourceFromElements([accountInfoWithSomePaidApp])
    filter = deployPermissionScheme(getFilterParams({ elementsSource })) as typeof filter
    const { deployResult, leftoverChanges } = await filter.deploy(changes)
    expect(deployResult).toEqual({
      appliedChanges: [],
      errors: [],
    })
    expect(leftoverChanges).toEqual(changes)
  })
  it('should not deploy on paid license due to missing account info', async () => {
    const elementsSource = buildElementsSourceFromElements([])
    filter = deployPermissionScheme(getFilterParams({ elementsSource })) as typeof filter
    const { deployResult, leftoverChanges } = await filter.deploy(changes)
    expect(deployResult).toEqual({
      appliedChanges: [],
      errors: [],
    })
    expect(leftoverChanges).toEqual(changes)
  })
  it('should not deploy on dc', async () => {
    filter = deployPermissionScheme(getFilterParams(undefined, true)) as typeof filter
    const { deployResult, leftoverChanges } = await filter.deploy(changes)
    expect(deployResult).toEqual({
      appliedChanges: [],
      errors: [],
    })
    expect(leftoverChanges).toEqual(changes)
  })
})
