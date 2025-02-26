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
  InstanceElement,
  ObjectType,
  TypeReference,
} from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { getAdapterConfigOptionsType } from '../src/creators_utils'
import adapterCreators from '../src/creators'

const mockServiceWithConfigCreator = 'adapterWithConfigCreator'
const mockConfigOptionsObjectType = new ObjectType({
  elemID: new ElemID('mock'),
})
const mockService = 'salto'

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

describe('getAdapterConfigOptionsType', () => {
  const mockAdapterWithConfigCreator = {
    ...mockAdapter,
    configCreator: {
      getConfig: jest.fn(),
      optionsType: mockConfigOptionsObjectType,
      getOptionsType: () => mockConfigOptionsObjectType,
    },
  }

  adapterCreators[mockServiceWithConfigCreator] = mockAdapterWithConfigCreator

  it('should returns adapter configCreator.optionsType when defined', () => {
    expect(getAdapterConfigOptionsType(mockServiceWithConfigCreator)).toEqual(mockConfigOptionsObjectType)
  })
  it('should returns adapter configCreator.getOptionsType when defined', () => {
    const adapterOptionsTypeContext = new InstanceElement(
      ElemID.CONFIG_NAME,
      new TypeReference(new ElemID('someAdapter')),
      {
        someField: true,
      },
    )
    expect(getAdapterConfigOptionsType(mockServiceWithConfigCreator, adapterOptionsTypeContext)).toEqual(
      mockConfigOptionsObjectType,
    )
  })
  it('should returns undefined when adapter configCreator is undefined', () => {
    expect(getAdapterConfigOptionsType(mockService)).toBeUndefined()
  })
})
