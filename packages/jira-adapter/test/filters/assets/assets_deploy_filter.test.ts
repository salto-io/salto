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

import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../../src/config/config'
import asstesDeployFilter from '../../../src/filters/assets/assets_deploy_filter'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'
import { ASSESTS_SCHEMA_TYPE } from '../../../src/constants'
import JiraClient from '../../../src/client/client'


describe('assetsTypesDeployFilter', () => {
    type FilterType = filterUtils.FilterWith<'deploy'>
    let filter: FilterType
    let connection: MockInterface<clientUtils.APIConnection>
    let client: JiraClient
    let assetsSchemaInstance: InstanceElement
    describe('deploy', () => {
      beforeEach(async () => {
        jest.clearAllMocks()
        const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
        config.fetch.enableJSM = true
        const { client: cli, connection: conn } = mockClient(false)
        connection = conn
        client = cli
        filter = asstesDeployFilter(getFilterParams({ config, client })) as typeof filter
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            values: [
              {
                workspaceId: 'wid1234',
              },
            ],
          },
        })

        assetsSchemaInstance = new InstanceElement(
          'assetsSchema1',
          createEmptyType(ASSESTS_SCHEMA_TYPE),
          {
            name: 'assetsSchema1',
            objectSchemaKey: 'a1',
            status: 'Ok',
            description: 'test description',
            atlassianTemplateId: 'people_new',
            id: 5,
            workspaceId: 'wid12',
          },
        )
      })
      it('should pass the correct params to deployChange on addition', async () => {
        const res = await filter
          .deploy([{ action: 'add', data: { after: assetsSchemaInstance } }])
        expect(connection.post).toHaveBeenCalledTimes(1)
        expect(connection.get).toHaveBeenCalledTimes(1)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(connection.post).toHaveBeenCalledWith(
          '/gateway/api/jsm/assets/workspace/wid1234/v1/objectschema/create',
          {
            name: 'assetsSchema1',
            objectSchemaKey: 'a1',
            status: 'Ok',
            description: 'test description',
            atlassianTemplateId: 'people_new',
            id: 5,
            workspaceId: 'wid12',
          },
          undefined,
        )
      })
      it('should pass the correct params to deployChange on modification', async () => {
        const assetsSchemaAfter = assetsSchemaInstance.clone()
        assetsSchemaAfter.value.description = 'new description'
        const res = await filter
          .deploy([{ action: 'modify', data: { before: assetsSchemaInstance, after: assetsSchemaAfter } }])
        expect(connection.put).toHaveBeenCalledTimes(1)
        expect(connection.get).toHaveBeenCalledTimes(1)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(connection.put).toHaveBeenCalledWith(
          '/gateway/api/jsm/assets/workspace/wid12/v1/objectschema/5',
          {
            name: 'assetsSchema1',
            objectSchemaKey: 'a1',
            status: 'Ok',
            description: 'new description',
            atlassianTemplateId: 'people_new',
            id: 5,
            workspaceId: 'wid12',
          },
          undefined,
        )
      })
      it('should pass the correct params to deployChange on removal', async () => {
        const res = await filter
          .deploy([{ action: 'remove', data: { before: assetsSchemaInstance } }])
        expect(connection.delete).toHaveBeenCalledTimes(1)
        expect(connection.get).toHaveBeenCalledTimes(1)
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(connection.delete).toHaveBeenCalledWith(
          '/gateway/api/jsm/assets/workspace/wid12/v1/objectschema/5',
          { data: undefined }
        )
      })
    })
})
