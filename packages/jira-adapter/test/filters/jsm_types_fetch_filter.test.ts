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
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, Element, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import jsmTypesFetchFilter from '../../src/filters/jsm_types_fetch_filter'
import { createEmptyType, getFilterParams } from '../utils'
import { CUSTOMER_PERMISSIONS_TYPE, PROJECT_TYPE } from '../../src/constants'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      defaultDeployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('jsmTypesFetchFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let elements: Element[]
  const projectType = createEmptyType(PROJECT_TYPE)
  let projectInstance: InstanceElement
  const customerPermissionsType = createEmptyType(CUSTOMER_PERMISSIONS_TYPE)
  let customerPermissionsInstance: InstanceElement

  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
    filter = jsmTypesFetchFilter(getFilterParams({ config })) as typeof filter
    projectInstance = new InstanceElement('project1', projectType, {
      id: 11111,
      name: 'project1',
      projectTypeKey: 'service_desk',
    })
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      customerPermissionsInstance = new InstanceElement('customerPermissions1', customerPermissionsType, {
        id: 11111,
        projectKey: new ReferenceExpression(projectInstance.elemID, projectInstance),
        manageEnabled: false,
        autocompleteEnabled: false,
        serviceDeskOpenAccess: true,
      })
      elements = [projectType, projectInstance, customerPermissionsType, customerPermissionsInstance]
    })
    it('should add project as parent and remove projectKey from customerPermissions', async () => {
      await filter.onFetch(elements)
      expect(customerPermissionsInstance.annotations[CORE_ANNOTATIONS.PARENT]).toEqual([
        new ReferenceExpression(projectInstance.elemID, projectInstance),
      ])
      expect(customerPermissionsInstance.value.projectKey).toBeUndefined()
    })
    it('should add deploy annotations to customer permissions type', async () => {
      await filter.onFetch(elements)
      expect(customerPermissionsType.annotations[CORE_ANNOTATIONS.CREATABLE]).toBe(true)
      expect(customerPermissionsType.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBe(true)
      expect(customerPermissionsType.annotations[CORE_ANNOTATIONS.DELETABLE]).toBe(true)
    })
    it('should do nothing if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = jsmTypesFetchFilter(getFilterParams({ config })) as typeof filter
      await filter.onFetch(elements)
      expect(customerPermissionsInstance.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
      expect(customerPermissionsInstance.value.projectKey).toEqual(
        new ReferenceExpression(projectInstance.elemID, projectInstance),
      )
    })
  })
})
