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
  let project2Instance: InstanceElement
  let firstCategoryInstance: InstanceElement
  let secondCategoryInstance: InstanceElement
  let client: JiraClient
  let projectType: ObjectType
  let projectCategoryType: ObjectType
  const deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>

  beforeAll(async () => {
    const { client: cli } = mockClient()
    client = cli
    filter = projectCategoryFilter(getFilterParams({ client })) as typeof filter

    projectCategoryType = new ObjectType({
      elemID: new ElemID(JIRA, 'ProjectCategory'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
      },
    })
    projectType = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
      fields: {
        projectCategory: { refType: projectCategoryType },
      },
    })
  })

  beforeEach(async () => {
    deployChangeMock.mockClear()
    firstCategoryInstance = new InstanceElement('firstCategory', projectCategoryType, {
      id: '10000',
    })
    secondCategoryInstance = new InstanceElement('secondCategory', projectCategoryType, {
      id: '10001',
    })
    projectInstance = new InstanceElement('project', projectType, {
      projectCategory: new ReferenceExpression(firstCategoryInstance.elemID, firstCategoryInstance),
      id: '1',
      key: 'key1',
    })
    project2Instance = new InstanceElement('project2', projectType, {
      projectCategory: new ReferenceExpression(secondCategoryInstance.elemID, secondCategoryInstance),
      key: 'key2',
      id: '2',
    })
  })
  describe('preDeploy using cloud', () => {
    it('should convert projectCategory to categoryId when its an addition change', async () => {
      await filter.preDeploy([toChange({ after: projectInstance }), toChange({ after: project2Instance })])
      expect(projectInstance.value.categoryId).toEqual('10000')
      expect(projectInstance.value.projectCategory).toBeUndefined()
    })
    it('should convert projectCategory to categoryId when its a modification change', async () => {
      await filter.preDeploy([
        toChange({ before: projectInstance, after: project2Instance }),
        toChange({ after: projectInstance }),
      ])
      expect(project2Instance.value.categoryId).toEqual('10001')
      expect(project2Instance.value.projectCategory).toBeUndefined()
    })
    it('should convert projectCategory to categoryId when deleting the category', async () => {
      const afterInstance = projectInstance.clone()
      afterInstance.value.projectCategory = undefined
      await filter.preDeploy([toChange({ before: projectInstance, after: afterInstance })])
      expect(afterInstance.value.categoryId).toEqual(DELETED_CATEGORY)
      expect(afterInstance.value.projectCategory).toBeUndefined()
    })
    it('should do nothing when its a removing change', async () => {
      await filter.preDeploy([toChange({ before: projectInstance })])
      expect(projectInstance.value.categoryId).toBeUndefined()
      expect(projectInstance.value.projectCategory).toEqual(
        new ReferenceExpression(firstCategoryInstance.elemID, firstCategoryInstance),
      )
    })
  })
  describe('preDeploy using DC', () => {
    beforeAll(async () => {
      const { client: cli } = mockClient(true)
      client = cli
      filter = projectCategoryFilter(getFilterParams({ client })) as typeof filter
    })
    it('should convert projectCategory to categoryId when its an addition change', async () => {
      await filter.preDeploy([toChange({ after: projectInstance })])
      expect(projectInstance.value.categoryId).toEqual('10000')
      expect(projectInstance.value.projectCategory).toBeUndefined()
    })
    it('should convert projectCategory to categoryId when its a modification change', async () => {
      const afterInstance = projectInstance.clone()
      afterInstance.value.projectCategory = new ReferenceExpression(
        secondCategoryInstance.elemID,
        secondCategoryInstance,
      )
      await filter.preDeploy([toChange({ before: projectInstance, after: afterInstance })])
      expect(afterInstance.value.categoryId).toEqual('10001')
      expect(afterInstance.value.projectCategory).toBeUndefined()
    })
    it('should convert projectCategory to categoryId when not a reference', async () => {
      projectInstance.value.projectCategory = '10000'
      await filter.preDeploy([toChange({ after: projectInstance })])
      expect(projectInstance.value.categoryId).toEqual('10000')
      expect(projectInstance.value.projectCategory).toBeUndefined()
    })
    it('should not convert projectCategory to categoryId when deleting the category', async () => {
      const afterInstance = projectInstance.clone()
      afterInstance.value.projectCategory = undefined
      await filter.preDeploy([toChange({ before: projectInstance, after: afterInstance })])
      expect(afterInstance.value.categoryId).toBeUndefined()
    })
  })

  describe('onDeploy', () => {
    it('should convert back categoryId to projectCategory when its an addition change', async () => {
      delete projectInstance.value.id
      delete project2Instance.value.id
      await filter.preDeploy([toChange({ after: projectInstance }), toChange({ after: project2Instance })])
      await filter.onDeploy([toChange({ after: projectInstance }), toChange({ after: project2Instance })])
      expect(projectInstance.value.categoryId).toBeUndefined()
      expect(projectInstance.value.projectCategory).toEqual(
        new ReferenceExpression(firstCategoryInstance.elemID, firstCategoryInstance),
      )
      expect(project2Instance.value.projectCategory).toEqual(
        new ReferenceExpression(secondCategoryInstance.elemID, secondCategoryInstance),
      )
    })
    it('should convert back categoryId to projectCategory when its a modification change', async () => {
      await filter.preDeploy([
        toChange({ before: projectInstance, after: project2Instance }),
        toChange({ after: projectInstance }),
      ])
      await filter.onDeploy([
        toChange({ before: projectInstance, after: project2Instance }),
        toChange({ after: projectInstance }),
      ])
      expect(project2Instance.value.categoryId).toBeUndefined()
      expect(project2Instance.value.projectCategory).toEqual(
        new ReferenceExpression(secondCategoryInstance.elemID, secondCategoryInstance),
      )
    })
    it('should do nothing when its a removing change', async () => {
      await filter.preDeploy([toChange({ before: projectInstance })])
      await filter.onDeploy([toChange({ before: projectInstance })])
      expect(projectInstance.value.categoryId).toBeUndefined()
      expect(projectInstance.value.projectCategory).toEqual(
        new ReferenceExpression(firstCategoryInstance.elemID, firstCategoryInstance),
      )
    })
    it('should insert categoryId to projectCategory when the project was not found in the Record', async () => {
      const afterInstance = projectInstance.clone()
      afterInstance.value.key = 'key3'
      afterInstance.value.categoryId = '10000'
      delete afterInstance.value.projectCategory
      await filter.onDeploy([toChange({ before: projectInstance, after: afterInstance })])
      expect(afterInstance.value.categoryId).toBeUndefined()
      expect(afterInstance.value.projectCategory).toEqual('10000')
    })
    it('should not crash when no categoryID', async () => {
      await filter.onDeploy([toChange({ after: projectInstance })])
    })
  })
})
