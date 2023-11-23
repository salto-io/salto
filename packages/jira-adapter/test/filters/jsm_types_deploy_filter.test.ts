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
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import jsmTypesFilter from '../../src/filters/jsm_types_deploy_filter'
import { createEmptyType, getFilterParams } from '../utils'
import { OBJECT_SCHEMA_TYPE, PORTAL_GROUP_TYPE, PROJECT_TYPE, QUEUE_TYPE } from '../../src/constants'

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

describe('jsmTypesDeployFilter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const projectType = createEmptyType(PROJECT_TYPE)
  let projectInstance: InstanceElement
  let portalGroupInstance: InstanceElement

  beforeEach(() => {
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
    filter = jsmTypesFilter(getFilterParams({ config })) as typeof filter
    projectInstance = new InstanceElement('project1', projectType, {
      id: 11111,
      name: 'project1',
      projectTypeKey: 'service_desk',
    })
  })
  describe('deploy', () => {
    let assetsSchemaInstance: InstanceElement
    beforeEach(async () => {
      jest.clearAllMocks()
      portalGroupInstance = new InstanceElement(
        'portalGroup1',
        createEmptyType(PORTAL_GROUP_TYPE),
        {
          id: 11111,
          name: 'portalGroup1',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      assetsSchemaInstance = new InstanceElement('assetsSchema1', createEmptyType(OBJECT_SCHEMA_TYPE), {
        name: 'assetsSchema1',
        objectSchemaKey: 'a1',
        status: 'Ok',
        description: 'test description',
        atlassianTemplateId: 'people_new',
        id: 5,
        workspaceId: 'wid12',
      })
    })
    it('should pass the correct params to deployChange on update', async () => {
      const clonedPortalGroupBefore = portalGroupInstance.clone()
      const clonedPortalGroupAfter = portalGroupInstance.clone()
      clonedPortalGroupAfter.value.serviceDeskOpenAccess = false
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedPortalGroupBefore, after: clonedPortalGroupAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
    it('should not deploy if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      const clonedPortalGroupBefore = portalGroupInstance.clone()
      const clonedPortalGroupAfter = portalGroupInstance.clone()
      clonedPortalGroupAfter.value.name = 'portalGroup2'
      filter = jsmTypesFilter(getFilterParams({ config })) as typeof filter
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedPortalGroupBefore, after: clonedPortalGroupAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.leftoverChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedPortalGroupBefore, after: clonedPortalGroupAfter },
        },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should deploy addition of queue types', async () => {
      const queueInstance = new InstanceElement('queue110', createEmptyType(QUEUE_TYPE), {
        id: 'q11',
        name: 'queue110',
      })
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'add', data: { after: queueInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
    it('should depoly additon of assets types', async () => {
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'add', data: { after: assetsSchemaInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
    it('should depoly remove of assets types', async () => {
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: assetsSchemaInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
  })
})
