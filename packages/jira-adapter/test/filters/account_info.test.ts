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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../utils'
import accountInfoFilter from '../../src/filters/account_info'
import { Filter } from '../../src/filter'

describe('accountInfoFilter', () => {
  let filter: Filter
  let connection: MockInterface<clientUtils.APIConnection>
  let elements: InstanceElement[]
  describe('cloud', () => {
    beforeEach(async () => {
      const { client, connection: conn } = mockClient()
      connection = conn
      filter = accountInfoFilter(getFilterParams({ client }))
      const applicationRoleType = new ObjectType({
        elemID: new ElemID('jira', 'ApplicationRole'),
      })
      const applicationRoleSoftware = new InstanceElement(
        'jira-software',
        applicationRoleType,
        { key: 'jira-software', userCount: '10' },
      )
      const applicationRoleOther = new InstanceElement(
        'jira-other',
        applicationRoleType,
        { key: 'jira-other', userCount: '8' },
      )
      elements = [applicationRoleOther, applicationRoleSoftware]
    })
    describe('onFetch', () => {
      it('should populate license successfully', async () => {
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: { applications: [
            {
              id: 'jira-software',
              plan: 'FREE',
            },
            {
              id: 'other-app',
              plan: 'PAID',
            },
          ] },
        })
        await filter.onFetch?.(elements)
        expect(elements.length).toEqual(6)
        expect(elements[2].elemID.getFullName()).toEqual('jira.License')
        expect(elements[3].elemID.getFullName()).toEqual('jira.LicensedApplication')
        expect(elements[4].elemID.getFullName()).toEqual('jira.AccountInfo')
        expect(elements[5].value).toEqual({ license: { applications: [
          { id: 'jira-software', plan: 'FREE' },
          { id: 'other-app', plan: 'PAID' },
        ] } })
      })
      it('should do nothing for a wrong license answer', async () => {
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: { other: [
            {
              id: 'jira-software',
              plan: 'FREE',
            },
          ] },
        })
        await filter.onFetch?.(elements)
        expect(elements.length).toEqual(2)
      })
    })
    it('should remove users count from application roles', async () => {
      await filter.onFetch?.(elements)
      expect(elements.length).toEqual(2)
      expect(elements[0].elemID.getFullName()).toEqual('jira.ApplicationRole.instance.jira-other')
      expect(elements[0].value.userCount).toBeUndefined()
      expect(elements[1].elemID.getFullName()).toEqual('jira.ApplicationRole.instance.jira-software')
      expect(elements[1].value.userCount).toBeUndefined()
    })
  })
  describe('dc', () => {
    beforeEach(async () => {
      const { client, connection: conn } = mockClient(true)
      connection = conn
      filter = accountInfoFilter(getFilterParams({ client }))
      elements = []
    })
    describe('onFetch', () => {
      it('should populate license successfully', async () => {
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: {
            licenseType: 'Developer',
            expired: false,
            rawLicense: 'should be removed',
            organizationName: 'should be removed2',
            supportEntitlementNumber: 'should be removed3',
          },
        })
        await filter.onFetch?.(elements)
        expect(elements.length).toEqual(4)
        expect(elements[0].elemID.getFullName()).toEqual('jira.License')
        expect(elements[1].elemID.getFullName()).toEqual('jira.LicensedApplication')
        expect(elements[2].elemID.getFullName()).toEqual('jira.AccountInfo')
        expect(elements[3].value).toEqual({ license: { applications: [
          { id: 'jira-software',
            plan: 'Developer',
            raw: {
              licenseType: 'Developer',
              expired: false,
            } },
        ] } })
      })
      it('should do nothing for a wrong license answer', async () => {
        connection.get.mockResolvedValueOnce({
          status: 200,
          data: { other: [
            {
              id: 'jira-software',
              plan: 'FREE',
            },
          ] },
        })
        await filter.onFetch?.(elements)
        expect(elements.length).toEqual(0)
      })
    })
  })
})
