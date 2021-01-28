/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import filterCreator, {
  CUSTOM_FEED_FILTER_METADATA_TYPE_ID,
  CUSTOM_FEED_FILTER_METADATA_TYPE,
} from '../../src/filters/custom_feed_filter'
import mockClient from '../client'
import { FilterWith } from '../../src/filter'
import * as constants from '../../src/constants'
import SalesforceClient from '../../src/client/client'
import { apiName } from '../../src/transformers/transformer'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'


describe('Test CustomFeedFilter', () => {
  const { client } = mockClient()

  const filter = filterCreator(
    {
      client,
      config: {
        fetchProfile: buildFetchProfile({
          metadata: {
            exclude: [
              { metadataType: 'CustomFeedFilter', name: 'Case.skipped' },
            ],
          },
        }),
      },
    }
  ) as FilterWith<'onFetch'>
  const mockObject = new ObjectType({
    elemID: CUSTOM_FEED_FILTER_METADATA_TYPE_ID,
    annotations: {
      label: 'test label',
      [constants.API_NAME]: CUSTOM_FEED_FILTER_METADATA_TYPE,
    },
    isSettings: false,
  })

  const mockInstance = new InstanceElement(
    'test',
    mockObject,
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'test',
    },
  )

  const skippedMockInstance = new InstanceElement(
    'skipped',
    mockObject,
    {
      [constants.INSTANCE_FULL_NAME_FIELD]: 'skipped',
    },
  )

  const testElements = [mockInstance, mockObject, skippedMockInstance]

  describe('on fetch', () => {
    let mockListMetadataObjects: jest.Mock
    let mockReadMetadata: jest.Mock

    beforeEach(() => {
      mockListMetadataObjects = jest.fn()
        .mockImplementationOnce(async () => ({ result: [{ fullName: 'test' }, { fullName: 'skipped' }] }))

      mockReadMetadata = jest.fn()
        .mockImplementationOnce(() => ({ result: [
          { fullName: 'Case.test', criteria: {}, label: 'test' },
        ] }))

      SalesforceClient.prototype.listMetadataObjects = mockListMetadataObjects
      SalesforceClient.prototype.readMetadata = mockReadMetadata
    })

    it('should generate custom feed filter instances', async () => {
      const instanceName = 'Case.test'
      await filter.onFetch(testElements)
      expect(mockReadMetadata)
        .toHaveBeenCalledWith(CUSTOM_FEED_FILTER_METADATA_TYPE, [instanceName])
      expect(testElements).toHaveLength(4)
      const instance = testElements[3]
      expect(isInstanceElement(instance)).toBeTruthy()
      expect(apiName(instance)).toEqual(instanceName)
    })
  })
})
