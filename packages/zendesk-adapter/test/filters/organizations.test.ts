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
import { ObjectType, ElemID, InstanceElement, isInstanceElement, toChange } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../../src/constants'
import filterCreator, { getOrganizationsByIds, getOrganizationsByNames } from '../../src/filters/organizations'
import { createFilterCreatorParams } from '../utils'
import ZendeskClient from '../../src/client/client'
import { FETCH_CONFIG, DEFAULT_CONFIG } from '../../src/config'
import { paginate } from '../../src/client/pagination'


describe('organizations filter', () => {
  const client = new ZendeskClient({
    credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
  })
  let mockGet: jest.SpyInstance
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  const triggerType = new ObjectType({ elemID: new ElemID(ZENDESK, 'trigger') })
  const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, 'user_segment') })

  const userSegmentInstance = new InstanceElement(
    'test',
    userSegmentType,
    {
      title: 'test',
      organization_ids: [1, 2, 3],
    }
  )

  const triggerInstance = new InstanceElement(
    'test',
    triggerType,
    {
      title: 'test',
      actions: [
        { field: 'status', value: 'closed' },
      ],
      conditions: {
        all: [
          { field: 'organization_id', operator: 'is', value: '3' },
          { field: 'assignee_id', operator: 'is', value: '3' },
        ],
        any: [
          { field: 'SOLVED', operator: 'greater_than', value: '96' },
          { field: 'organization_id', operator: 'is_not', value: '2' },
        ],
      },
    },
  )
  describe('when resolveOrganizationIDs config flag is true', () => {
    let filter: FilterType
    beforeEach(async () => {
      jest.clearAllMocks()
      mockGet = jest.spyOn(client, 'getSinglePage')
      const config = { ...DEFAULT_CONFIG }
      config[FETCH_CONFIG].resolveOrganizationIDs = true
      filter = filterCreator(
        createFilterCreatorParams({ client, config })
      ) as FilterType
    })

    describe('onFetch', () => {
      beforeEach(async () => {
        jest.clearAllMocks()
        mockGet.mockResolvedValue({
          status: 200,
          data: {
            organizations: [
              { id: 1, name: 'org1' },
              { id: 2, name: 'org2' },
              { id: 3, name: 'org3' },
              { id: 4, name: 'org4' },
              { id: 5, name: 'org5' },
            ],
          },
        })
      })
      it('should replace all organization ids with names', async () => {
        const elements = [userSegmentType, userSegmentInstance, triggerType, triggerInstance]
          .map(e => e.clone())
        await filter.onFetch(elements)
        const instances = elements.filter(isInstanceElement)
        const trigger = instances.find(e => e.elemID.typeName === 'trigger')
        expect(trigger?.value).toEqual({
          title: 'test',
          actions: [
            { field: 'status', value: 'closed' },
          ],
          conditions: {
            all: [
              { field: 'organization_id', operator: 'is', value: 'org3' },
              { field: 'assignee_id', operator: 'is', value: '3' },
            ],
            any: [
              { field: 'SOLVED', operator: 'greater_than', value: '96' },
              { field: 'organization_id', operator: 'is_not', value: 'org2' },
            ],
          },
        },)
        const userSegment = instances.find(e => e.elemID.typeName === 'user_segment')
        expect(userSegment?.value).toEqual({
          title: 'test',
          organization_ids: ['org1', 'org2', 'org3'],
        })
      })
    })
    describe('preDeploy', () => {
      it('should repalce organizaion names with emails', async () => {
        mockGet
          .mockResolvedValueOnce({
            status: 200,
            data: {
              organizations: [
                { id: 1, name: 'org1' },
                { id: 2, name: 'org11' },
                { id: 3, name: 'org1111' },
              ],
            },
          })
          .mockResolvedValueOnce({
            status: 200,
            data: {
              organizations: [
                { id: 2, name: 'org11' },
                { id: 3, name: 'org1111' },
              ],
            },
          })
        const userSegAfterFetch = new InstanceElement(
          'test',
          userSegmentType,
          {
            title: 'test',
            organization_ids: ['org1', 'org11'],
          }
        )
        await filter.preDeploy([toChange({ after: userSegAfterFetch })])
        expect(mockGet).toHaveBeenCalledTimes(2)
        expect(userSegAfterFetch.value).toEqual({
          title: 'test',
          organization_ids: [1, 2],
        })
      })
    })
    describe('onDeploy', () => {
      it('should change back organization ids to names', async () => {
        mockGet
          .mockResolvedValueOnce({
            status: 200,
            data: {
              organizations: [
                { id: 1, name: 'org1' },
                { id: 2, name: 'org11' },
                { id: 3, name: 'org1111' },
              ],
            },
          })
          .mockResolvedValueOnce({
            status: 200,
            data: {
              organizations: [
                { id: 2, name: 'org11' },
                { id: 3, name: 'org1111' },
              ],
            },
          })
        const userSegAfterFetch = new InstanceElement(
          'test',
          userSegmentType,
          {
            title: 'test',
            organization_ids: ['org1', 'org11'],
          }
        )
        const changes = [toChange({ after: userSegAfterFetch })]
        // We call preDeploy here because it sets the mappings
        await filter.preDeploy(changes)
        await filter.onDeploy(changes)
        expect(userSegAfterFetch.value).toEqual({
          title: 'test',
          organization_ids: ['org1', 'org11'],
        })
      })
    })
  })

  describe('it should do nothing if resolveOrganizationIDs config flag is false', () => {
    let filter: FilterType
    beforeEach(async () => {
      jest.clearAllMocks()
      mockGet = jest.spyOn(client, 'getSinglePage')
      const config = { ...DEFAULT_CONFIG }
      config[FETCH_CONFIG].resolveOrganizationIDs = false
      filter = filterCreator(
        createFilterCreatorParams({ client, config })
      ) as FilterType
    })

    describe('onFetch', () => {
      it('should do nothing if resolveOrganizationIDs config flag is off', async () => {
        const elements = [userSegmentType, userSegmentInstance, triggerType, triggerInstance]
          .map(e => e.clone())
        await filter.onFetch(elements)
        const instances = elements.filter(isInstanceElement)
        const trigger = instances.find(e => e.elemID.typeName === 'trigger')
        expect(trigger?.value).toEqual({
          title: 'test',
          actions: [
            { field: 'status', value: 'closed' },
          ],
          conditions: {
            all: [
              { field: 'organization_id', operator: 'is', value: '3' },
              { field: 'assignee_id', operator: 'is', value: '3' },
            ],
            any: [
              { field: 'SOLVED', operator: 'greater_than', value: '96' },
              { field: 'organization_id', operator: 'is_not', value: '2' },
            ],
          },
        },)
        const userSegment = instances.find(e => e.elemID.typeName === 'user_segment')
        expect(userSegment?.value).toEqual({
          title: 'test',
          organization_ids: [1, 2, 3],
        })
      })
    })

    describe('preDeploy', () => {
      it('should not not change organization values', async () => {
        const userSegAfterFetch = new InstanceElement(
          'test',
          userSegmentType,
          {
            title: 'test',
            organization_ids: [1, 2],
          }
        )
        await filter.preDeploy([toChange({ after: userSegAfterFetch })])
        expect(userSegAfterFetch.value).toEqual({
          title: 'test',
          organization_ids: [1, 2],
        })
      })
    })

    describe('onDeploy', () => {
      it('should not change organization values', async () => {
        const userSegAfterFetch = new InstanceElement(
          'test',
          userSegmentType,
          {
            title: 'test',
            organization_ids: [1, 2],
          }
        )
        await filter.onDeploy([toChange({ after: userSegAfterFetch })])
        expect(userSegAfterFetch.value).toEqual({
          title: 'test',
          organization_ids: [1, 2],
        })
      })
    })
  })
  describe('API calls', () => {
    const paginator = clientUtils.createPaginator({ client, paginationFuncCreator: paginate })

    beforeEach(() => {
      jest.clearAllMocks()
      mockGet = jest.spyOn(client, 'getSinglePage')
    })

    it('getOrganizationsByNames', async () => {
      mockGet.mockResolvedValueOnce({
        status: 200,
        data: {
          organizations: [
            { id: 1, name: 'org1' },
            { id: 2, name: 'org11' },
            { id: 3, name: 'org1111' },
          ],
        },
      }).mockResolvedValueOnce({
        status: 200,
        data: {
          organizations: [
            { id: 2, name: 'org11' },
            { id: 3, name: 'org1111' },
          ],
        },
      })

      const goodResult = await getOrganizationsByNames(['org1', 'org11'], paginator)
      expect(goodResult).toEqual([
        { id: 1, name: 'org1' },
        { id: 2, name: 'org11' },
      ])

      mockGet.mockResolvedValueOnce({
        status: 200,
        data: {
          organizations: [
            { id: 2, name: 'org11' },
          ],
        },
      }).mockResolvedValueOnce({
        status: 200,
        data: {
          organizations: [
            { id: 2, name: 'org11' },
            { id: 3 }, // Bad structure
          ],
        },
      })
      const badResult = await getOrganizationsByNames(['org1', 'org11'], paginator)
      expect(badResult).toEqual([])
    })
    it('getOrganizationsByIds', async () => {
      mockGet.mockResolvedValueOnce({
        status: 200,
        data: {
          organizations: [
            { id: 1, name: 'org1' },
            { id: 2, name: 'org11' },
          ],
        },
      })

      const goodResult = await getOrganizationsByIds(['1', '2'], client)
      expect(goodResult).toEqual([
        { id: 1, name: 'org1' },
        { id: 2, name: 'org11' },
      ])

      mockGet.mockResolvedValueOnce({
        status: 200,
        data: {
          organizations: [
            { id: 1, name: 'org11' },
            { id: 2 }, // Bad structure
          ],
        },
      })
      const badResult = await getOrganizationsByIds(['1', '2'], client)
      expect(badResult).toEqual([])
    })
  })
})
