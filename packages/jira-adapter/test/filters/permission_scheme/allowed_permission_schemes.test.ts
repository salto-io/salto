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
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JIRA, PERMISSION_SCHEME_TYPE_NAME } from '../../../src/constants'
import permissionSchemeFilter from '../../../src/filters/permission_scheme/allowed_permission_schemes'
import * as utils from '../../../src/filters/permission_scheme/omit_permissions_common'
import { getFilterParams } from '../../utils'

const omitChanges = jest.spyOn(utils, 'omitChanges')
const addBackPermissions = jest.spyOn(utils, 'addBackPermissions')
const mockGetAllowedPermissionTypes = jest.fn()
jest.mock('../../../src/change_validators/permission_type', () => ({
  ...jest.requireActual<{}>('../../../src/change_validators/permission_type'),
  getAllowedPermissionTypes: jest.fn(args => mockGetAllowedPermissionTypes(args)),
}))

describe('allowed permission scheme', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let elementsSource: ReadOnlyElementsSource
  let elements: InstanceElement[]
  let fullInstance: InstanceElement
  let partialInstance: InstanceElement
  const type = new ObjectType({
    elemID: new ElemID(JIRA, PERMISSION_SCHEME_TYPE_NAME),
  })
  beforeEach(async () => {
    jest.clearAllMocks()
    mockGetAllowedPermissionTypes.mockResolvedValue(new Set(['validPermission']))
    fullInstance = new InstanceElement('instance', type, {
      permissions: [
        {
          permission: 'validPermission',
        },
        {
          permission: 'invalidPermission',
        },
      ],
    })
    partialInstance = new InstanceElement('instance', type, {
      permissions: [
        {
          permission: 'validPermission',
        },
      ],
    })
    elements = [fullInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    const filterParams = Object.assign(getFilterParams(), { elementsSource })
    filter = permissionSchemeFilter(filterParams) as typeof filter
  })
  it('should remove invalid permissions in pre-deploy', async () => {
    const changes = [toChange({ after: fullInstance })]
    expect(filter.preDeploy).toBeDefined()
    if (filter.preDeploy) {
      expect(omitChanges).not.toHaveBeenCalled()
      await filter.preDeploy(changes)
      expect(omitChanges).toHaveNthReturnedWith(1, {
        'jira.PermissionScheme.instance.instance': [
          { permission: 'validPermission' },
          { permission: 'invalidPermission' },
        ],
      })
      expect(changes).toEqual([toChange({ after: partialInstance })])
    }
  })
  it('should put back invalid permissions after deploying', async () => {
    const changes = [toChange({ after: fullInstance })]
    expect(filter.preDeploy).toBeDefined()
    expect(filter.onDeploy).toBeDefined()
    if (filter.onDeploy && filter.preDeploy) {
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      expect(addBackPermissions).toHaveBeenCalledWith([expect.anything()], {
        'jira.PermissionScheme.instance.instance': [
          { permission: 'validPermission' },
          { permission: 'invalidPermission' },
        ],
      })
    }
  })
})
