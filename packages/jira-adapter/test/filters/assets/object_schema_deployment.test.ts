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
import { InstanceElement } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../../src/config/config'
import objectSchemaDeployFilter from '../../../src/filters/assets/object_schema_deployment'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { OBJECT_SCHEMA_TYPE } from '../../../src/constants'
import JiraClient from '../../../src/client/client'

describe('requestType filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let connection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  let objectSchemaInstance: InstanceElement
  describe('deploy', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      config.fetch.enableJSMPremium = true
      const { client: cli, connection: conn } = mockClient(false)
      connection = conn
      client = cli
      filter = objectSchemaDeployFilter(getFilterParams({ config, client })) as typeof filter
      objectSchemaInstance = new InstanceElement('objectSchema1', createEmptyType(OBJECT_SCHEMA_TYPE), {
        name: 'objectSchema1',
        description: 'objectSchema1 description',
        status: 'ok',
        id: 1,
        workspaceId: 'workspaceId1',
        properties: {
          quickCreateObjects: true,
          validateQuickCreate: false,
          allowOtherObjectSchema: false,
        },
      })
      connection.get.mockImplementation(async url => {
        if (url === '/rest/servicedeskapi/assets/workspace') {
          return {
            status: 200,
            data: {
              values: [
                {
                  workspaceId: 'workspaceId111',
                },
              ],
            },
          }
        }
        throw new Error('Unexpected url')
      })
    })
    it('should deploy addition of a object schema for both endpoints', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after: objectSchemaInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(2)
      expect(connection.post).toHaveBeenCalledWith(
        '/gateway/api/jsm/assets/workspace/workspaceId111/v1/objectschema/create',
        {
          name: 'objectSchema1',
          description: 'objectSchema1 description',
          status: 'ok',
          id: 1,
        },
        undefined,
      )
      expect(connection.post).toHaveBeenCalledWith(
        '/gateway/api/jsm/assets/workspace/workspaceId111/v1/global/config/objectschema/1/property',
        {
          quickCreateObjects: true,
          validateQuickCreate: false,
          allowOtherObjectSchema: false,
        },
        undefined,
      )
    })
    it('should deploy modification of a object schema for both endpoints', async () => {
      const objectSchemaInstanceAfter = objectSchemaInstance.clone()
      objectSchemaInstanceAfter.value.properties.quickCreateObjects = false
      objectSchemaInstanceAfter.value.description = 'new description'
      const res = await filter.deploy([
        { action: 'modify', data: { before: objectSchemaInstance, after: objectSchemaInstanceAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(1)
      expect(connection.post).toHaveBeenCalledWith(
        '/gateway/api/jsm/assets/workspace/workspaceId1/v1/global/config/objectschema/1/property',
        {
          quickCreateObjects: false,
          validateQuickCreate: false,
          allowOtherObjectSchema: false,
        },
        undefined,
      )
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/gateway/api/jsm/assets/workspace/workspaceId1/v1/objectschema/1',
        {
          name: 'objectSchema1',
          description: 'new description',
          status: 'ok',
          id: 1,
        },
        undefined,
      )
    })
    it('should deploy modification of a object schema for one endpoint', async () => {
      const objectSchemaInstanceAfter = objectSchemaInstance.clone()
      objectSchemaInstanceAfter.value.description = 'new description'
      const res = await filter.deploy([
        { action: 'modify', data: { before: objectSchemaInstance, after: objectSchemaInstanceAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(0)
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/gateway/api/jsm/assets/workspace/workspaceId1/v1/objectschema/1',
        {
          name: 'objectSchema1',
          description: 'new description',
          status: 'ok',
          id: 1,
        },
        undefined,
      )
    })
    it('should deploy deletion of a object schema for one endpoint', async () => {
      const res = await filter.deploy([{ action: 'remove', data: { before: objectSchemaInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.delete).toHaveBeenCalledTimes(1)
    })
    it('should not deploy object schema if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      const filterWithNoJsm = objectSchemaDeployFilter(getFilterParams({ config, client })) as typeof filter
      const res = await filterWithNoJsm.deploy([{ action: 'add', data: { after: objectSchemaInstance } }])
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(connection.post).toHaveBeenCalledTimes(0)
    })
  })
})
