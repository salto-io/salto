/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import { RemoteMap, RemoteMapCreator, InMemoryRemoteMap, CreateRemoteMapParams } from '../../src/workspace/remote_map'

const { awu } = collections.asynciterable

type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export const expectToContainAllItems = async <T>(
  itr: ThenableIterable<T>,
  items: ThenableIterable<T>,
): Promise<void> => {
  const arr = await awu(itr).toArray()
  await awu(items).forEach(item => expect(arr).toContainEqual(item))
}

export const inMemRemoteMapCreator = (): RemoteMapCreator => {
  const maps = new Map<string, RemoteMap<unknown>>()
  return {
    close: async () => {},
    create: async <T, K extends string = string>(opts: CreateRemoteMapParams<T>) => {
      const map = maps.get(opts.namespace) ?? new InMemoryRemoteMap<T, K>()
      if (!maps.has(opts.namespace)) {
        maps.set(opts.namespace, map)
      }
      return map as RemoteMap<T, K>
    },
  }
}
