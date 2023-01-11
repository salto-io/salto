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
import { ObjectType, ElemID, ReadOnlyElementsSource, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FIELD_CONTEXT_TYPE_NAME } from '../../src/filters/fields/constants'
import { PROJECT_CONTEXTS_FIELD } from '../../src/filters/fields/contexts_projects_filter'
import { globalProjectContextsValidator } from '../../src/change_validators/global_project_contexts'
import { JIRA, PROJECT_TYPE } from '../../src/constants'

describe('globalProjectContextsValidator', () => {
  let projectType: ObjectType
  let contextType: ObjectType
  let elementsSource: ReadOnlyElementsSource
  let elements: InstanceElement[]
  let projectInstance: InstanceElement
  let contextInstance: InstanceElement

  beforeEach(() => {
    contextType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME) })
    projectType = new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) })

    contextInstance = new InstanceElement(
      'instance',
      contextType,
    )

    projectInstance = new InstanceElement(
      'instance',
      projectType,
    )

    elements = [contextInstance, projectInstance]
    elementsSource = buildElementsSourceFromElements(elements)
  })

  it('should return an error when setting a context that is used in a project to be global', async () => {
    projectInstance.value[PROJECT_CONTEXTS_FIELD] = [
      new ReferenceExpression(contextInstance.elemID, contextInstance),
    ]

    contextInstance.value.isGlobalContext = true

    expect(await globalProjectContextsValidator(
      [toChange({ after: contextInstance })],
      elementsSource
    )).toEqual([
      {
        elemID: contextInstance.elemID,
        severity: 'Error',
        message: 'Global context cannot be used in individual projects',
        detailedMessage: `The context ${contextInstance.elemID.getFullName()} is set as global context, and therefore cannot be referenced from individual projects.`,
      },
    ])
  })

  it('should return and error when creating a non global context without references', async () => {
    expect(await globalProjectContextsValidator(
      [toChange({ after: contextInstance })],
      elementsSource
    )).toEqual([
      {
        elemID: contextInstance.elemID,
        severity: 'Error',
        message: 'Field context is not used in any project',
        detailedMessage: `The context ${contextInstance.elemID.getFullName()} is not used by any project and it is not a global context, so it cannot be created (this is generally safe to ignore, as this context would not have an effect on the account).`,
      },
    ])
  })

  it('should return an error when removing last references to a context', async () => {
    const projectBefore = projectInstance.clone()
    projectBefore.value[PROJECT_CONTEXTS_FIELD] = [
      new ReferenceExpression(contextInstance.elemID, contextInstance),
    ]

    projectInstance.value[PROJECT_CONTEXTS_FIELD] = [
      new ReferenceExpression(new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME, 'instance', 'other')),
    ]

    expect(await globalProjectContextsValidator(
      [toChange({ before: projectBefore, after: projectInstance })],
      elementsSource
    )).toEqual([
      {
        elemID: projectInstance.elemID,
        severity: 'Error',
        message: 'Cannot remove field context from a project',
        detailedMessage: `A field context which is not global must be referenced by at least one project. The deployment of jira.Project.instance.instance will result in the following contexts having no references: jira.CustomFieldContext.instance.instance. Therefore, the project cannot be deployed.
To solve this, either modify the project to keep a reference to these contexts, or remove the contexts from the workspace`,
      },
    ])
  })

  it('should not return an error when adding a reference to a context', async () => {
    const projectBefore = projectInstance.clone()
    projectInstance.value[PROJECT_CONTEXTS_FIELD] = [
      new ReferenceExpression(contextInstance.elemID, contextInstance),
    ]

    expect(await globalProjectContextsValidator(
      [toChange({ before: projectBefore, after: projectInstance })],
      elementsSource
    )).toEqual([])
  })

  it('should not return an error when adding a project', async () => {
    expect(await globalProjectContextsValidator(
      [toChange({ after: projectInstance })],
      elementsSource
    )).toEqual([])
  })

  it('should not return an error when removing a project', async () => {
    expect(await globalProjectContextsValidator(
      [toChange({ before: projectInstance })],
      elementsSource
    )).toEqual([])
  })
})
