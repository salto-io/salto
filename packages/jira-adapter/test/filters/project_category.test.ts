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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { filterUtils, deployment } from '@salto-io/adapter-components'
import JiraClient from '../../src/client/client'
import { JIRA } from '../../src/constants'
import projectCategoryFilter from '../../src/filters/project_category'
import { getFilterParams, mockClient } from '../utils'

const DELETED_CATEGORY = -1

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn(),
    },
  }
})

describe('projectCategoryFilter', () => {
  let filter: filterUtils.FilterWith<'onDeploy' | 'preDeploy'>
  let projectInstance: InstanceElement
  let firstCategoryInstance: InstanceElement
  let secondCategoryInstance: InstanceElement
  let client: JiraClient
  let projectType: ObjectType
  let projectCategoryType: ObjectType
  const deployChangeMock = deployment.deployChange as jest.MockedFunction<
    typeof deployment.deployChange
  >

  beforeEach(async () => {
    deployChangeMock.mockClear()
    const { client: cli } = mockClient(false)
    client = cli
    filter = projectCategoryFilter(getFilterParams({ client })) as typeof filter

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

    firstCategoryInstance = new InstanceElement(
      'firstCategory',
      projectCategoryType,
      {
        name: 'firstCategory',
        description: 'first',
        id: '10000',
      }
    )

    secondCategoryInstance = new InstanceElement(
      'secondCategory',
      projectCategoryType,
      {
        name: 'secondCategory',
        description: 'second',
        id: '10001',
      }
    )

    projectInstance = new InstanceElement(
      'project',
      projectType,
      {
        projectCategory: new ReferenceExpression(firstCategoryInstance.elemID, firstCategoryInstance),
      }
    )
  })
  describe('preDeploy', () => {
    it('should convert projectCategory to categoryId while its an addition change', async () => {
      await filter.preDeploy([toChange({ after: projectInstance })])
      expect(projectInstance.value.categoryId).toEqual('10000')
      expect(projectInstance.value.projectCategory).toBeUndefined()
    })
    it('should convert projectCategory to categoryId while its a modification change', async () => {
      const afterInstance = projectInstance.clone()
      afterInstance.value.projectCategory = new ReferenceExpression(
        secondCategoryInstance.elemID,
        secondCategoryInstance
      )
      await filter.preDeploy([toChange({ before: projectInstance, after: afterInstance })])
      expect(afterInstance.value.categoryId).toEqual('10001')
      expect(afterInstance.value.projectCategory).toBeUndefined()
    })
    it('should convert projectCategory to categoryId while deleting the category', async () => {
      const afterInstance = projectInstance.clone()
      afterInstance.value.projectCategory = undefined
      await filter.preDeploy([toChange({ before: projectInstance, after: afterInstance })])
      expect(afterInstance.value.categoryId).toEqual(DELETED_CATEGORY)
      expect(afterInstance.value.projectCategory).toBeUndefined()
    })
    it('should do nothing while its a removing change', async () => {
      await filter.preDeploy([toChange({ before: projectInstance })])
      expect(projectInstance.value.categoryId).toBeUndefined()
      expect(projectInstance.value.projectCategory)
        .toEqual(new ReferenceExpression(firstCategoryInstance.elemID, firstCategoryInstance))
    })
    describe('onDeploy', () => {
      it('should convert back categoryId to projectCategory while its an addition change', async () => {
        await filter.preDeploy([toChange({ after: projectInstance })])
        await filter.onDeploy([toChange({ after: projectInstance })])
        expect(projectInstance.value.categoryId).toBeUndefined()
        expect(projectInstance.value.projectCategory)
          .toEqual(new ReferenceExpression(firstCategoryInstance.elemID, firstCategoryInstance))
      })
      it('should convert back categoryId to projectCategory while its a modification change', async () => {
        const afterInstance = projectInstance.clone()
        afterInstance.value.projectCategory = new ReferenceExpression(
          secondCategoryInstance.elemID,
          secondCategoryInstance
        )
        await filter.preDeploy([toChange({ before: projectInstance, after: afterInstance })])
        await filter.onDeploy([toChange({ before: projectInstance, after: afterInstance })])
        expect(afterInstance.value.categoryId).toBeUndefined()
        expect(afterInstance.value.projectCategory)
          .toEqual(new ReferenceExpression(secondCategoryInstance.elemID, secondCategoryInstance))
      })
      it('should do nothing while its a removing change', async () => {
        await filter.preDeploy([toChange({ before: projectInstance })])
        expect(projectInstance.value.categoryId).toBeUndefined()
        expect(projectInstance.value.projectCategory)
          .toEqual(new ReferenceExpression(firstCategoryInstance.elemID, firstCategoryInstance))
      })
    })
  })
})
