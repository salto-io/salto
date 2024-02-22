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
import {
  ElemID,
  getChangeData,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getFilterParams, mockClient } from '../../utils'
import { JIRA, PROJECT_TYPE } from '../../../src/constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../../src/filters/fields/constants'
import contextsProjectsFilter, { PROJECT_CONTEXTS_FIELD } from '../../../src/filters/fields/contexts_projects_filter'

describe('contexts_projects_filter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let contextType: ObjectType
  let projectType: ObjectType
  let projectInstance: InstanceElement
  let contextInstance: InstanceElement
  let otherProject: InstanceElement

  let elementsSource: ReadOnlyElementsSource

  beforeEach(() => {
    const { client, paginator } = mockClient()

    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
    })

    contextInstance = new InstanceElement('inst', contextType, {
      id: 1,
    })

    projectInstance = new InstanceElement('instance', projectType, {
      [PROJECT_CONTEXTS_FIELD]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
    })

    otherProject = new InstanceElement('otherProject', projectType, {
      [PROJECT_CONTEXTS_FIELD]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
    })

    elementsSource = buildElementsSourceFromElements([contextInstance, projectInstance, otherProject])

    filter = contextsProjectsFilter(
      getFilterParams({
        client,
        paginator,
        elementsSource,
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    it('should add the contexts to the projects', async () => {
      delete projectInstance.value[PROJECT_CONTEXTS_FIELD]
      contextInstance.value.projectIds = [new ReferenceExpression(projectInstance.elemID, projectInstance)]

      await filter.onFetch([projectInstance, contextInstance])

      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD]).toHaveLength(1)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0]).toBeInstanceOf(ReferenceExpression)
      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD][0].elemID).toEqual(contextInstance.elemID)

      expect(contextInstance.value.projectIds).toBeUndefined()
    })
    it('should not add the context to the project, if it is not a valid reference', async () => {
      delete projectInstance.value[PROJECT_CONTEXTS_FIELD]
      contextInstance.value.projectIds = [new ReferenceExpression(projectInstance.elemID)]

      await filter.onFetch([projectInstance, contextInstance])

      expect(projectInstance.value[PROJECT_CONTEXTS_FIELD]).toBeUndefined()
    })
  })

  describe('preDeploy', () => {
    it('should add the changes for the contexts on project addition', async () => {
      const changes = [toChange({ after: projectInstance })]
      await filter.preDeploy(changes)

      expect(changes).toHaveLength(2)
      expect(getChangeData(changes[1]).value.projectIds[0].elemID).toEqual(otherProject.elemID)
      expect(getChangeData(changes[1]).value.projectIds[1].elemID).toEqual(projectInstance.elemID)
    })

    it('should add the changes for the contexts on project removal', async () => {
      const changes = [toChange({ before: projectInstance })]
      await filter.preDeploy(changes)

      expect(changes).toHaveLength(2)
      expect(getChangeData(changes[1]).value.projectIds[0].elemID).toEqual(otherProject.elemID)
    })

    it('should add projectIds to addition contexts', async () => {
      delete contextInstance.value.id
      const changes = [toChange({ after: projectInstance }), toChange({ after: contextInstance })]
      await filter.preDeploy(changes)

      expect(changes).toHaveLength(2)
      expect(getChangeData(changes[1]).value.projectIds[0].elemID).toEqual(otherProject.elemID)
    })
  })

  describe('onDeploy', () => {
    it('should add the changes for the contexts', async () => {
      contextInstance.value.projectIds = [new ReferenceExpression(projectInstance.elemID, projectInstance)]

      const changes = [toChange({ after: contextInstance })]
      await filter.onDeploy(changes)

      expect(contextInstance.value.projectIds).toBeUndefined()
    })
  })
})
