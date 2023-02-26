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
import { ObjectType, ElemID, ReadOnlyElementsSource, InstanceElement, ReferenceExpression, toChange, Change, ChangeDataType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { PROJECT_CONTEXTS_FIELD } from '../../../src/filters/fields/contexts_projects_filter'
import { fieldContextValidator } from '../../../src/change_validators/field_contexts/field_contexts'
import { JIRA, PROJECT_TYPE } from '../../../src/constants'

const mockLogWarn = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn()
    .mockReturnValue({
      warn: jest.fn((...args) => mockLogWarn(...args)),
    }),
}))

describe('Field contexts', () => {
  let projectType: ObjectType
  let contextType: ObjectType
  let fieldType: ObjectType
  let elementsSource: ReadOnlyElementsSource
  let elements: InstanceElement[]
  let projectInstance: InstanceElement
  let contextInstance: InstanceElement
  let globalContextInstance: InstanceElement
  let fieldInstance: InstanceElement
  let changes: ReadonlyArray<Change<ChangeDataType>>

  beforeEach(() => {
    jest.clearAllMocks()
    contextType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME) })
    projectType = new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) })
    fieldType = new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) })

    contextInstance = new InstanceElement(
      'instance',
      contextType,
      {
        isGlobalContext: false,
      }
    )

    globalContextInstance = new InstanceElement(
      'instance2',
      contextType,
      {
        isGlobalContext: true,
      }
    )

    projectInstance = new InstanceElement(
      'project_name',
      projectType,
      {
        [PROJECT_CONTEXTS_FIELD]: [
          new ReferenceExpression(contextInstance.elemID, contextInstance),
        ],
      }
    )

    fieldInstance = new InstanceElement(
      'field_name',
      fieldType,
      {
        contexts: [
          new ReferenceExpression(contextInstance.elemID, contextInstance),
          new ReferenceExpression(globalContextInstance.elemID, globalContextInstance),
        ],
      }
    )

    elements = [contextInstance, projectInstance, fieldInstance, globalContextInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    changes = elements.map(element => toChange({ after: element }))
  })

  it('should return an error when setting a context that is used in a project to be global', async () => {
    elements = [projectInstance, globalContextInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    projectInstance.value[PROJECT_CONTEXTS_FIELD] = [
      new ReferenceExpression(globalContextInstance.elemID, globalContextInstance),
    ]
    expect(await fieldContextValidator(
      changes,
      elementsSource
    )).toEqual([
      {
        elemID: globalContextInstance.elemID,
        severity: 'Error',
        message: 'Global field context can’t be referenced by a project.',
        detailedMessage: 'This field context is global, but the following projects still reference it: project_name. Global field contexts can’t be referenced by projects. Please change this context to a non-global one, or add the projects without the reference to this deployment.',
      },
    ])
  })

  it('should return and error when creating a non global context without any other references to its field', async () => {
    elements = [projectInstance, contextInstance, fieldInstance]
    elementsSource = buildElementsSourceFromElements(elements)
    projectInstance.value[PROJECT_CONTEXTS_FIELD] = []
    fieldInstance.value.contexts = [
      new ReferenceExpression(contextInstance.elemID, contextInstance),
    ]
    expect(await fieldContextValidator(
      changes,
      elementsSource
    )).toEqual([
      {
        elemID: contextInstance.elemID,
        severity: 'Error',
        message: 'Non-global field context not referenced by any project.',
        detailedMessage: 'This field context is not global and isn’t referenced by any project, and can’t be deployed. In order to deploy this context, either make it global, or include the Project which references it in your deployment. Learn more: https://help.salto.io/en/articles/6947372-non-global-field-context-not-referenced-by-any-project',
      },
    ])
  })

  it('should return and error when creating a non global context with other references to its field', async () => {
    projectInstance.value[PROJECT_CONTEXTS_FIELD] = []
    expect(await fieldContextValidator(
      changes,
      elementsSource
    )).toEqual([
      {
        elemID: contextInstance.elemID,
        severity: 'Error',
        message: 'Non-global field context not referenced by any project. There are other valid contexts.',
        detailedMessage: 'This field context is not global and isn’t referenced by any project, and can’t be deployed. However, the field has other valid contexts, so it’s probably safe to continue without this context. Learn more: https://help.salto.io/en/articles/6947372-non-global-field-context-not-referenced-by-any-project',
      },
    ])
  })
  it('should not throw when one of the contexts is unresolved', async () => {
    fieldInstance.value.contexts.push(new ReferenceExpression(new ElemID(JIRA, 'unresolved'), undefined))
    await expect(fieldContextValidator(
      changes,
      elementsSource
    )).resolves.not.toThrow()
  })

  it('should not return an error when all contexts have valid references', async () => {
    expect(await fieldContextValidator(
      changes,
      elementsSource
    )).toEqual([])
  })
  it('should warn when one of the field contexts is not a reference', async () => {
    fieldInstance.value.contexts.push('not a reference')
    expect(await fieldContextValidator(
      changes,
      elementsSource
    )).toEqual([])
    expect(mockLogWarn).toHaveBeenCalledWith('Found a non reference expression in field jira.Field.instance.field_name')
  })
  it('should warn when one of the project contexts is not a reference', async () => {
    projectInstance.value[PROJECT_CONTEXTS_FIELD].push('not a reference')
    expect(await fieldContextValidator(
      changes,
      elementsSource
    )).toEqual([])
    expect(mockLogWarn).toHaveBeenCalledWith('Found a non reference expression in project jira.Project.instance.project_name')
  })
  it('should not return an error there are no changes', async () => {
    projectInstance.value[PROJECT_CONTEXTS_FIELD] = []
    expect(await fieldContextValidator(
      [],
      elementsSource
    )).toEqual([])
  })
  it('should not return an error element source is not defined', async () => {
    projectInstance.value[PROJECT_CONTEXTS_FIELD] = []
    expect(await fieldContextValidator(
      changes,
      undefined,
    )).toEqual([])
  })
})
