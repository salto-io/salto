/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { MICROSOFT_SECURITY } from '../../../../../src/constants'
import { contextMock, objectTypeMock } from '../../../../mocks'
import { GROUP_LIFE_CYCLE_POLICY_FIELD_NAME } from '../../../../../src/constants/entra'
import {
  createDefinitionForGroupLifecyclePolicyGroupModification,
  getGroupLifecyclePolicyGroupModificationRequest,
} from '../../../../../src/definitions/deploy/entra/utils'

const { makeArray } = collections.array

const lifeCycleReference = new ReferenceExpression(new ElemID(MICROSOFT_SECURITY, 'obj', 'instance', 'test'), {
  value: { id: 'testLifeCyclePolicyId' },
})
const instanceWithLifecyclePolicyRef = new InstanceElement('instance', objectTypeMock, {
  [GROUP_LIFE_CYCLE_POLICY_FIELD_NAME]: lifeCycleReference,
})

describe(`${getGroupLifecyclePolicyGroupModificationRequest.name}`, () => {
  describe('addition', () => {
    it('should return the correct path', () => {
      const { endpoint } = getGroupLifecyclePolicyGroupModificationRequest('add')
      expect(endpoint?.path).toEqual('/groupLifecyclePolicies/{lifeCyclePolicyId}/addGroup')
    })

    it('should add the lifeCyclePolicyId to the context', () => {
      const change = toChange({ after: instanceWithLifecyclePolicyRef })
      const { context } = getGroupLifecyclePolicyGroupModificationRequest('add')
      const resultContext = context?.custom?.({})({ ...contextMock, change })
      expect(resultContext?.lifeCyclePolicyId).toEqual('testLifeCyclePolicyId')
    })
  })

  describe('removal', () => {
    it('should return the correct path', () => {
      const { endpoint } = getGroupLifecyclePolicyGroupModificationRequest('remove')
      expect(endpoint?.path).toEqual('/groupLifecyclePolicies/{lifeCyclePolicyId}/removeGroup')
    })

    it('should add the lifeCyclePolicyId to the context', () => {
      const change = toChange({ before: instanceWithLifecyclePolicyRef })
      const { context } = getGroupLifecyclePolicyGroupModificationRequest('remove')
      const resultContext = context?.custom?.({})({ ...contextMock, change })
      expect(resultContext?.lifeCyclePolicyId).toEqual('testLifeCyclePolicyId')
    })
  })

  describe('adjust function', () => {
    it('when the value is not a plain object', async () => {
      const { transformation } = getGroupLifecyclePolicyGroupModificationRequest('add')
      await expect(
        transformation?.adjust?.({ value: 'not an object', typeName: 'group', context: contextMock }),
      ).rejects.toThrow()
    })

    it('should return the object id as the group id', async () => {
      const { transformation } = getGroupLifecyclePolicyGroupModificationRequest('add')
      const adjustedItem = await transformation?.adjust?.({
        value: { id: 'id1', anotherField: ['ignoreThis'] },
        typeName: 'group',
        context: contextMock,
      })
      // Just for TS reasons - since the adjust function can return an array or a single item
      const adjustedItemAsArray = makeArray(adjustedItem)
      expect(adjustedItemAsArray).toHaveLength(1)
      expect(adjustedItemAsArray[0].value).toEqual({ groupId: 'id1' })
    })
  })
})

describe(`${createDefinitionForGroupLifecyclePolicyGroupModification.name}`, () => {
  describe('custom condition', () => {
    const instanceWithoutLifecyclePolicyRef = new InstanceElement('instance', objectTypeMock, {})

    it('should return false for non modification changes', () => {
      const change = toChange({ after: instanceWithLifecyclePolicyRef })
      const { condition } = createDefinitionForGroupLifecyclePolicyGroupModification('add')
      expect(condition?.custom?.({})({ ...contextMock, change })).toEqual(false)
    })

    describe('when the action is add', () => {
      it('should return false when the group lifecycle policy is not present', () => {
        const change = toChange({ before: instanceWithLifecyclePolicyRef, after: instanceWithoutLifecyclePolicyRef })
        const { condition } = createDefinitionForGroupLifecyclePolicyGroupModification('add')
        expect(condition?.custom?.({})({ ...contextMock, change })).toEqual(false)
      })

      it('should return true when the group lifecycle policy is present', () => {
        const change = toChange({ before: instanceWithoutLifecyclePolicyRef, after: instanceWithLifecyclePolicyRef })
        const { condition } = createDefinitionForGroupLifecyclePolicyGroupModification('add')
        expect(condition?.custom?.({})({ ...contextMock, change })).toEqual(true)
      })
    })

    describe('when the action is remove', () => {
      it('should return false when the group lifecycle policy is present', () => {
        const change = toChange({ before: instanceWithoutLifecyclePolicyRef, after: instanceWithLifecyclePolicyRef })
        const { condition } = createDefinitionForGroupLifecyclePolicyGroupModification('remove')
        expect(condition?.custom?.({})({ ...contextMock, change })).toEqual(false)
      })

      it('should return true when the group lifecycle policy is not present', () => {
        const change = toChange({ before: instanceWithLifecyclePolicyRef, after: instanceWithoutLifecyclePolicyRef })
        const { condition } = createDefinitionForGroupLifecyclePolicyGroupModification('remove')
        expect(condition?.custom?.({})({ ...contextMock, change })).toEqual(true)
      })
    })
  })
})
