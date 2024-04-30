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

import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  getChangeData,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../utils'
import appUserSchemaRemovalFilter from '../../src/filters/app_user_schema_removal'
import { APPLICATION_TYPE_NAME, APP_USER_SCHEMA_TYPE_NAME, OKTA } from '../../src/constants'
import OktaClient from '../../src/client/client'

type FilterType = filterUtils.FilterWith<'deploy'>

describe('appUserSchemaRemovalFilter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  let filter: FilterType
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const appUserSchemaType = new ObjectType({ elemID: new ElemID(OKTA, APP_USER_SCHEMA_TYPE_NAME) })

  const app = new InstanceElement('app', appType, { name: 'A', default: false, id: '1' })
  const appUserSchemaInstance = new InstanceElement(
    'appUserSchema',
    appUserSchemaType,
    {
      name: 'B',
    },
    undefined,
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app.elemID, app, app)],
    },
  )
  const notFoundError = new clientUtils.HTTPError('message', {
    status: 404,
    data: {},
  })
  const successResponse = { status: 200, data: '' }

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = appUserSchemaRemovalFilter(getFilterParams({ client })) as typeof filter
  })

  describe('deploy', () => {
    it('should successfully deploy removal of app user schema as a verification', async () => {
      mockConnection.get.mockRejectedValue(notFoundError)
      const changes = [toChange({ before: appUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult
      expect(errors).toHaveLength(0)
      expect(appliedChanges).toHaveLength(1)
      expect(appliedChanges.map(change => getChangeData(change))[0]).toEqual(appUserSchemaInstance)
    })

    it('should fail when the parent application exists', async () => {
      mockConnection.get.mockResolvedValue(successResponse)
      const changes = [toChange({ before: appUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult
      expect(errors).toHaveLength(1)
      expect(appliedChanges).toHaveLength(0)
    })

    it('should handle multiple changes', async () => {
      mockConnection.get.mockRejectedValueOnce(notFoundError)
      mockConnection.get.mockResolvedValueOnce(successResponse)
      const changes = [toChange({ before: appUserSchemaInstance }), toChange({ before: appUserSchemaInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult
      expect(errors).toHaveLength(1)
      expect(appliedChanges).toHaveLength(1)
    })
  })
})
