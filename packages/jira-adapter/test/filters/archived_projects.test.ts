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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import archivedProjectsFilter from '../../src/filters/archived_projects'
import { getFilterParams } from '../utils'

describe('archivedProjectsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let project1: InstanceElement
  let project2: InstanceElement
  let projectComponent1: InstanceElement
  let projectComponent2: InstanceElement
  let projectType: ObjectType
  let projectComponentType: ObjectType

  beforeEach(async () => {
    filter = archivedProjectsFilter(getFilterParams()) as typeof filter

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
    })

    projectComponentType = new ObjectType({
      elemID: new ElemID(JIRA, 'ProjectComponent'),
    })

    project1 = new InstanceElement(
      'instance1',
      projectType,
      {
        archived: false,
      }
    )

    project2 = new InstanceElement(
      'instance2',
      projectType,
      {
        archived: true,
      }
    )

    projectComponent1 = new InstanceElement(
      'instance3',
      projectComponentType,
      {
        archived: false,
      }
    )

    projectComponent2 = new InstanceElement(
      'instance4',
      projectComponentType,
      {
        archived: true,
      }
    )
  })

  describe('onFetch', () => {
    it('remove archived project and components', async () => {
      const elements = [project2, projectComponent2]
      await filter.onFetch(elements)
      expect(elements).toEqual([])
    })

    it('remove archive value', async () => {
      await filter.onFetch([project1, projectComponent1])
      expect(project1.value.archived).toBeUndefined()
      expect(projectComponent1.value.archived).toBeUndefined()
    })
  })
})
