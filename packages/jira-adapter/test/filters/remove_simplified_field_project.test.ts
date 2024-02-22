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

import { InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { PROJECT_TYPE } from '../../src/constants'
import { createEmptyType, getFilterParams } from '../utils'
import removeSimplifiedFieldProjectFilter from '../../src/filters/remove_simplified_field_project'

describe('removeSimplifiedFieldProjectFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
    id: 11111,
    name: 'project1',
    simplified: false,
    projectTypeKey: 'software',
  })
  const elements = [projectInstance]
  it('should remove simplified field from project instance', async () => {
    filter = removeSimplifiedFieldProjectFilter(getFilterParams({})) as typeof filter
    await filter.onFetch(elements)
    expect(projectInstance.value.simplified).toBeUndefined()
  })
})
