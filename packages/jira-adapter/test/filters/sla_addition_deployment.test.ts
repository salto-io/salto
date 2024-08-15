/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, CORE_ANNOTATIONS, ReferenceExpression } from '@salto-io/adapter-api'
import { getDefaultConfig } from '../../src/config/config'
import defaultSlaAdditionFilter from '../../src/filters/sla_addition_deployment'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import { PROJECT_TYPE, SLA_TYPE_NAME } from '../../src/constants'
import JiraClient from '../../src/client/client'

describe('slaAdditionFilter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let client: JiraClient
  let mockGet: jest.SpyInstance
  let mockPost: jest.SpyInstance
  let mockPut: jest.SpyInstance

  const DEFAULT_SLA_NAME = 'Time to resolution'

  const projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
    id: 11111,
    name: 'project1',
    projectTypeKey: 'service_desk',
    key: 'project1Key',
  })

  const createSlaInstance = (name: string): InstanceElement =>
    new InstanceElement('sla1', createEmptyType(SLA_TYPE_NAME), { id: 11, name }, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
    })
  const defaultSlaInstance = createSlaInstance(DEFAULT_SLA_NAME)

  beforeAll(() => {
    const { client: cli } = mockClient(false)
    client = cli

    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true

    filter = defaultSlaAdditionFilter(getFilterParams({ config, client })) as FilterType
  })

  beforeEach(() => {
    mockGet = jest.spyOn(client, 'get').mockClear()
    mockPost = jest.spyOn(client, 'post').mockClear()
    mockPut = jest.spyOn(client, 'put').mockClear()

    mockGet.mockImplementation(async ({ url }) => {
      if (url === '/rest/servicedesk/1/servicedesk/agent/project1Key/sla/metrics') {
        return {
          status: 200,
          data: {
            timeMetrics: [
              { id: 11, name: DEFAULT_SLA_NAME },
              { id: 12, name: 'another one' },
            ],
          },
        }
      }
      throw new Error(`Unexpected url ${url}`)
    })
  })

  describe('deploying SLAs with default names', () => {
    it('should deploy addition of a SLA with default name as modification change', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after: defaultSlaInstance } }])

      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('should make only one API call for multiple default SLAs of the same project', async () => {
      const defaultSlaInstance2 = createSlaInstance('Time to first response')

      const res = await filter.deploy([
        { action: 'add', data: { after: defaultSlaInstance } },
        { action: 'add', data: { after: defaultSlaInstance2 } },
      ])

      expect(mockGet).toHaveBeenCalledTimes(1)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
    })
  })

  describe('deploying SLAs with non-default names', () => {
    it('should process addition of a SLA with non-default name through the filter as addition change', async () => {
      const nonDefaultSlaInstance = createSlaInstance('Custom SLA')
      const res = await filter.deploy([{ action: 'add', data: { after: nonDefaultSlaInstance } }])

      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(mockPut).not.toHaveBeenCalled()
      expect(mockPost).toHaveBeenCalledTimes(1)
    })

    it('should deploy SLAs with default names as modification and non default SLA as addition when mixed', async () => {
      const nonDefaultSlaInstance = createSlaInstance('Custom SLA')

      const res = await filter.deploy([
        { action: 'add', data: { after: nonDefaultSlaInstance } },
        { action: 'add', data: { after: defaultSlaInstance } },
      ])

      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledTimes(1)
    })
  })
})
