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
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../src/config/config'
import portalSettingsFilter from '../../src/filters/portal_settings'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import { PORTAL_SETTINGS_TYPE_NAME, PROJECT_TYPE } from '../../src/constants'
import JiraClient from '../../src/client/client'

describe('portalSettings filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let connection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  let projectInstance: InstanceElement
  let portalSettingInstance: InstanceElement
  describe('deploy', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli, connection: conn } = mockClient(false)
      connection = conn
      client = cli
      filter = portalSettingsFilter(getFilterParams({ config, client })) as typeof filter
      projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
        id: 1,
        name: 'project1',
        projectTypeKey: 'service_desk',
        key: 'project1Key',
      })
      portalSettingInstance = new InstanceElement(
        'portalSettings',
        createEmptyType(PORTAL_SETTINGS_TYPE_NAME),
        {
          name: 'portalSettings',
          description: 'portalSettings description',
          announcementSettings: {
            canAgentsManagePortalAnnouncement: true,
          },
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
    })
    it('should deploy addition of a portal settings', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after: portalSettingInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      // One call to deploy name, one call to deploy description and one call to deploy announcementSettings.
      expect(connection.put).toHaveBeenCalledTimes(3)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/servicedesk/1/servicedesk-data/project1Key/name',
        {
          name: 'portalSettings',
        },
        undefined,
      )
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/servicedesk/1/servicedesk-data/project1Key/desc',
        {
          description: 'portalSettings description',
        },
        undefined,
      )
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/servicedesk/1/project1Key/settings/agent-announcements/enable',
        null,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    })
    it('should deploy modification of a portal settings name', async () => {
      const projectSettingsInstanceAfter = portalSettingInstance.clone()
      projectSettingsInstanceAfter.value.name = 'newName'
      const res = await filter.deploy([
        { action: 'modify', data: { before: portalSettingInstance, after: projectSettingsInstanceAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      // One call to deploy name.
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/servicedesk/1/servicedesk-data/project1Key/name',
        {
          name: 'newName',
        },
        undefined,
      )
    })
    it('should deploy modification of a portal settings description', async () => {
      const projectSettingsInstanceAfter = portalSettingInstance.clone()
      projectSettingsInstanceAfter.value.description = 'newDescription'
      const res = await filter.deploy([
        { action: 'modify', data: { before: portalSettingInstance, after: projectSettingsInstanceAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      // One call to deploy description.
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/servicedesk/1/servicedesk-data/project1Key/desc',
        {
          description: 'newDescription',
        },
        undefined,
      )
    })
    it('should deploy modification of a portal settings announcementSettings to false', async () => {
      const projectSettingsInstanceAfter = portalSettingInstance.clone()
      projectSettingsInstanceAfter.value.announcementSettings.canAgentsManagePortalAnnouncement = false
      const res = await filter.deploy([
        { action: 'modify', data: { before: portalSettingInstance, after: projectSettingsInstanceAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      // One call to deploy announcementSettings.
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/servicedesk/1/project1Key/settings/agent-announcements/disable',
        null,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    })
    it('should deploy modification of a portal settings announcementSettings to true', async () => {
      const projectSettingsInstanceAfter = portalSettingInstance.clone()
      projectSettingsInstanceAfter.value.announcementSettings.canAgentsManagePortalAnnouncement = true
      portalSettingInstance.value.announcementSettings.canAgentsManagePortalAnnouncement = false
      const res = await filter.deploy([
        { action: 'modify', data: { before: portalSettingInstance, after: projectSettingsInstanceAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      // One call to deploy announcementSettings.
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/servicedesk/1/project1Key/settings/agent-announcements/enable',
        null,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    })
    it('should handle errors', async () => {
      connection.put.mockRejectedValueOnce(new Error('error'))
      const res = await filter.deploy([{ action: 'add', data: { after: portalSettingInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        'Error: Failed to put /rest/servicedesk/1/servicedesk-data/project1Key/name with error: Error: error',
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should deploy removal of a portal settings', async () => {
      const res = await filter.deploy([{ action: 'remove', data: { before: portalSettingInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
    })
    it('should deploy only description if project setting has no canAgentsManagePortalAnnouncement', async () => {
      portalSettingInstance.value.announcementSettings = undefined
      const projectSettingsInstanceAfter = portalSettingInstance.clone()
      projectSettingsInstanceAfter.value.description = 'newDescription'
      const res = await filter.deploy([
        { action: 'modify', data: { before: portalSettingInstance, after: projectSettingsInstanceAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      // One call to deploy description.
      expect(connection.put).toHaveBeenCalledTimes(1)
    })
    it('should call three endpoints if it is addition change and announcementSettings is undefined', async () => {
      portalSettingInstance.value.announcementSettings = undefined
      const res = await filter.deploy([{ action: 'add', data: { after: portalSettingInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      // One call to deploy name and one call to deploy description.
      expect(connection.put).toHaveBeenCalledTimes(3)
    })
  })
})
