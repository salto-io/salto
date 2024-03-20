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

import { ElemID, InstanceElement, ObjectType, toChange, getChangeData } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { getFilterParams, mockClient } from '../utils'
import profileMappingRemovalFilter from '../../src/filters/profile_mapping_removal'
import { OKTA, PROFILE_MAPPING_TYPE_NAME } from '../../src/constants'
import { MockInterface } from '@salto-io/test-utils'
import OktaClient from '../../src/client/client'
import profileMappingAdditionFilter from '../../src/filters/profile_mapping_addition'

describe('profileMappingRemovalFilter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const mappingType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_MAPPING_TYPE_NAME) })
  const mappingInstance = new InstanceElement('mapping', mappingType, {})

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = profileMappingRemovalFilter(getFilterParams({ client })) as typeof filter
  })

  describe('deploy', () => {
    it('should successfully deploy removal of profile mapping as a verification', async () => {
      mockConnection.get.mockResolvedValue({ data: '', status: 404 }) // 404 is success here.
      const changes = [toChange({ before: mappingInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult
      expect(errors).toHaveLength(0)
      expect(appliedChanges).toHaveLength(1)
      expect(appliedChanges.map(change => getChangeData(change))[0]).toEqual(mappingInstance)
    })

    it('should fail when the mapping exists', async () => {
      mockConnection.get.mockResolvedValue({ data: '', status: 200 }) // 200 is a failure here.
      const changes = [toChange({ before: mappingInstance })]
      const result = await filter.deploy(changes)
      const { appliedChanges, errors } = result.deployResult
      expect(errors).toHaveLength(1)
      expect(appliedChanges).toHaveLength(0)
    })
  })
})
