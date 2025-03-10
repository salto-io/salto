/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Adapter,
  AdapterFormat,
  AdapterOperations,
  Element,
  ElemID,
  InstanceElement,
  ObjectType,
  PartialFetchOperations,
} from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { elementSource } from '@salto-io/workspace'

export const createElementSource = (elements: readonly Element[]): elementSource.RemoteElementSource =>
  elementSource.createInMemoryElementSource(elements as Element[])

export const createMockAdapter = (
  adapterName: string,
): jest.Mocked<Required<Adapter>> & {
  adapterFormat: jest.Mocked<Required<AdapterFormat>>
  partialFetch: jest.Mocked<PartialFetchOperations>
} => {
  const configType = new ObjectType({ elemID: new ElemID(adapterName) })
  const credentialsType = new ObjectType({ elemID: new ElemID(adapterName) })
  const optionsType = new ObjectType({ elemID: new ElemID(adapterName) })
  return {
    operations: mockFunction<Adapter['operations']>().mockReturnValue({
      fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
      deploy: mockFunction<AdapterOperations['deploy']>().mockResolvedValue({ appliedChanges: [], errors: [] }),
    }),
    validateCredentials: mockFunction<Adapter['validateCredentials']>().mockResolvedValue({ accountId: 'accountID' }),
    authenticationMethods: {
      basic: { credentialsType },
    },
    configType,
    configCreator: {
      getConfig: mockFunction<Required<Adapter>['configCreator']['getConfig']>().mockResolvedValue(
        new InstanceElement(ElemID.CONFIG_NAME, configType, {}),
      ),
      optionsType,
    },
    install: mockFunction<Required<Adapter>['install']>().mockResolvedValue({
      success: true,
      installedVersion: '1',
      installedVersions: ['1'],
    }),
    adapterFormat: {
      isInitializedFolder: mockFunction<NonNullable<AdapterFormat['isInitializedFolder']>>().mockResolvedValue({
        result: false,
        errors: [],
      }),
      initFolder: mockFunction<NonNullable<AdapterFormat['initFolder']>>().mockResolvedValue({ errors: [] }),
      loadElementsFromFolder: mockFunction<NonNullable<AdapterFormat['loadElementsFromFolder']>>().mockResolvedValue({
        elements: [],
      }),
      dumpElementsToFolder: mockFunction<NonNullable<AdapterFormat['dumpElementsToFolder']>>().mockResolvedValue({
        errors: [],
        unappliedChanges: [],
      }),
    },
    getAdditionalReferences: mockFunction<Required<Adapter>['getAdditionalReferences']>().mockResolvedValue([]),
    getCustomReferences: mockFunction<Required<Adapter>['getCustomReferences']>().mockResolvedValue([]),
    partialFetch: {
      getAllTargets: mockFunction<Required<Adapter>['partialFetch']['getAllTargets']>().mockResolvedValue([]),
      getTargetsForElements: mockFunction<
        Required<Adapter>['partialFetch']['getTargetsForElements']
      >().mockResolvedValue([]),
    },
  }
}
