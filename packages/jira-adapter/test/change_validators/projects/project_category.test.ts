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
  toChange,
  ObjectType,
  ElemID,
  InstanceElement,
  ChangeValidator,
  BuiltinTypes,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { mockClient } from '../../utils'
import { projectCategoryValidator } from '../../../src/change_validators/projects/project_category'
import { JIRA } from '../../../src/constants'

describe('projectCategoryValidator', () => {
  let projectType: ObjectType
  let projectCategoryType: ObjectType
  let projectInstance: InstanceElement
  let categoryInstance: InstanceElement
  let changeValidator: ChangeValidator

  beforeEach(() => {
    const { client } = mockClient(true)
    changeValidator = projectCategoryValidator(client)

    projectCategoryType = new ObjectType({
      elemID: new ElemID(JIRA, 'ProjectCategory'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
      },
    })

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
      fields: {
        projectCategory: { refType: projectCategoryType },
      },
    })

    categoryInstance = new InstanceElement('category', projectCategoryType, {
      name: 'category',
      description: 'first',
      id: '10000',
    })

    projectInstance = new InstanceElement('project', projectType, {
      projectCategory: new ReferenceExpression(categoryInstance.elemID, categoryInstance),
    })
  })
  it('should return an error when removing a category from a project using DC', async () => {
    const afterInstance = projectInstance.clone()
    afterInstance.value.projectCategory = undefined
    expect(
      await changeValidator([
        toChange({
          before: projectInstance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([
      {
        elemID: afterInstance.elemID,
        severity: 'Warning',
        message: "Can't remove an existing project's category",
        detailedMessage:
          "Jira Data Center does not support removing an existing project's category. The existing category will be retained.",
      },
    ])
  })
  it('should do nothing for a regular change in the project category', async () => {
    categoryInstance.value.name = 'new name'
    const afterInstance = projectInstance.clone()
    afterInstance.value.projectCategory = new ReferenceExpression(categoryInstance.elemID, categoryInstance)
    expect(
      await changeValidator([
        toChange({
          before: projectInstance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([])

    projectInstance.value.projectCategory = undefined
    expect(
      await changeValidator([
        toChange({
          before: projectInstance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([])
  })

  it('should not return an error when using cloud', async () => {
    const { client } = mockClient()
    changeValidator = projectCategoryValidator(client)
    const afterInstance = projectInstance.clone()
    afterInstance.value.projectCategory = undefined

    expect(
      await changeValidator([
        toChange({
          before: projectInstance,
          after: afterInstance,
        }),
      ]),
    ).toEqual([])
  })
})
