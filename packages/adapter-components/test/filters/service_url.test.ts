/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  CORE_ANNOTATIONS,
  toChange,
  getChangeData,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter_utils'
import { Paginator } from '../../src/client'
import { serviceUrlFilterCreatorDeprecated } from '../../src/filters/service_url'
import { createMockQuery } from '../../src/fetch/query'

describe('service url filter', () => {
  type FilterType = FilterWith<'onFetch' | 'onDeploy'>
  let filter: FilterType
  const roleObjType = new ObjectType({ elemID: new ElemID('adapter', 'role') })
  const roleInst = new InstanceElement('role', roleObjType, { id: 11, name: 'role', obj: { inner: 'bar' } })
  const testObjType = new ObjectType({ elemID: new ElemID('adapter', 'test') })
  const testInst = new InstanceElement('test', testObjType, { id: 11, name: 'test' })
  const baseUrl = 'https://www.example.com'
  const objectType = new ObjectType({ elemID: new ElemID('adapter', 'foo') })
  const instWithParent = new InstanceElement(
    'instWithParent',
    objectType,
    { id: 'ab', name: 'instWithParent' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(roleInst.elemID, roleInst)] },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = serviceUrlFilterCreatorDeprecated(baseUrl)({
      client: {} as unknown,
      paginator: undefined as unknown as Paginator,
      fetchQuery: createMockQuery(),
      config: {
        apiDefinitions: {
          types: {
            role: {
              transformation: {
                serviceUrl: '/roles/{id}',
              },
            },
            foo: {
              transformation: { serviceUrl: 'roles/{_parent.0.id}/foo/{_parent.0.obj.inner}/{id}' },
            },
          },
          typeDefaults: {
            transformation: { idFields: ['id'] },
          },
          supportedTypes: {},
        },
      },
    }) as FilterType
  })

  describe('onFetch', () => {
    it('should add service url annotation if it is exist in the config', async () => {
      const elements = [roleInst, instWithParent].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'adapter.foo.instance.instWithParent',
        'adapter.role.instance.role',
      ])
      const [role, withParent] = elements
      expect(role.annotations).toEqual({
        [CORE_ANNOTATIONS.SERVICE_URL]: 'https://www.example.com/roles/11',
      })
      expect(withParent.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
        'https://www.example.com/roles/11/foo/bar/ab',
      )
    })
    it('should not add service url annotation if it is not exist in the config', async () => {
      const elements = [testInst].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['adapter.test.instance.test'])
      const [instance] = elements
      expect(instance.annotations).toEqual({})
    })
  })
  describe('onDeploy', () => {
    it('should add service url annotation if it is exist in the config', async () => {
      const instWithResolvedParent = instWithParent.clone()
      instWithResolvedParent.annotations[CORE_ANNOTATIONS.PARENT] = [roleInst.clone().value]
      const changes = [roleInst, instWithResolvedParent].map(e => e.clone()).map(inst => toChange({ after: inst }))
      await filter.onDeploy(changes)
      expect(
        changes
          .map(getChangeData)
          .map(e => e.elemID.getFullName())
          .sort(),
      ).toEqual(['adapter.foo.instance.instWithParent', 'adapter.role.instance.role'])
      const [role, withParent] = changes.map(getChangeData)
      expect(role.annotations).toEqual({
        [CORE_ANNOTATIONS.SERVICE_URL]: 'https://www.example.com/roles/11',
      })
      expect(withParent.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
        'https://www.example.com/roles/11/foo/bar/ab',
      )
    })
    it('should not add service url annotation if it is not exist in the config', async () => {
      const changes = [testInst].map(e => e.clone()).map(inst => toChange({ after: inst }))
      await filter.onDeploy(changes)
      expect(
        changes
          .map(getChangeData)
          .map(e => e.elemID.getFullName())
          .sort(),
      ).toEqual(['adapter.test.instance.test'])
      const instance = getChangeData(changes[0])
      expect(instance.annotations).toEqual({})
    })
    it('should not add service url annotation if the change is irrelevant', async () => {
      const changes = [roleInst]
        .map(e => e.clone())
        .map(inst => toChange({ before: inst.clone(), after: inst.clone() }))
      await filter.onDeploy(changes)
      expect(
        changes
          .map(getChangeData)
          .map(e => e.elemID.getFullName())
          .sort(),
      ).toEqual(['adapter.role.instance.role'])
      const instance = getChangeData(changes[0])
      expect(instance.annotations).toEqual({})
    })
  })
})
