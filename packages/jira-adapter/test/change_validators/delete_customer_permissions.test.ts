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

import { CORE_ANNOTATIONS, InstanceElement, ReferenceExpression, SeverityLevel, toChange } from '@salto-io/adapter-api'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { PROJECT_TYPE, CUSTOMER_PERMISSIONS_TYPE, JIRA } from '../../src/constants'
import { createEmptyType } from '../utils'
import { deleteCustomerPermissionValidator } from '../../src/change_validators/delete_customer_permissions'

describe('deleteCustomerPermissionsValidator', () => {
  const projectType = createEmptyType(PROJECT_TYPE)
  let projectInstance: InstanceElement
  const customerPermissionsType = createEmptyType(CUSTOMER_PERMISSIONS_TYPE)
  let customerPermissionsInstance: InstanceElement
  const elementsSource = buildElementsSourceFromElements([])

  beforeEach(async () => {
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
  it('should return error if trying to remove customer permissions without its parent project', async () => {
    const changes = [
      toChange({ before: customerPermissionsInstance }),
    ]
    expect(await deleteCustomerPermissionValidator(
      changes,
      elementsSource
    )).toEqual([
      {
        elemID: customerPermissionsInstance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Cannot delete Customer Permissions while their associated project is still in use.',
        detailedMessage: 'Cannot delete Customer Permissions customerPermissions1 because their associated project project1 is still in use.',
      },
    ])
  })
  it('should not return error if trying to remove customer permissions with its parent project', async () => {
    const changes = [
      toChange({ before: customerPermissionsInstance }),
      toChange({ before: projectInstance }),
    ]
    expect(await deleteCustomerPermissionValidator(
      changes,
      elementsSource
    )).toEqual([])
  })
})
