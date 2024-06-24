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

import { MockInterface } from '@salto-io/test-utils'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  getChangeData,
  isInstanceElement,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { createDefinitions, getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import privateAPIDeployFilter from '../../src/filters/private_api_deploy'
import { GROUP_PUSH_TYPE_NAME, OKTA } from '../../src/constants'
import { DEFAULT_CONFIG, OktaUserConfig } from '../../src/user_config'

describe('privateApiDeploymentFilter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const thirdPartyAdminType = new ObjectType({ elemID: new ElemID(OKTA, 'ThirdPartyAdmin') })
  const thirdPartyAdminInstance = new InstanceElement(ElemID.CONFIG_NAME, thirdPartyAdminType, {
    thirdPartyAdmin: false,
  })
  const thirdPartyAdminAfter = thirdPartyAdminInstance.clone()
  thirdPartyAdminAfter.value.thirdPartyAdmin = true
  const change = toChange({ before: thirdPartyAdminInstance, after: thirdPartyAdminAfter })
  const groupPushType = new ObjectType({
    elemID: new ElemID(OKTA, GROUP_PUSH_TYPE_NAME),
    fields: { mappingId: { refType: BuiltinTypes.SERVICE_ID } },
  })
  const groupPushInst = new InstanceElement('test', groupPushType, { status: 'ACTIVE', newAppGroupName: 'okta' })
  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
  })

  describe('deploy', () => {
    it('should successfully deploy private api types', async () => {
      const definitions = createDefinitions({ client })
      filter = privateAPIDeployFilter(getFilterParams({ definitions })) as typeof filter
      mockConnection.post.mockResolvedValue({ status: 200, data: { thirdPartyAdmin: true } })
      const res = await filter.deploy([change])
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      const afterDeploy = res.deployResult.appliedChanges
        .map(getChangeData)
        .filter(isInstanceElement)
        .find(i => i.elemID.typeName === 'ThirdPartyAdmin')
      expect(afterDeploy?.value).toEqual({ thirdPartyAdmin: true })
    })
    it('should add service id to instance on addition changes', async () => {
      const definitions = createDefinitions({ client })
      filter = privateAPIDeployFilter(getFilterParams({ definitions })) as typeof filter
      mockConnection.post.mockResolvedValue({ status: 200, data: { mappingId: 'aaa', status: 'ACTIVE' } })
      const res = await filter.deploy([toChange({ after: groupPushInst })])
      const { appliedChanges } = res.deployResult
      expect(appliedChanges).toHaveLength(1)
      expect((getChangeData(appliedChanges[0]) as InstanceElement).value.mappingId).toEqual('aaa')
    })
    it('should return error when should privat api flag is disabled', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        client: { usePrivateAPI: false },
      } as OktaUserConfig
      const definitions = createDefinitions({ client, usePrivateAPI: false })
      filter = privateAPIDeployFilter(getFilterParams({ definitions, config })) as typeof filter
      const res = await filter.deploy([change])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0]).toEqual({
        message: 'private API is not enabled in this environment',
        severity: 'Error',
        elemID: thirdPartyAdminAfter.elemID,
      })
    })
    it('should return error when using oauth login', async () => {
      filter = privateAPIDeployFilter(getFilterParams({ isOAuthLogin: true })) as typeof filter
      const res = await filter.deploy([change])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0]).toEqual({
        message: 'private API is not enabled in this environment',
        severity: 'Error',
        elemID: thirdPartyAdminAfter.elemID,
      })
    })
  })
})
