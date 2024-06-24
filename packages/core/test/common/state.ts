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
import { Element, StaticFile } from '@salto-io/adapter-api'
import { pathIndex, state, elementSource, remoteMap, staticFiles } from '@salto-io/workspace'

export const mockStaticFilesSource = (files: StaticFile[] = []): staticFiles.StaticFilesSource => ({
  getStaticFile: jest
    .fn()
    .mockImplementation(
      (args: { filepath: string; encoding: BufferEncoding }) =>
        files.find(sf => sf.filepath === args.filepath) ?? undefined,
    ),
  getContent: jest
    .fn()
    .mockImplementation(
      async (filepath: string) => (await files.find(sf => sf.filepath === filepath)?.getContent()) ?? undefined,
    ),
  persistStaticFile: jest.fn().mockReturnValue([]),
  flush: jest.fn(),
  clone: jest.fn(),
  rename: jest.fn(),
  getTotalSize: jest.fn(),
  clear: jest.fn(),
  delete: jest.fn(),
  isPathIncluded: jest.fn().mockImplementation(filePath => files.find(f => f.filepath === filePath) !== undefined),
})

export const mockState = (
  accounts: string[] = [],
  elements: Element[] = [],
  index: remoteMap.RemoteMapEntry<pathIndex.Path[]>[] = [],
): state.State =>
  state.buildInMemState(async () => ({
    elements: elementSource.createInMemoryElementSource(elements),
    pathIndex: new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>(index),
    accountsUpdateDate: new remoteMap.InMemoryRemoteMap<Date>(
      accounts.map(accountName => ({ key: accountName, value: new Date() })),
    ),
    saltoMetadata: new remoteMap.InMemoryRemoteMap<string, 'version'>([{ key: 'version', value: '0.0.1' }]),
    staticFilesSource: mockStaticFilesSource(),
    topLevelPathIndex: new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>(index),
  }))
