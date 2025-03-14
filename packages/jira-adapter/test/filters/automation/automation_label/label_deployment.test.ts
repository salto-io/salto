/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getChangeData, InstanceElement, ObjectType, CORE_ANNOTATIONS, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../../utils'
import automationLabelDeploymentFilter from '../../../../src/filters/automation/automation_label/label_deployment'
import { createAutomationLabelType } from '../../../../src/filters/automation/automation_label/types'
import { getDefaultConfig, JiraConfig } from '../../../../src/config/config'
import JiraClient from '../../../../src/client/client'

describe('automationLabelDeploymentFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let automationLabelType: ObjectType
  let automationLabelInstance: InstanceElement
  let changedInstance: InstanceElement
  let config: JiraConfig
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>

  beforeEach(async () => {
    const { client: cli, paginator, connection: conn } = mockClient(false)
    client = cli
    connection = conn

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = automationLabelDeploymentFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as filterUtils.FilterWith<'onFetch' | 'deploy'>

    automationLabelType = createAutomationLabelType()

    automationLabelInstance = new InstanceElement('labelName', automationLabelType, {
      name: 'labelName',
      color: 'color',
    })
    changedInstance = new InstanceElement('labelName', automationLabelType, {
      id: 555,
      name: 'labelName',
      color: 'other color',
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations', async () => {
      await filter.onFetch([automationLabelType])

      expect(automationLabelType.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(automationLabelType.fields.name.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
      expect(automationLabelType.fields.color.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should not add deployment annotations if usePrivateAPI is false', async () => {
      config.client.usePrivateAPI = false

      await filter.onFetch([automationLabelType])

      expect(automationLabelType.annotations).toEqual({})
      expect(automationLabelType.fields.name.annotations).toEqual({})
    })

    it('should not add deployment annotations if type not found', async () => {
      await filter.onFetch([])
      expect(automationLabelType.annotations).toEqual({})
      expect(automationLabelType.fields.name.annotations).toEqual({})
    })
  })

  describe('deploy', () => {
    beforeEach(() => {
      connection.post.mockImplementation(async url => {
        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule-labels') {
          return {
            status: 200,
            data: { ...automationLabelInstance.value, id: 555 },
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
    })
    it('should create automation label', async () => {
      await filter.onFetch([automationLabelType])
      await filter.deploy([toChange({ after: automationLabelInstance })])

      expect(automationLabelInstance.value.id).toBe(555)
      expect(connection.post).toHaveBeenCalledTimes(1)
      expect(connection.post).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule-labels',
        { name: automationLabelInstance.value.name, color: automationLabelInstance.value.color },
        undefined,
      )
    })

    it('should create automation label in jira DC', async () => {
      const { client: cli, connection: conn } = mockClient(true)
      client = cli
      connection = conn

      connection.post.mockImplementation(async url => {
        if (url === '/rest/cb-automation/latest/rule-label') {
          return {
            status: 200,
            data: { ...automationLabelInstance.value, id: 555 },
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })

      filter = automationLabelDeploymentFilter(
        getFilterParams({
          client,
        }),
      ) as filterUtils.FilterWith<'onFetch' | 'deploy'>

      await filter.onFetch([automationLabelType])
      await filter.deploy([toChange({ after: automationLabelInstance })])

      expect(automationLabelInstance.value.id).toBe(555)
      expect(connection.post).toHaveBeenCalledTimes(1)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/cb-automation/latest/rule-label',
        {
          name: automationLabelInstance.value.name,
          color: automationLabelInstance.value.color,
        },
        undefined,
      )
    })

    it('should throw if received invalid automation label response', async () => {
      connection.post.mockImplementation(async url => {
        if (url === '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule-labels') {
          return {
            status: 200,
            data: { ...automationLabelInstance.value },
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      const { deployResult } = await filter.deploy([toChange({ after: automationLabelInstance })])
      expect(deployResult.errors).toHaveLength(1)
    })

    it('should modify automation label', async () => {
      automationLabelInstance.value.id = 555
      const { deployResult } = await filter.deploy([
        toChange({ before: automationLabelInstance, after: changedInstance }),
      ])
      expect(deployResult.appliedChanges).toHaveLength(1)
      expect(getChangeData(deployResult.appliedChanges[0])).toEqual(changedInstance)
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/gateway/api/automation/internal-api/jira/cloudId/pro/rest/GLOBAL/rule-labels/555',
        { ...changedInstance.value },
        undefined,
      )
    })

    it('should modify automation label in jira DC', async () => {
      const { client: cli, connection: conn } = mockClient(true)
      client = cli
      connection = conn

      filter = automationLabelDeploymentFilter(
        getFilterParams({
          client,
        }),
      ) as filterUtils.FilterWith<'onFetch' | 'deploy'>

      automationLabelInstance.value.id = 555
      const { deployResult } = await filter.deploy([
        toChange({ before: automationLabelInstance, after: changedInstance }),
      ])
      expect(deployResult.appliedChanges).toHaveLength(1)
      expect(getChangeData(deployResult.appliedChanges[0])).toEqual(changedInstance)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/cb-automation/latest/rule-label/555',
        { ...changedInstance.value },
        undefined,
      )
    })
  })
})
