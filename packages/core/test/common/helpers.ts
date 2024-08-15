/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Adapter, AdapterOperations, Element, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { elementSource, remoteMap } from '@salto-io/workspace'

export const createElementSource = (elements: readonly Element[]): elementSource.RemoteElementSource =>
  elementSource.createInMemoryElementSource(elements as Element[])

export const inMemRemoteMapCreator = (): remoteMap.RemoteMapCreator => {
  const maps = new Map<string, remoteMap.RemoteMap<unknown>>()
  return async <T, K extends string = string>(opts: remoteMap.CreateRemoteMapParams<T>) => {
    const map = maps.get(opts.namespace) ?? new remoteMap.InMemoryRemoteMap<T, K>()
    if (!maps.has(opts.namespace)) {
      maps.set(opts.namespace, map)
    }
    return map as remoteMap.RemoteMap<T, K>
  }
}

export const createMockAdapter = (adapterName: string): jest.Mocked<Required<Adapter>> => {
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
    install: mockFunction<Required<Adapter>['install']>().mockResolvedValue({ success: true, installedVersion: '1' }),
    loadElementsFromFolder: mockFunction<Required<Adapter>['loadElementsFromFolder']>().mockResolvedValue({
      elements: [],
    }),
    dumpElementsToFolder: mockFunction<Required<Adapter>['dumpElementsToFolder']>().mockResolvedValue({
      errors: [],
      unappliedChanges: [],
    }),
    getAdditionalReferences: mockFunction<Required<Adapter>['getAdditionalReferences']>().mockResolvedValue([]),
    getCustomReferences: mockFunction<Required<Adapter>['getCustomReferences']>().mockResolvedValue([]),
  }
}
