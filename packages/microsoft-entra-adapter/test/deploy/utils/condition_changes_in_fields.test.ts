/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement, getChangeData } from '@salto-io/adapter-api'
import { createCustomConditionCheckChangesInFields } from '../../../src/definitions/deploy/utils'
import { additionChangeMock, contextMock, objectTypeMock, removalChangeMock } from '../../mocks'

describe(`${createCustomConditionCheckChangesInFields.name}`, () => {
  describe('addition changes', () => {
    const additionContextMock = {
      ...contextMock,
      change: additionChangeMock,
    }

    it('should return a condition with a custom function that returns false when all fields are empty', () => {
      const { custom } = createCustomConditionCheckChangesInFields(['randomField1', 'randomField2'])
      expect(custom?.({})(additionContextMock)).toEqual(false)
    })

    it('should return a condition with a custom function that returns true when at least one field is not empty', () => {
      const { custom } = createCustomConditionCheckChangesInFields([
        Object.keys(additionChangeMock.data.after.value)[0],
      ])
      expect(custom?.({})(additionContextMock)).toEqual(true)
    })
  })

  describe('modification changes', () => {
    const instance = new InstanceElement('testInstance', objectTypeMock, {
      test: 'before',
    })

    it('should return a condition with a custom function that returns false when all fields are the same', () => {
      const modificationWithSameValues = {
        action: 'modify' as const,
        data: {
          before: instance,
          after: instance,
        },
      }
      const modificationContextMock = {
        ...contextMock,
        change: modificationWithSameValues,
      }
      const { custom } = createCustomConditionCheckChangesInFields(['test'])
      expect(custom?.({})(modificationContextMock)).toEqual(false)
    })

    it('should return a condition with a custom function that returns true when at least one field is different', () => {
      const instanceAfter = new InstanceElement('testInstance', objectTypeMock, {
        test: 'after',
      })
      const modificationWithDifferentValues = {
        action: 'modify' as const,
        data: {
          before: instance,
          after: instanceAfter,
        },
      }
      const modificationContextMock = {
        ...contextMock,
        change: modificationWithDifferentValues,
      }
      const { custom } = createCustomConditionCheckChangesInFields(['test'])
      expect(custom?.({})(modificationContextMock)).toEqual(true)
    })
  })

  describe('removal changes', () => {
    it('should return false for removal changes', () => {
      const { custom } = createCustomConditionCheckChangesInFields([
        Object.keys(getChangeData(removalChangeMock).value)[0],
      ])
      expect(custom?.({})({ ...contextMock, change: removalChangeMock })).toEqual(false)
    })
  })
})
