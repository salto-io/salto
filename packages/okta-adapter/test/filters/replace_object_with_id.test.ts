/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { GROUP_TYPE_NAME, OKTA } from '../../src/constants'
import replaceObjectWithIdFilter from '../../src/filters/replace_object_with_id'
import { getFilterParams } from '../utils'

describe('', () => {
  let groupType: ObjectType
  let groupInstance: InstanceElement
  let filter: filterUtils.FilterWith<'onFetch'>

  beforeEach(() => {
    filter = replaceObjectWithIdFilter(getFilterParams()) as typeof filter
    groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
    groupInstance = new InstanceElement(
      'instance',
      groupType,
      {
        type: 'OKTA_GROUP',
        profile: {
          name: 'Marketing',
          description: 'Marketing Dep',
        },
        apps: [
          {
            id: '0oa66j371cnRcCeQB5d7',
            name: 'saasure',
            label: 'Okta Admin Console',
            status: 'ACTIVE',
            settings: {
              notifications: {
                vpn: {
                  network: {
                    connection: 'DISABLED',
                  },
                },
              },
            },
          },
          {
            id: '0oa68k9spoT0zHGQe5d7',
            name: 'zendesk',
            label: 'Zendesk',
            status: 'ACTIVE',
            settings: {
              notifications: {
                vpn: {
                  network: {
                    connection: 'DISABLED',
                  },
                },
              },
            },
          },
        ],
      },
    )
  })

  it('should replace object with ids', async () => {
    await filter.onFetch?.([groupType, groupInstance])
    expect(groupInstance.value.apps).toEqual([
      '0oa66j371cnRcCeQB5d7',
      '0oa68k9spoT0zHGQe5d7',
    ])
  })
})
