/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { remoteMap } from '@salto-io/workspace'

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
