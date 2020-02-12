/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { Values } from 'adapter-api'
import {
  fromHubspotObject, Types, createInstanceName,
} from '../../src/transformers/transformer'
import {
  HubspotMetadata,
} from '../../src/client/types'

describe('Transformer', () => {
  const instanceTestName = 'instance test name'
  const mockGuid = 'id1234'
  const mockId = 54321

  const hubMetadataType = {
    name: instanceTestName,
    bla: false,
    guid: mockGuid,
    id: mockId,
  } as HubspotMetadata

  describe('fromHubspotObject func', () => {
    let resp: Values

    it('should an empty values', async () => {
      resp = fromHubspotObject({} as HubspotMetadata, Types.hubspotObjects.form)
      expect(resp).toBeDefined()
      expect(resp).toEqual({})
    })

    it('should return all form supported values', async () => {
      resp = fromHubspotObject(hubMetadataType, Types.hubspotObjects.form)
      expect(resp.name).toEqual(instanceTestName)
      expect(resp.guid).toEqual(mockGuid)
      expect(resp.id).toBeUndefined()
    })

    it('should return all MarketingEmail supported values', async () => {
      resp = fromHubspotObject(hubMetadataType, Types.hubspotObjects.marketingEmail)
      expect(resp.name).toEqual(instanceTestName)
      expect(resp.id).toEqual(mockId)
      expect(resp.guid).toBeUndefined()
    })

    afterEach(() => {
      expect(resp.bla).toBeUndefined()
    })
  })

  describe('createInstanceName func', () => {
    it('should return instance name', async () => {
      const resp = createInstanceName(hubMetadataType.name)
      expect(resp).toEqual('instance_test_name')
    })

    it('should replace all spaces with underscore', async () => {
      const resp = createInstanceName(' name secondName ')
      expect(resp).toEqual('name_secondName')
    })
  })
})
