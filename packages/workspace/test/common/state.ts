/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element } from '@salto-io/adapter-api'
import { mockStaticFilesSource } from '../utils'
import { State, buildInMemState } from '../../src/workspace/state'
import { InMemoryRemoteMap } from '../../src/workspace/remote_map'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import { Path } from '../../src/workspace/path_index'

export const mockState = (elements: Element[] = []): State =>
  buildInMemState(async () => ({
    elements: createInMemoryElementSource(elements),
    pathIndex: new InMemoryRemoteMap<Path[]>(),
    topLevelPathIndex: new InMemoryRemoteMap<Path[]>(),
    accounts: new InMemoryRemoteMap([{ key: 'account_names', value: [] }]),
    saltoVersion: '0.0.1',
    saltoMetadata: new InMemoryRemoteMap(),
    staticFilesSource: mockStaticFilesSource(),
  }))
