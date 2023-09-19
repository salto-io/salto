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

import { filterUtils, elements as adapterElements } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import deleteCustomerPermissionsFilter from '../../src/filters/delete_customer_permissions_filter'
import { createEmptyType, getFilterParams } from '../utils'
import { CUSTOMER_PERMISSIONS_TYPE, JIRA, PROJECT_TYPE } from '../../src/constants'

describe('deleteCustomerPermissionsFilter', () => {
    type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
    let filter: FilterType
    const projectType = createEmptyType(PROJECT_TYPE)
    let projectInstance: InstanceElement
    const customerPermissionsType = createEmptyType(CUSTOMER_PERMISSIONS_TYPE)
    let customerPermissionsInstance: InstanceElement

    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      filter = deleteCustomerPermissionsFilter(getFilterParams({ config })) as typeof filter
      projectInstance = new InstanceElement(
        'project1',
        projectType,
        {
          id: 11111,
          name: 'project1',
          projectTypeKey: 'service_desk',
        },
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1']
      )
    })
    describe('deploy', () => {
      beforeEach(async () => {
        customerPermissionsInstance = new InstanceElement(
          'customerPermissions1',
          customerPermissionsType,
          {
            id: 11111,
            projectKey: new ReferenceExpression(projectInstance.elemID, projectInstance),
            manageEnabled: false,
            autocompleteEnabled: false,
            serviceDeskOpenAccess: true,
          },
        )
      })
      it('should delete customer permissions when its parent project is deleted', async () => {
        const { deployResult, leftoverChanges } = await filter.deploy(
          [toChange({ before: customerPermissionsInstance })]
        )
        expect(deployResult.errors).toHaveLength(0)
        expect(deployResult.appliedChanges).toHaveLength(1)
        expect(leftoverChanges).toHaveLength(0)
      })
      it('should not delete customer permissions when enableJSM is false', async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = false
        filter = deleteCustomerPermissionsFilter(getFilterParams({ config })) as typeof filter
        const { deployResult, leftoverChanges } = await filter.deploy(
          [toChange({ before: customerPermissionsInstance })]
        )
        expect(deployResult.errors).toHaveLength(0)
        expect(deployResult.appliedChanges).toHaveLength(0)
        expect(leftoverChanges).toHaveLength(1)
      })
    })
})
