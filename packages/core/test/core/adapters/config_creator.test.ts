/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Adapter, BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { getAdapterConfigOptionsType } from '../../../src/core/adapters/config_creator'
import { createMockAdapter } from '../../common/helpers'

const mockLogWarn = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn().mockReturnValue({
    warn: jest.fn((...args) => mockLogWarn(...args)),
  }),
}))

const mockGetOptionsType = new ObjectType({
  elemID: new ElemID('mockGetOptionsType'),
})
const mockService = 'salto'
const mockServiceWithConfigCreator = 'adapterWithConfigCreator'
const mockServiceWithConfigContextType = 'adapterWithConfigContextType'
const mockServiceWithoutOptionsTypeConfigCreator = 'adapterWithoutOptionsTypeConfigCreator'
const mockConfigContextType = new ObjectType({
  elemID: new ElemID('mockConfigContextType'),
  fields: { configContext: { refType: BuiltinTypes.BOOLEAN } },
  annotations: { [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false },
})
const mockConfigContext = { configContext: true }
const mockServiceContextInstance = new InstanceElement(ElemID.CONFIG_NAME, mockConfigContextType, mockConfigContext)
const mockGetOptionsTypeFn = jest.fn(() => mockGetOptionsType)

const createMockAdapterWithConfigCreator = ({
  getOptionsType,
  configContextType,
}: {
  getOptionsType?: () => ObjectType
  configContextType?: ObjectType
}): Adapter => ({
  ...createMockAdapter(mockService),
  configCreator: {
    configContextType,
    getOptionsType,
    getConfig: jest.fn(),
  },
})

describe('adapters config creator', () => {
  describe('getAdapterConfigOptionsType', () => {
    let mockAdapterCreators: Record<string, Adapter>

    beforeEach(() => {
      jest.clearAllMocks()
      mockAdapterCreators = {
        adapterWithConfigCreator: createMockAdapterWithConfigCreator({ getOptionsType: mockGetOptionsTypeFn }),
        adapterWithConfigContextType: createMockAdapterWithConfigCreator({
          configContextType: mockConfigContextType,
          getOptionsType: mockGetOptionsTypeFn,
        }),
        adapterWithoutOptionsTypeConfigCreator: createMockAdapterWithConfigCreator({}),
      }
    })

    it('should return undefined for adapter with no optionsType', () => {
      const result = getAdapterConfigOptionsType({
        adapterName: mockServiceWithoutOptionsTypeConfigCreator,
        adapterCreators: mockAdapterCreators,
      })
      expect(result).toBeUndefined()
      expect(mockGetOptionsTypeFn).not.toHaveBeenCalled()
    })

    it('should return getOptionsType if exist when configContextType is undefined', () => {
      const result = getAdapterConfigOptionsType({
        adapterName: mockServiceWithConfigCreator,
        adapterCreators: mockAdapterCreators,
        configContext: mockConfigContext,
      })
      expect(result).toBe(mockGetOptionsType)
      expect(mockGetOptionsTypeFn).toHaveBeenCalledWith()
    })

    it('should return getOptionsType if exist when configContext is undefined', () => {
      const result = getAdapterConfigOptionsType({
        adapterName: mockServiceWithConfigCreator,
        adapterCreators: mockAdapterCreators,
      })
      expect(result).toBe(mockGetOptionsType)
      expect(mockGetOptionsTypeFn).toHaveBeenCalledWith()
    })
    it('should log configContext validation errors and return undefined', () => {
      const mockInvalidConfigContext = { invalidConfigContext: 'invalid' }
      const result = getAdapterConfigOptionsType({
        adapterName: mockServiceWithConfigContextType,
        adapterCreators: mockAdapterCreators,
        configContext: mockInvalidConfigContext,
      })
      expect(mockLogWarn).toHaveBeenCalled()
      expect(result).toBeUndefined()
      expect(mockGetOptionsTypeFn).not.toHaveBeenCalled()
    })

    it('should return getOptionsType for adapter context when validation passes', () => {
      const result = getAdapterConfigOptionsType({
        adapterName: mockServiceWithConfigContextType,
        adapterCreators: mockAdapterCreators,
        configContext: mockConfigContext,
      })
      expect(result).toBe(mockGetOptionsType)
      expect(mockGetOptionsTypeFn).toHaveBeenCalledWith(mockServiceContextInstance)
    })
  })
})
