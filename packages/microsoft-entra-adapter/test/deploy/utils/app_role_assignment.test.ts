/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { collections } from '@salto-io/lowerdash'
import { AdjustFunction } from '../../../src/definitions/deploy/types'
import { createDefinitionForAppRoleAssignment } from '../../../src/definitions/deploy/utils'
import { contextMock } from '../../mocks'

const { makeArray } = collections.array

describe(`${createDefinitionForAppRoleAssignment.name}`, () => {
  it('should return the correct definition using the parent resource name', () => {
    const definitions = createDefinitionForAppRoleAssignment({ parentResourceName: 'parents', typeName: 'someType' })
    const {
      requestsByAction: { customizations },
    } = definitions.someType
    expect(customizations?.add).toBeDefined()
    expect(customizations?.remove).toBeDefined()
    expect(customizations?.modify).not.toBeDefined()

    expect(customizations?.add).toHaveLength(1)
    expect(customizations?.add?.[0].request.endpoint?.path).toEqual('/parents/{parent_id}/appRoleAssignments')
    expect(customizations?.remove?.[0].request.endpoint?.path).toEqual('/parents/{parent_id}/appRoleAssignments/{id}')
  })

  describe('adjust function', () => {
    let adjust: AdjustFunction | undefined
    beforeAll(() => {
      const definitions = createDefinitionForAppRoleAssignment({ parentResourceName: 'parents', typeName: 'someType' })
      adjust = definitions.someType.requestsByAction.customizations?.add?.[0].request.transformation?.adjust
    })

    it('should throw an error if the item value is not a plain object', async () => {
      await expect(async () =>
        adjust?.({ value: 'not an object', typeName: 'someType', context: contextMock }),
      ).rejects.toThrow()
    })

    it('should throw an error if the parent_id is not a string', async () => {
      await expect(async () =>
        adjust?.({ value: {}, typeName: 'someType', context: { ...contextMock, additionalContext: { parent_id: 1 } } }),
      ).rejects.toThrow()
    })

    it('should add the parent_id to the value as a principalId', async () => {
      const adjustedItem = await adjust?.({
        value: { someField: 'someValue' },
        typeName: 'someType',
        context: contextMock,
      })
      // Just for TS reasons - since the adjust function can return an array or a single item
      const adjustedItemAsArray = makeArray(adjustedItem)
      expect(adjustedItemAsArray).toHaveLength(1)
      expect(adjustedItemAsArray[0].value).toEqual({ someField: 'someValue', principalId: 'parent_id' })
    })
  })
})
