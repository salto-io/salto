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
import { ElemID, InstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { createEmptyType, getFilterParams } from '../utils'
import userFilter from '../../src/filters/user'
import { Filter } from '../../src/filter'
import { ACCOUNT_ID_INFO_TYPE, JIRA } from '../../src/constants'
import { createBoardType, createDashboardType, createFilterType } from './account_id/account_id_common'

describe('userFilter', () => {
  let filter: Filter

  let boardType: ObjectType
  let adminType: ObjectType
  let filterType: ObjectType
  let dashboardType: ObjectType

  beforeEach(async () => {
    filter = userFilter(getFilterParams())


    adminType = new ObjectType({
      elemID: new ElemID(JIRA, 'BoardAdmins'),
      fields: {
        users: { refType: new ListType(createEmptyType('User')) },
      },
    })

    boardType = createBoardType()
    filterType = createFilterType()
    dashboardType = createDashboardType()
  })

  describe('onFetch', () => {
    it('should replace User types with account id field', async () => {
      const instance = new InstanceElement(
        'instance',
        boardType,
        {
          admins: {
            users: [{
              accountId: 'John Doe',
            },
            {
              accountId: 'John Doe4',
            }],
          },
        }
      )
      const instanceFilter = new InstanceElement(
        'instance2',
        filterType,
        {
          owner: {
            accountId: 'John Doe2',
          },
          editPermissions: [
            {
              type: 'user',
              user: {
                displayName: 'No One',
                accountId: {
                  id: 'noOne',
                },
              },
            },
          ],
        }
      )
      const instanceDashboard = new InstanceElement(
        'instance3',
        dashboardType,
        {
          owner: {
            accountId: 'John Doe3',
          },
        }
      )
      await filter.onFetch?.([instance, instanceFilter, instanceDashboard])
      expect(instance.value).toEqual({
        admins: {
          users: ['John Doe', 'John Doe4'],
        },
      })
      expect(instanceFilter.value).toEqual({
        owner: 'John Doe2',
        editPermissions: [
          {
            type: 'user',
            user: {
              id: 'noOne',
            },
          },
        ],
      })
      expect(instanceDashboard.value).toEqual({
        owner: 'John Doe3',
      })
    })

    it('should do nothing of not a user type', async () => {
      const instance = new InstanceElement(
        'instance',
        boardType,
        {
          notUser: {
            displayName: 'John Doe',
          },
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        notUser: {
          displayName: 'John Doe',
        },
      })
    })

    it('should do nothing on wrong structure', async () => {
      const instance = new InstanceElement(
        'instance',
        boardType,
        {
          type: 'ACCOUNT_ID',
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        type: 'ACCOUNT_ID',
      })

      const instance2 = new InstanceElement(
        'instance2',
        boardType,
        {
          type: 'ACCOUNT_ID',
          value: 'bla',
        }
      )
      await filter.onFetch?.([instance2])
      expect(instance2.value).toEqual({
        type: 'ACCOUNT_ID',
        value: 'bla',
      })
    })

    it('should replace field type', async () => {
      await filter.onFetch?.([adminType, filterType, dashboardType])
      expect((await adminType.fields.users.getType()).elemID.name).toEqual(`List<jira.${ACCOUNT_ID_INFO_TYPE}>`)
      expect((await filterType.fields.owner.getType()).elemID.name).toEqual(ACCOUNT_ID_INFO_TYPE)
      expect((await dashboardType.fields.owner.getType()).elemID.name).toEqual(ACCOUNT_ID_INFO_TYPE)
    })
  })
})
