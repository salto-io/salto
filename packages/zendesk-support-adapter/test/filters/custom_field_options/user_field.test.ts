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
import {
  ObjectType, ElemID, InstanceElement, isObjectType, isInstanceElement,
  ReferenceExpression, CORE_ANNOTATIONS, toChange,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../../src/config'
import ZendeskClient from '../../../src/client/client'
import { ZENDESK_SUPPORT } from '../../../src/constants'
import { paginate } from '../../../src/client/pagination'
import filterCreator from '../../../src/filters/custom_field_options/user_field'
import {
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME,
} from '../../../src/filters/custom_field_options/creator'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('user field filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  const parentTypeName = 'user_field'
  const childTypeName = 'user_field__custom_field_options'
  const parentObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, parentTypeName) })
  const childObjType = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, childTypeName) })
  const parent = new InstanceElement(
    'parent',
    parentObjType,
    {
      id: 11,
      name: 'parent',
      [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
        new ReferenceExpression(new ElemID(ZENDESK_SUPPORT, childTypeName, 'instance', 'child1')),
        new ReferenceExpression(new ElemID(ZENDESK_SUPPORT, childTypeName, 'instance', 'child2')),
      ],
    },
  )
  const child1 = new InstanceElement(
    'child1',
    childObjType,
    { id: 22, name: 'child1', value: 'v1', default: false },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )
  const child2 = new InstanceElement(
    'child2',
    childObjType,
    { id: 33, name: 'child2', value: 'v2', default: true },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
    }) as FilterType
  })

  describe('onFetch', () => {
    it('should add the default option field and remove default from children', async () => {
      const elements = [parentObjType, childObjType, parent, child1, child2].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements).toHaveLength(5)
      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk_support.user_field',
          'zendesk_support.user_field.instance.parent',
          'zendesk_support.user_field__custom_field_options',
          'zendesk_support.user_field__custom_field_options.instance.child1',
          'zendesk_support.user_field__custom_field_options.instance.child2',
        ])
      const userFieldType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === parentTypeName)
      expect(userFieldType).toBeDefined()
      expect(userFieldType?.fields?.[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]).toBeDefined()
      const userFieldInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === parentTypeName)
      expect(userFieldInstances).toHaveLength(1)
      const cloneduserField = parent.clone()
      const child2AfterFilter = elements
        .find(e => e.elemID.isEqual(child2.elemID)) as InstanceElement
      expect(child2AfterFilter).toBeDefined()
      cloneduserField
        .value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME] = new ReferenceExpression(
          child2AfterFilter.elemID, child2AfterFilter
        )
      expect(userFieldInstances[0]).toEqual(cloneduserField)
      const userFieldOptionType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === childTypeName)
      expect(userFieldOptionType).toBeDefined()
      const userFieldOptionInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === childTypeName)
      expect(userFieldOptionInstances).toHaveLength(2)
      userFieldOptionInstances.forEach(option => {
        expect(option.value.default).not.toBeDefined()
      })
    })
    it('should not add default option field if there is no default', async () => {
      const elements = [parentObjType, childObjType, parent, child1].map(e => e.clone())
      await filter.onFetch(elements)
      const userFieldInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === parentTypeName)
      expect(userFieldInstances).toHaveLength(1)
      expect(userFieldInstances[0].value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME])
        .not.toBeDefined()
      const userFieldOptionInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === childTypeName)
      expect(userFieldOptionInstances).toHaveLength(1)
      expect(userFieldOptionInstances[0].value.default).not.toBeDefined()
    })
    it('should not do anything if there is no parent type', async () => {
      const elements = [childObjType, parent, child1, child2].map(e => e.clone())
      await filter.onFetch(elements)
      const userFieldInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === parentTypeName)
      expect(userFieldInstances).toHaveLength(1)
      expect(userFieldInstances[0].value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME])
        .not.toBeDefined()
    })
  })
  describe('preDeploy', () => {
    const resolvedParent = new InstanceElement(
      'parent',
      parentObjType,
      {
        id: 11,
        name: 'parent',
        [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
          { id: 22, name: 'child1', value: 'v1' },
        ],
      },
    )

    it('should add null as id for new childs', async () => {
      const clonedResolvedParentBefore = resolvedParent.clone()
      const clonedResolvedParentAfter = resolvedParent.clone()
      clonedResolvedParentAfter.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
        { id: 22, name: 'child1', value: 'v1', default: false },
        { name: 'child2', value: 'v2', default: false },
      ]
      const change = toChange({
        before: clonedResolvedParentBefore, after: clonedResolvedParentAfter,
      })
      await filter?.preDeploy([change])
      expect(clonedResolvedParentAfter.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]).toEqual([
        { id: 22, name: 'child1', value: 'v1', default: false },
        { id: null, name: 'child2', value: 'v2', default: false },
      ])
    })
  })
  describe('onDeploy', () => {
    const resolvedParent = new InstanceElement(
      'parent',
      parentObjType,
      {
        id: 11,
        name: 'parent',
        [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
          { id: 22, name: 'child1', value: 'v1', default: false },
        ],
      },
    )
    it('should remove the null from id for new childs', async () => {
      const clonedResolvedParentBefore = resolvedParent.clone()
      const clonedResolvedParentAfter = resolvedParent.clone()
      clonedResolvedParentAfter.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
        { id: 22, name: 'child1', value: 'v1' },
        { id: null, name: 'child2', value: 'v2' },
      ]
      const change = toChange({
        before: clonedResolvedParentBefore, after: clonedResolvedParentAfter,
      })
      await filter?.onDeploy([change])
      expect(clonedResolvedParentAfter.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]).toEqual([
        { id: 22, name: 'child1', value: 'v1' },
        { name: 'child2', value: 'v2' },
      ])
    })
  })
  describe('deploy', () => {
    const option1 = new InstanceElement(
      'option1',
      childObjType,
      { name: 'option1', value: 'v3', default: false },
    )
    const option2 = new InstanceElement(
      'option2',
      childObjType,
      { name: 'option2', value: 'v4', default: true },
    )
    const userField = new InstanceElement(
      'userField',
      parentObjType,
      {
        name: 'parent',
        [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [option1.value, option2.value],
      },
    )
    describe('changes in both parent and child', () => {
      it('should pass the correct params to deployChange when we add both parent and children', async () => {
        const clonedElements = [userField, option1, option2].map(e => e.clone())
        mockDeployChange
          .mockImplementation(async () => ({
            user_field: { id: 1, custom_field_options: [{ id: 2, value: 'v3' }, { id: 3, value: 'v4' }] },
          }))
        const res = await filter.deploy(clonedElements.map(e => ({ action: 'add', data: { after: e } })))
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith(
          { action: 'add', data: { after: clonedElements[0] } },
          expect.anything(),
          expect.anything(),
          [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        )
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        const expectedElements = [userField, option1, option2].map(e => e.clone())
        expectedElements[0].value.id = 1
        expectedElements[1].value.id = 2
        expectedElements[2].value.id = 3
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges)
          .toEqual(expectedElements.map(e => ({ action: 'add', data: { after: e } })))
      })
      it('should pass the correct params to deployChange when we modify both parent and children', async () => {
        const clonedElements = [userField, option1, option2]
          .map(e => e.clone())
          .map((inst, index) => {
            inst.value.id = index
            return inst
          })
        const clonedElementsAfter = clonedElements
          .map(e => e.clone())
          .map(inst => {
            inst.value.name = `${inst.value.name} - edited`
            return inst
          })
        mockDeployChange
          .mockImplementation(async () => ({
            user_field: { id: 111, custom_field_options: [{ id: 222, value: 'v3' }, { id: 333, value: 'v4' }] },
          }))
        const res = await filter.deploy(clonedElements.map((e, index) =>
          ({ action: 'modify', data: { before: e, after: clonedElementsAfter[index] } })))
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith(
          { action: 'modify', data: { before: clonedElements[0], after: clonedElementsAfter[0] } },
          expect.anything(),
          expect.anything(),
          [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        )
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges)
          .toEqual(clonedElements.map((e, index) =>
            ({ action: 'modify', data: { before: e, after: clonedElementsAfter[index] } })))
      })
      it('should pass the correct params to deployChange when we remove both parent and children', async () => {
        const clonedElements = [userField, option1, option2]
          .map(e => e.clone())
          .map((inst, index) => {
            inst.value.id = index
            return inst
          })
        mockDeployChange
          .mockImplementation(async () => ({ }))
        const res = await filter.deploy(clonedElements.map(e =>
          ({ action: 'remove', data: { before: e } })))
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith(
          { action: 'remove', data: { before: clonedElements[0] } },
          expect.anything(),
          expect.anything(),
          [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        )
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges)
          .toEqual(clonedElements.map(e =>
            ({ action: 'remove', data: { before: e } })))
      })
      it('should return error if deployChange failed', async () => {
        const cloneduserField = userField.clone()
        mockDeployChange.mockImplementation(async () => {
          throw new Error('err')
        })
        const res = await filter.deploy([{ action: 'add', data: { after: cloneduserField } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith(
          { action: 'add', data: { after: cloneduserField } },
          expect.anything(),
          expect.anything(),
          [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        )
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
        expect(res.deployResult.appliedChanges).toHaveLength(0)
      })
      it('should not add id to children if response is invalid', async () => {
        const clonedElements = [userField, option1, option2].map(e => e.clone())
        mockDeployChange
          .mockImplementation(async () => ({
            user_field: { id: 1, custom_field_options: [{ id: 2, value: 'v3' }, { id: 3, value: 'v4' }, 'bla'] },
          }))
        const res = await filter.deploy(clonedElements.map(e => ({ action: 'add', data: { after: e } })))
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith(
          { action: 'add', data: { after: clonedElements[0] } },
          expect.anything(),
          expect.anything(),
          [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        )
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        const expectedElements = [userField, option1, option2].map(e => e.clone())
        expectedElements[0].value.id = 1
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges)
          .toEqual(expectedElements.map(e => ({ action: 'add', data: { after: e } })))
      })
    })
    describe('changes just in parent', () => {
      it('should deploy regularly if there is no options in parent', async () => {
        const cloneduserField = userField.clone()
        delete cloneduserField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]
        mockDeployChange.mockImplementation(async () => ({ user_field: { id: 1 } }))
        const res = await filter.deploy([
          { action: 'add', data: { after: cloneduserField } },
        ])
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith(
          { action: 'add', data: { after: cloneduserField } },
          expect.anything(),
          expect.anything(),
          [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        )
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        const expecteduserField = userField.clone()
        expecteduserField.value.id = 1
        delete expecteduserField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.appliedChanges)
          .toEqual([{ action: 'add', data: { after: expecteduserField } }])
      })
    })
    describe('changes just in child', () => {
      it('should pass the correct params to deployChange', async () => {
        const id = 1
        const clonedChildBefore = option1.clone()
        const clonedChildAfter = option1.clone()
        clonedChildBefore.value.id = id
        clonedChildAfter.value.id = id
        clonedChildAfter.value.value = 'v33'
        mockDeployChange.mockImplementation(async () => ({ }))
        const res = await filter.deploy([
          { action: 'modify', data: { before: clonedChildBefore, after: clonedChildAfter } },
        ])
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith(
          { action: 'modify', data: { before: clonedChildBefore, after: clonedChildAfter } },
          expect.anything(),
          expect.anything(),
          undefined,
        )
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.appliedChanges)
          .toEqual([{ action: 'modify', data: { before: clonedChildBefore, after: clonedChildAfter } }])
      })
    })
  })
})
