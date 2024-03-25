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
import _ from 'lodash'
import { ObjectType, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { OKTA, PROFILE_MAPPING_TYPE_NAME } from '../../src/constants'
import profileMappingPropertiesFilter from '../../src/filters/profile_mapping_properties'
import { getFilterParams } from '../utils'
import OktaClient from '../../src/client/client'

describe('profileMappingPropertiesFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  let client: OktaClient
  let mockGet: jest.SpyInstance
  const mappingType = new ObjectType({ elemID: new ElemID(OKTA, PROFILE_MAPPING_TYPE_NAME) })
  const mappingInstanceA = new InstanceElement('mapp A', mappingType, { id: 'abc123' })
  const mappingInstanceB = new InstanceElement('mapp B', mappingType, { id: 'bcd234' })

  const mappingResponse = {
    status: 200,
    data: {
      id: 'abc123',
      properties: {
        firstName: {
          expression: 'appuser.name',
          pushStatus: 'DONT_PUSH',
        },
      },
    },
  }
  const mappingResponse2 = {
    status: 200,
    data: {
      id: 'bcd234',
      properties: {
        firstName: {
          expression: 'appuser.lastName',
          pushStatus: 'PUSH',
        },
      },
    },
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new OktaClient({
      credentials: { baseUrl: 'a.okta.com', token: 'b' },
    })
    mockGet = jest.spyOn(client, 'get')
  })

  it('should do nothing when includeProfileMappingProperties config flag is disabled', async () => {
    const elements = [mappingType, mappingInstanceA, mappingInstanceB]
    filter = profileMappingPropertiesFilter(getFilterParams({ client, config: DEFAULT_CONFIG })) as typeof filter
    await filter.onFetch(elements)
    expect(elements.filter(isInstanceElement).every(instance => !instance.value.properties)).toEqual(true)
    expect(mockGet).toHaveBeenCalledTimes(0)
  })
  it('should add profile mapping properties for ProfileMapping instances when flag is enabled', async () => {
    const config = _.cloneDeep(DEFAULT_CONFIG)
    config[FETCH_CONFIG].includeProfileMappingProperties = true
    const elements = [mappingType, mappingInstanceA, mappingInstanceB]
    mockGet.mockImplementation(params => {
      if (params.url === '/api/v1/mappings/abc123') {
        return mappingResponse
      }
      if (params.url === '/api/v1/mappings/bcd234') {
        return mappingResponse2
      }
      throw new Error('Err')
    })
    filter = profileMappingPropertiesFilter(getFilterParams({ client, config })) as typeof filter
    await filter.onFetch(elements)
    expect(mockGet).toHaveBeenCalledTimes(2)
    const mappingInstances = elements.filter(isInstanceElement)
    expect(mappingInstances[0].value.properties).toEqual({
      firstName: {
        expression: 'appuser.name',
        pushStatus: 'DONT_PUSH',
      },
    })
    expect(mappingInstances[1].value.properties).toEqual({
      firstName: {
        expression: 'appuser.lastName',
        pushStatus: 'PUSH',
      },
    })
  })
})
