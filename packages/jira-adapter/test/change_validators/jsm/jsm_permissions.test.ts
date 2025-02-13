/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { CORE_ANNOTATIONS, InstanceElement, ReferenceExpression, SeverityLevel, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { PROJECT_TYPE, QUEUE_TYPE } from '../../../src/constants'
import { createEmptyType, mockClient } from '../../utils'
import { jsmPermissionsValidator } from '../../../src/change_validators/jsm/jsm_permissions'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'
import JiraClient from '../../../src/client/client'

describe('jsmPermissionsValidator', () => {
  let projectInstance: InstanceElement
  const queueType = createEmptyType(QUEUE_TYPE)
  let queueInstance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let mockConnection: MockInterface<clientUtils.APIConnection>
  describe('with JSM enabled', () => {
    beforeEach(async () => {
      const mockCli = mockClient()
      mockConnection = mockCli.connection
      client = mockCli.client
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          applications: [
            {
              id: 'jira-software',
              plan: 'FREE',
            },
            {
              id: 'other-app',
              plan: 'PAID',
            },
            {
              id: 'jira-servicedesk',
              plan: 'FREE',
            },
          ],
        },
      })
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          size: 1,
          start: 0,
          limit: 50,
          isLastPage: true,
          _links: {},
          values: [
            {
              id: '10',
              projectId: '111',
              projectKey: 'SD',
              projectName: 'Service Desk',
            },
          ],
        },
      })
      projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
        id: '111',
        name: 'project1',
        projectTypeKey: 'service_desk',
      })
      queueInstance = new InstanceElement(
        'queue1',
        queueType,
        {
          id: 22,
          name: 'queue1',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
    })
    it('should return error if trying to deploy Jsm type without permissions', async () => {
      const validator = jsmPermissionsValidator(config, client)
      const projectWithoutJsmPermissions = projectInstance.clone()
      projectWithoutJsmPermissions.value.id = '44'
      queueInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(projectWithoutJsmPermissions.elemID, projectWithoutJsmPermissions),
      ]
      const changeErrors = await validator([toChange({ before: queueInstance })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0]).toEqual({
        elemID: queueInstance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Lacking permissions to update a JSM project',
        detailedMessage:
          "Cannot deploy queue1 since it is part of a project to which you do not have permissions to. Add user to project's permissions and try again.",
      })
    })
    it('should not return error if trying to deploy Jsm type without valid parent', async () => {
      const validator = jsmPermissionsValidator(config, client)
      queueInstance.annotations[CORE_ANNOTATIONS.PARENT] = ['weirdParent']
      const changeErrors = await validator([toChange({ before: queueInstance })])
      expect(changeErrors).toHaveLength(0)
    })
    it('should not return error if trying to deploy Jsm type with permissions', async () => {
      const validator = jsmPermissionsValidator(config, client)
      const changeErrors = await validator([toChange({ before: queueInstance })])
      expect(changeErrors).toHaveLength(0)
    })
    it('should not return error if trying to deploy Jsm type with its associated project', async () => {
      const validator = jsmPermissionsValidator(config, client)
      projectInstance.value.id = '44'
      const changeErrors = await validator([toChange({ after: queueInstance }), toChange({ after: projectInstance })])
      expect(changeErrors).toHaveLength(0)
    })
  })
  describe('with JSM disabled', () => {
    beforeEach(async () => {
      const mockCli = mockClient()
      mockConnection = mockCli.connection
      client = mockCli.client
      mockConnection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          applications: [
            {
              id: 'jira-software',
              plan: 'FREE',
            },
            {
              id: 'other-app',
              plan: 'PAID',
            },
          ],
        },
      })
      mockConnection.get.mockRejectedValue(new clientUtils.HTTPError('failed', { data: {}, status: 403 }))
      projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
        id: '111',
        name: 'project1',
        projectTypeKey: 'service_desk',
      })
      queueInstance = new InstanceElement(
        'queue1',
        queueType,
        {
          id: 22,
          name: 'queue1',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
    })
    it('should not return error if JSM is disabled', async () => {
      const validator = jsmPermissionsValidator(config, client)
      config.fetch.enableJSM = true
      const changeErrors = await validator([toChange({ before: queueInstance })])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
