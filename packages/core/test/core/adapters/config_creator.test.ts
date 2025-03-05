/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  Adapter,
  AdapterOperations,
  BuiltinTypes,
  ChangeValidator,
  ElemID,
  FixElementsFunc,
  GetAdditionalReferencesFunc,
  ObjectType,
} from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { validateElement } from '@salto-io/workspace'
import { getAdapterConfigOptionsType } from '../../../src/core/adapters/config_creator'

jest.mock('@salto-io/workspace', () => ({
  validateElement: jest.fn(),
}))
const mockLogWarn = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn().mockReturnValue({
    warn: jest.fn((...args) => mockLogWarn(...args)),
  }),
}))

const mockServiceWithConfigCreator = 'adapterWithConfigCreator'
const mockGetOptionsType = new ObjectType({
  elemID: new ElemID('mockGetOptionsType'),
})
const mockService = 'salto'
const mockConfigContextType = new ObjectType({
  elemID: new ElemID('mockConfigContextType'),
  fields: { configContext: { refType: BuiltinTypes.BOOLEAN } },
})
const mockConfigContext = { configContext: true }
const mockValidateElement = validateElement as jest.Mock

const mockConfigType = new ObjectType({
  elemID: new ElemID(mockService),
  fields: {
    username: { refType: BuiltinTypes.STRING },
    password: { refType: BuiltinTypes.STRING },
    token: { refType: BuiltinTypes.STRING },
    sandbox: { refType: BuiltinTypes.BOOLEAN },
  },
})

const mockAdapterOps = {
  fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
  deploy: mockFunction<AdapterOperations['deploy']>().mockImplementation(({ changeGroup }) =>
    Promise.resolve({ errors: [], appliedChanges: changeGroup.changes }),
  ),
  fixElements: mockFunction<FixElementsFunc>().mockResolvedValue({ fixedElements: [], errors: [] }),
}

const mockAdapter: Adapter = {
  operations: mockFunction<Adapter['operations']>().mockReturnValue({
    ...mockAdapterOps,
    deployModifiers: { changeValidator: mockFunction<ChangeValidator>().mockResolvedValue([]) },
  }),
  authenticationMethods: { basic: { credentialsType: mockConfigType } },
  validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({
    accountId: '',
    accountType: 'Sandbox',
    isProduction: false,
  }),
  getAdditionalReferences: mockFunction<GetAdditionalReferencesFunc>().mockResolvedValue([]),
}

const mockAdapterCreators: Record<string, Adapter> = {}

const createMockAdapterWithConfigCreator = ({
  getOptionsType,
  configContextType,
}: {
  getOptionsType?: () => ObjectType
  configContextType?: ObjectType
}): Adapter => ({
  ...mockAdapter,
  configCreator: {
    configContextType,
    getOptionsType,
    getConfig: jest.fn(),
  },
})

describe('getAdapterConfigOptionsType', () => {
  const mockAdapterWithConfigCreator = createMockAdapterWithConfigCreator({ getOptionsType: () => mockGetOptionsType })
  const mockAdapterWithConfigContextType = createMockAdapterWithConfigCreator({
    configContextType: mockConfigContextType,
    getOptionsType: () => mockGetOptionsType,
  })
  const mockAdapterWithoutOptionsTypeConfigCreator = createMockAdapterWithConfigCreator({})

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return undefined for adapter with no optionsType', () => {
    mockAdapterCreators[mockServiceWithConfigCreator] = mockAdapterWithoutOptionsTypeConfigCreator
    const result = getAdapterConfigOptionsType({
      adapterName: mockServiceWithConfigCreator,
      adapterCreators: mockAdapterCreators,
    })
    expect(result).toBeUndefined()
  })

  it('should return getOptionsType if exist when configContextType or configContext is undefined', () => {
    mockAdapterCreators[mockServiceWithConfigCreator] = mockAdapterWithConfigCreator
    const result = getAdapterConfigOptionsType({
      adapterName: mockServiceWithConfigCreator,
      adapterCreators: mockAdapterCreators,
    })
    expect(result).toBe(mockGetOptionsType)
  })

  it('should validate if adapterContextInstance holds a valid configContext, and log warnings if validation fails', () => {
    mockValidateElement.mockReturnValue([{ message: 'Invalid value', elemID: new ElemID('jira', 'invalidField') }])
    const mockInvalidConfigContext = { configContext: 'invalid' }
    mockAdapterCreators[mockServiceWithConfigCreator] = mockAdapterWithConfigContextType
    getAdapterConfigOptionsType({
      adapterName: mockServiceWithConfigCreator,
      adapterCreators: mockAdapterCreators,
      configContext: mockInvalidConfigContext,
    })

    expect(mockValidateElement).toHaveBeenCalledTimes(1)
    expect(mockLogWarn).toHaveBeenCalledWith(
      'Invalid configContext for adapter: %s. Error message: %s, Element ID: %o',
      mockServiceWithConfigCreator,
      'Invalid value',
      'jira.invalidField',
    )
  })

  it('should return getOptionsType for adapter context when validation passes', () => {
    mockValidateElement.mockReturnValue([])
    const result = getAdapterConfigOptionsType({
      adapterName: mockServiceWithConfigCreator,
      adapterCreators: mockAdapterCreators,
      configContext: mockConfigContext,
    })
    expect(mockValidateElement).toHaveBeenCalledTimes(1)
    expect(result).toBe(mockGetOptionsType)
  })
})
