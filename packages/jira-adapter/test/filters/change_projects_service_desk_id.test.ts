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

import { InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { PROJECT_TYPE, SERVICE_DESK } from '../../src/constants'
import { createEmptyType, getFilterParams } from '../utils'
import changeServiceDeskIdFieldProjectFilter from '../../src/filters/change_projects_service_desk_id'

describe('changeServiceDeskIdFieldProjectFilter', () => {
    type FilterType = filterUtils.FilterWith<'onFetch'>
    let filter: FilterType
    const projectInstance = new InstanceElement(
      'project1',
      createEmptyType(PROJECT_TYPE),
      {
        id: '11111',
        name: 'project1',
        projectTypeKey: SERVICE_DESK,
        serviceDeskId: {
          id: '12345',
        },
      },
    )
    const elements = [projectInstance]
    it('should change service desk Id from object to string', async () => {
      filter = changeServiceDeskIdFieldProjectFilter(getFilterParams({})) as typeof filter
      await filter.onFetch(elements)
      expect(projectInstance.value).toEqual({
        id: '11111',
        name: 'project1',
        projectTypeKey: SERVICE_DESK,
        serviceDeskId: '12345',
      })
    })
})
