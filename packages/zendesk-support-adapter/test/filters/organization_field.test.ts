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
  ObjectType, ElemID, InstanceElement,
  ReferenceExpression, CORE_ANNOTATIONS, toChange,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator, {
  ORG_FIELD_OPTION_TYPE_NAME, ORG_FIELD_TYPE_NAME, CUSTOM_FIELD_OPTIONS_FIELD_NAME,
} from '../../src/filters/organization_field'

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

describe('organization field filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const parentTypeName = ORG_FIELD_TYPE_NAME
  const childTypeName = ORG_FIELD_OPTION_TYPE_NAME
  const parentObjType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, parentTypeName),
  })
  const childObjType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, childTypeName),
  })

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
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })
  describe('deploy', () => {
    const resolvedParent = new InstanceElement(
      'parent',
      parentObjType,
      {
        title: 'parent',
        type: 'dropdown',
        key: 'parent',
        [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
          { name: 'name1', value: 'v1' },
          { name: 'name2', value: 'v2' },
        ],
      },
    )
    const child1Resolved = new InstanceElement(
      'child1',
      childObjType,
      { name: 'name1', value: 'v1' },
    )
    const child2Resolved = new InstanceElement(
      'child2',
      childObjType,
      { name: 'name2', value: 'v2' },
    );
    [child1Resolved, child2Resolved].forEach(resolved => {
      resolved.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(resolvedParent.elemID, resolvedParent),
      ]
    })

    it('should pass the correct params to deployChange when we add both parent and children', async () => {
      const clonedElements = [resolvedParent, child1Resolved, child2Resolved].map(e => e.clone())
      mockDeployChange
        .mockImplementation(async () => ({
          organization_field: { id: 11, [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [{ id: 22, value: 'v1' }, { id: 33, value: 'v2' }] },
        }))
      const changes = clonedElements.map(e => toChange({ after: e }))
      const res = await filter.deploy(changes)
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'add', data: { after: clonedElements[0] } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      const expectedElements = [resolvedParent, child1Resolved, child2Resolved].map(e => e.clone())
      expectedElements[0].value.id = 11
      expectedElements[1].value.id = 22
      expectedElements[2].value.id = 33
      expect(res.deployResult.appliedChanges).toHaveLength(3)
      expect(res.deployResult.appliedChanges)
        .toEqual(expectedElements.map(e => ({ action: 'add', data: { after: e } })))
    })
    it('should pass the correct params to deployChange when we remove both parent and children', async () => {
      const clonedElements = [resolvedParent, child1Resolved, child2Resolved].map(e => e.clone())
      clonedElements[0].value.id = 11
      clonedElements[1].value.id = 22
      clonedElements[2].value.id = 33
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy(clonedElements.map(e => ({ action: 'remove', data: { before: e } })))
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'remove', data: { before: clonedElements[0] } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(3)
      expect(res.deployResult.appliedChanges)
        .toEqual(clonedElements.map(e => ({ action: 'remove', data: { before: e } })))
    })
    it('should pass the correct params to deployChange when we modify both parent and children', async () => {
      const beforeElements = [resolvedParent, child1Resolved, child2Resolved].map(e => e.clone())
      beforeElements[0].value.id = 11
      beforeElements[1].value.id = 22
      beforeElements[2].value.id = 33
      const afterElements = beforeElements
        .map(e => e.clone())
        .map(e => {
          e.value.name = `${e.value.name}-edited`
          return e
        })
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy(beforeElements.map((e, i) => ({
        action: 'modify', data: { before: e, after: afterElements[i] },
      })))
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'modify', data: { before: beforeElements[0], after: afterElements[0] } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(3)
      expect(res.deployResult.appliedChanges)
        .toEqual(beforeElements
          .map((e, i) => ({ action: 'modify', data: { before: e, after: afterElements[i] } })))
    })
    it('should pass the correct params to deployChange when we modify only the children', async () => {
      const beforeElements = [child1Resolved, child2Resolved].map(e => e.clone())
      const clonedResolvedParent = resolvedParent.clone()
      clonedResolvedParent.value.id = 11
      beforeElements[0].value.id = 22
      beforeElements[1].value.id = 33
      const afterElements = beforeElements
        .map(e => e.clone())
        .map(e => {
          e.value.name = `${e.value.name}-edited`
          return e
        })
      clonedResolvedParent.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = afterElements.map(e => e.value)
      afterElements.forEach(e => {
        e.annotations[CORE_ANNOTATIONS.PARENT] = [
          new ReferenceExpression(clonedResolvedParent.elemID, clonedResolvedParent),
        ]
      })
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy(beforeElements.map((e, i) => ({
        action: 'modify', data: { before: e, after: afterElements[i] },
      })))
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'modify', data: { before: clonedResolvedParent, after: clonedResolvedParent } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges)
        .toEqual(beforeElements
          .map((e, i) => ({ action: 'modify', data: { before: e, after: afterElements[i] } })))
    })
    it('should return error if deployChange failed', async () => {
      const clonedResolvedParent = resolvedParent.clone()
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: clonedResolvedParent } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith(
        { action: 'add', data: { after: clonedResolvedParent } },
        expect.anything(),
        expect.anything(),
        undefined,
      )
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should return error if child has no parent', async () => {
      const beforeClonedChild = child1Resolved.clone()
      beforeClonedChild.value.id = 22
      delete beforeClonedChild.annotations[CORE_ANNOTATIONS.PARENT]
      const afterClonedChild = beforeClonedChild.clone()
      afterClonedChild.value.name = `${afterClonedChild.value.name}-edited`
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{
        action: 'modify', data: { before: beforeClonedChild, after: afterClonedChild },
      }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
