/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
    accountsUpdateDate: new InMemoryRemoteMap(),
    saltoVersion: '0.0.1',
    saltoMetadata: new InMemoryRemoteMap(),
    staticFilesSource: mockStaticFilesSource(),
  }))
