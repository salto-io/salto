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
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import Connection from '../../../src/client/jsforce'
import { mockTypes } from '../../mock_elements'
import {
  CUSTOM_LABEL_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
} from '../../../src/constants'
import { mockFileProperties } from '../../connection'
import mockClient from '../../client'
import filterCreator from '../../../src/filters/author_information/nested_instances'
import { FilterWith } from '../mocks'
import { defaultFilterContext } from '../../utils'

describe('nestedInstancesAuthorInformationFilter', () => {
  const CREATED_BY_NAME = 'Test User'
  const CREATED_DATE = '2021-01-01T00:00:00.000Z'
  const LAST_MODIFIED_BY_NAME = 'Test User 2'
  const LAST_MODIFIED_DATE = '2021-01-02T00:00:00.000Z'

  let customLabelInstance: InstanceElement
  let nonNestedInstance: InstanceElement
  let filter: FilterWith<'onFetch'>
  let connection: MockInterface<Connection>
  describe('onFetch', () => {
    beforeEach(() => {
      customLabelInstance = new InstanceElement(
        'TestCustomLabel',
        mockTypes.CustomLabel,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'TestCustomLabel',
        },
      )
      // Make sure we don't attempt to add missing internal ids to non nested instances
      nonNestedInstance = new InstanceElement(
        'TestNonNestedInstance',
        mockTypes.ApexClass,
        {
          [INSTANCE_FULL_NAME_FIELD]: 'TestNonNestedInstance',
        },
      )
      const fileProperties = mockFileProperties({
        fullName: 'TestCustomLabel',
        type: CUSTOM_LABEL_METADATA_TYPE,
        createdByName: CREATED_BY_NAME,
        createdDate: CREATED_DATE,
        lastModifiedByName: LAST_MODIFIED_BY_NAME,
        lastModifiedDate: LAST_MODIFIED_DATE,
      })
      const mockClientAndConnection = mockClient()
      const { client } = mockClientAndConnection
      connection = mockClientAndConnection.connection
      connection.metadata.list.mockResolvedValue([fileProperties])
      filter = filterCreator({
        client,
        config: defaultFilterContext,
      }) as FilterWith<'onFetch'>
    })
    it('should add author information to nested instances', async () => {
      await filter.onFetch([customLabelInstance, nonNestedInstance])
      expect(customLabelInstance.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATED_BY]: CREATED_BY_NAME,
        [CORE_ANNOTATIONS.CREATED_AT]: CREATED_DATE,
        [CORE_ANNOTATIONS.CHANGED_BY]: LAST_MODIFIED_BY_NAME,
        [CORE_ANNOTATIONS.CHANGED_AT]: LAST_MODIFIED_DATE,
      })
      expect(connection.metadata.list).toHaveBeenCalledOnce()
      expect(connection.metadata.list).toHaveBeenCalledWith([
        { type: CUSTOM_LABEL_METADATA_TYPE },
      ])
    })
  })
})
