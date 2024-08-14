/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import archivedProjectComponentsFilter from '../../src/filters/archived_project_components'
import { getFilterParams } from '../utils'

describe('archivedProjectComponentsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let project: InstanceElement
  let projectComponent1: InstanceElement
  let projectComponent2: InstanceElement

  beforeEach(async () => {
    filter = archivedProjectComponentsFilter(getFilterParams()) as typeof filter

    const projectType = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
    })

    const projectComponentType = new ObjectType({
      elemID: new ElemID(JIRA, 'ProjectComponent'),
    })

    projectComponent1 = new InstanceElement('instance3', projectComponentType, {
      archived: false,
    })

    projectComponent2 = new InstanceElement('instance4', projectComponentType, {
      archived: true,
    })

    project = new InstanceElement('project', projectType, {
      components: [
        new ReferenceExpression(projectComponent1.elemID, {}),
        new ReferenceExpression(projectComponent2.elemID, {}),
      ],
    })
  })

  describe('onFetch', () => {
    it('remove archived components', async () => {
      const elements = [project, projectComponent1, projectComponent2]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(2)
      expect(elements[0].elemID.getFullName()).toBe(project.elemID.getFullName())
      expect(elements[1].elemID.getFullName()).toBe(projectComponent1.elemID.getFullName())
      expect(project.value.components).toEqual([new ReferenceExpression(projectComponent1.elemID, {})])
    })

    it('remove archive value', async () => {
      const elements = [projectComponent1]
      await filter.onFetch([projectComponent1])
      expect(elements[0].elemID.getFullName()).toBe(projectComponent1.elemID.getFullName())
      expect(projectComponent1.value.archived).toBeUndefined()
    })
  })
})
