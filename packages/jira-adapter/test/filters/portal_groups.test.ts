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

import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../src/config/config'
import portalGroupsFilter from '../../src/filters/portal_groups'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import { PORTAL_GROUP_TYPE, PROJECT_TYPE } from '../../src/constants'
import JiraClient from '../../src/client/client'

describe('queue filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>
  const projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
    id: 11111,
    name: 'project1',
    projectTypeKey: 'service_desk',
    key: 'project1Key',
  })
  const RequestTypeInstanceOne = new InstanceElement('requestType1', createEmptyType('requestType'), {
    id: 1,
  })
  const RequestTypeInstanceTwo = new InstanceElement('requestType2', createEmptyType('requestType'), {
    id: 2,
  })
  const RequestTypeInstanceThree = new InstanceElement('requestType3', createEmptyType('requestType'), {
    id: 3,
  })
  let portalGroupInstance: InstanceElement
  describe('deploy', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli, connection: conn } = mockClient(false)
      client = cli
      connection = conn
      filter = portalGroupsFilter(getFilterParams({ config, client })) as typeof filter
      portalGroupInstance = new InstanceElement(
        'portalGroup1',
        createEmptyType(PORTAL_GROUP_TYPE),
        {
          id: 11,
          name: 'portalGroup1',
          ticketTypeIds: [
            new ReferenceExpression(RequestTypeInstanceOne.elemID, RequestTypeInstanceOne),
            new ReferenceExpression(RequestTypeInstanceTwo.elemID, RequestTypeInstanceTwo),
            new ReferenceExpression(RequestTypeInstanceThree.elemID, RequestTypeInstanceThree),
          ],
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
    })
    it('should add portal group', async () => {
      const changes = [toChange({ after: portalGroupInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(1)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/servicedesk/1/servicedesk/11111/portal-groups',
        {
          id: 11,
          name: 'portalGroup1',
          ticketTypeIds: [{ id: 1 }, { id: 2 }, { id: 3 }],
        },
        undefined,
      )
    })
    it('should update portal group', async () => {
      const clonedPortalGroupAfter = portalGroupInstance.clone()
      clonedPortalGroupAfter.value.ticketTypeIds = [
        new ReferenceExpression(RequestTypeInstanceOne.elemID, RequestTypeInstanceOne),
        new ReferenceExpression(RequestTypeInstanceTwo.elemID, RequestTypeInstanceTwo),
      ]
      const changes = [toChange({ before: portalGroupInstance, after: clonedPortalGroupAfter })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/servicedesk/1/servicedesk/11111/portal-groups/11',
        {
          id: 11,
          name: 'portalGroup1',
          ticketTypeIds: [{ id: 1 }, { id: 2 }],
        },
        undefined,
      )
      expect(connection.post).toHaveBeenCalledTimes(1)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/servicedesk/1/servicedesk/11111/portal-groups/request-types',
        {
          groups: [
            {
              groupId: 11,
              ticketTypeIds: [1, 2],
            },
          ],
        },
        undefined,
      )
    })
    it('should delete portal group', async () => {
      const changes = [toChange({ before: portalGroupInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.delete).toHaveBeenCalledTimes(1)
    })
    it('should not deploy if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = portalGroupsFilter(getFilterParams({ config, client })) as typeof filter
      const changes = [toChange({ after: portalGroupInstance })]
      const res = await filter.deploy(changes)
      expect(res.leftoverChanges).toEqual(changes)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
