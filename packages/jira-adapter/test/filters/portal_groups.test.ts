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
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS, toChange } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import portalGroupsFilter from '../../src/filters/portal_groups'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import { JIRA, PORTAL_GROUP_TYPE, PROJECT_TYPE } from '../../src/constants'
import JiraClient from '../../src/client/client'


describe('queue filter', () => {
    type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
    let filter: FilterType
    let client: JiraClient
    const projectInstance = new InstanceElement(
      'project1',
      createEmptyType(PROJECT_TYPE),
      {
        id: 11111,
        name: 'project1',
        projectTypeKey: 'service_desk',
        key: 'project1Key',
      },
      [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1']
    )
    let portalGroupInstance: InstanceElement
    describe('pre deploy', () => {
      beforeEach(() => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        const { client: cli } = mockClient(true)
        client = cli
        filter = portalGroupsFilter(getFilterParams({ config, client })) as typeof filter
        portalGroupInstance = new InstanceElement(
          'queue1',
          createEmptyType(PORTAL_GROUP_TYPE),
          {
            id: 11,
            name: 'portalGroup1',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
          },
        )
      })
      it('should add ticketTypeIds to portalGroupInstance', async () => {
        const changes = [toChange({ after: portalGroupInstance })]
        await filter.preDeploy(changes)
        expect(portalGroupInstance.value.ticketTypeIds).toEqual([])
      })
      it('should add ticketTypeIds to portalGroupInstance when modifying', async () => {
        const portalGroupInstanceAfter = portalGroupInstance.clone()
        portalGroupInstanceAfter.value.name = 'portalGroup2'
        const changes = [toChange({ before: portalGroupInstance, after: portalGroupInstanceAfter })]
        await filter.preDeploy(changes)
        expect(portalGroupInstanceAfter.value.ticketTypeIds).toEqual([])
      })
      it('should not add ticketTypeIds to portalGroupInstance when enable JSM is false', async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = false
        filter = portalGroupsFilter(getFilterParams({ config, client })) as typeof filter
        const changes = [toChange({ after: portalGroupInstance })]
        await filter.preDeploy(changes)
        expect(portalGroupInstance.value.ticketTypeIds).toBeUndefined()
      })
    })
    describe('on deploy', () => {
      let portalGroupWithTicketTypeIds: InstanceElement
      beforeEach(() => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        const { client: cli } = mockClient(true)
        client = cli
        filter = portalGroupsFilter(getFilterParams({ config, client })) as typeof filter
        portalGroupInstance = new InstanceElement(
          'queue1',
          createEmptyType(PORTAL_GROUP_TYPE),
          {
            id: 11,
            name: 'portalGroup1',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
          },
        )
        portalGroupWithTicketTypeIds = portalGroupInstance.clone()
        portalGroupWithTicketTypeIds.value.ticketTypeIds = []
      })
      it('should remove ticketTypeIds from portalGroupInstance', async () => {
        const changes = [toChange({ after: portalGroupWithTicketTypeIds })]
        await filter.onDeploy(changes)
        expect(portalGroupInstance.value.ticketTypeIds).toBeUndefined()
      })
      it('should not remove ticketTypeIds from portalGroupInstance when enable JSM is false', async () => {
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = false
        filter = portalGroupsFilter(getFilterParams({ config, client })) as typeof filter
        const changes = [toChange({ after: portalGroupWithTicketTypeIds })]
        await filter.onDeploy(changes)
        expect(portalGroupWithTicketTypeIds.value.ticketTypeIds).toEqual([])
      })
    })
})
