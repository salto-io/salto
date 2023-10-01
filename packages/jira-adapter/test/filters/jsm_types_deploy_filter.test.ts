/*
*                      Copyright 2023 Salto Labs Ltd.
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
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import jsmTypesFilter from '../../src/filters/jsm_types_deploy_filter'
import { createEmptyType, getFilterParams } from '../utils'
import { CUSTOMER_PERMISSIONS_TYPE, PROJECT_TYPE } from '../../src/constants'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('jsmTypesDeployFilter', () => {
    type FilterType = filterUtils.FilterWith<'deploy'>
    let filter: FilterType
    const projectType = createEmptyType(PROJECT_TYPE)
    let projectInstance: InstanceElement
    const customerPermissionsType = createEmptyType(CUSTOMER_PERMISSIONS_TYPE)
    let customerPermissionsInstance: InstanceElement

    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      filter = jsmTypesFilter(getFilterParams({ config })) as typeof filter
      projectInstance = new InstanceElement(
        'project1',
        projectType,
        {
          id: 11111,
          name: 'project1',
          projectTypeKey: 'service_desk',
        },
      )
    })
    describe('deploy', () => {
      beforeEach(async () => {
        jest.clearAllMocks()
        customerPermissionsInstance = new InstanceElement(
          'customerPermissions1',
          customerPermissionsType,
          {
            id: 11111,
            manageEnabled: false,
            autocompleteEnabled: false,
            serviceDeskOpenAccess: true,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [
              new ReferenceExpression(projectInstance.elemID, projectInstance),
            ],
          },
        )
      })
      it('should pass the correct params to deployChange on update', async () => {
        const clonedCustomerPermissionsBefore = customerPermissionsInstance.clone()
        const clonedCustomerPermissionsAfter = customerPermissionsInstance.clone()
        clonedCustomerPermissionsAfter.value.serviceDeskOpenAccess = false
        mockDeployChange.mockImplementation(async () => ({}))
        const res = await filter
          .deploy([{ action: 'modify', data: { before: clonedCustomerPermissionsBefore, after: clonedCustomerPermissionsAfter } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.appliedChanges)
          .toEqual([
            {
              action: 'modify',
              data: { before: clonedCustomerPermissionsBefore, after: clonedCustomerPermissionsAfter },
            },
          ])
      })
      it('should not deploy if enableJSM is false', async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = false
        const clonedCustomerPermissionsBefore = customerPermissionsInstance.clone()
        const clonedCustomerPermissionsAfter = customerPermissionsInstance.clone()
        clonedCustomerPermissionsAfter.value.serviceDeskOpenAccess = false
        filter = jsmTypesFilter(getFilterParams({ config })) as typeof filter
        mockDeployChange.mockImplementation(async () => ({}))
        const res = await filter
          .deploy([{ action: 'modify', data: { before: clonedCustomerPermissionsBefore, after: clonedCustomerPermissionsAfter } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(0)
        expect(res.leftoverChanges).toHaveLength(1)
        expect(res.leftoverChanges)
          .toEqual([
            {
              action: 'modify',
              data: { before: clonedCustomerPermissionsBefore, after: clonedCustomerPermissionsAfter },
            },
          ])
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(0)
      })
    })
})
