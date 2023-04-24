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

import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { APPLICATION_TYPE_NAME, OKTA } from '../../src/constants'
import replaceObjectWithIdFilter from '../../src/filters/replace_object_with_id'
import { getFilterParams } from '../utils'

describe('replaceObjectWithIdFilter', () => {
  let appType: ObjectType
  let appInstance: InstanceElement
  let filter: filterUtils.FilterWith<'onFetch'>

  beforeEach(() => {
    filter = replaceObjectWithIdFilter(getFilterParams()) as typeof filter
    appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
    appInstance = new InstanceElement(
      'instance',
      appType,
      {
        name: 'salesforce',
        signOnMode: 'SAML_2_0',
        assignedGroups: [
          {
            id: '0oa66j371cnRcCeQB5d7',
            name: 'a',
          },
          {
            id: '0oa68k9spoT0zHGQe5d7',
            something: 'b',
          },
        ],
      },
    )
  })

  it('should replace object with ids', async () => {
    await filter.onFetch?.([appType, appInstance])
    expect(appInstance.value.assignedGroups).toEqual([
      '0oa66j371cnRcCeQB5d7',
      '0oa68k9spoT0zHGQe5d7',
    ])
  })
  it('should not replace object with ids if id does not exists', async () => {
    const app2 = appInstance.clone()
    delete app2.value.assignedGroups[0].id
    await filter.onFetch?.([appType, app2])
    expect(app2.value.assignedGroups).toEqual([
      {
        name: 'a',
      },
      '0oa68k9spoT0zHGQe5d7',
    ])
  })
})
