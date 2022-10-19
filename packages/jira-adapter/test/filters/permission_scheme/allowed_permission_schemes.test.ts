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
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JIRA, PERMISSIONS, PERMISSION_SCHEME_TYPE_NAME } from '../../../src/constants'
import permissionSchemeFilter from '../../../src/filters/permission_scheme/allowed_permission_schemes'
import { getFilterParams } from '../../utils'

const mockDefaultDeployChange = jest.fn()

jest.mock('../../../src/deployment/standard_deployment', () => ({
  ...jest.requireActual<{}>('../../../src/deployment/standard_deployment'),
  defaultDeployChange: jest.fn((...args) => mockDefaultDeployChange(args)),
}))
describe('allowed permission scheme', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let elementsSource: ReadOnlyElementsSource
  let elements: InstanceElement[]
  const type = new ObjectType({
    elemID: new ElemID(JIRA, PERMISSION_SCHEME_TYPE_NAME),
  })
  const instance = new InstanceElement(
    'instance',
    type,
    {
      permissions: [
        {
          permission: 'validPermission',
        },
        {
          permission: 'invalidPermission',
        },
      ],
    }
  )
  const permissionObject = new ObjectType({ elemID: new ElemID(JIRA, PERMISSIONS) })
  const permissionsInstance = new InstanceElement('permissions', permissionObject, {
    additionalProperties: [
      {
        key: 'validPermission',
      },
    ],
  })
  beforeEach(async () => {
    elements = [permissionsInstance, instance]
    elementsSource = buildElementsSourceFromElements(elements)
    const filterParams = Object.assign(getFilterParams(), { elementsSource })
    filter = permissionSchemeFilter(filterParams) as typeof filter
  })
  it('should deploy instance without invalid permissions', async () => {
    if (filter.deploy) {
      await filter.deploy([toChange({ after: instance })])
      expect(mockDefaultDeployChange)
        .toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining({
            change: expect.objectContaining({
              data: expect.objectContaining({
                after: expect.objectContaining({
                  value: {
                    permissions: [
                      { permission: 'validPermission' },
                    ],
                  },
                }),
              }),
            }),
          }),
        ]))
    }
  })
})
