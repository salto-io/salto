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
import { DetailedChange, Element, ElemID } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { ElementsSource, RemoteElementSource } from '../elements_source'
import { PathIndex, Path } from '../path_index'
import { RemoteMap, RemoteMapCreator } from '../remote_map'
import { serialize, deserializeSingleElement } from '../../serializer/elements'
import { StateStaticFilesSource } from '../static_files/common'
import { StateConfig } from '../config/workspace_config_types'

export type StateMetadataKey = 'version' | 'hash'

export type UpdateStateElementsArgs = {
  changes: DetailedChange[]
  unmergedElements?: Element[]
  fetchAccounts?: string[]
}

export type StateData = {
  elements: RemoteElementSource
  // The date of the last fetch
  accountsUpdateDate: RemoteMap<Date>
  pathIndex: PathIndex
  saltoMetadata: RemoteMap<string, StateMetadataKey>
  staticFilesSource: StateStaticFilesSource
  topLevelPathIndex: PathIndex
}

type UpdateConfigArgs = {
  workspaceId: string
  stateConfig: StateConfig | undefined
}
export interface State extends ElementsSource {
  set(element: Element): Promise<void>
  remove(id: ElemID): Promise<void>
  getAccountsUpdateDates(): Promise<Record<string, Date>>
  existingAccounts(): Promise<string[]>
  getPathIndex(): Promise<PathIndex>
  getTopLevelPathIndex(): Promise<PathIndex>
  getHash(): Promise<string | undefined>
  setHash(hash: string): Promise<void>
  calculateHash(): Promise<void>
  getStateSaltoVersion(): Promise<string | undefined>
  updateStateFromChanges(args: UpdateStateElementsArgs): Promise<void>
  updateConfig(args: UpdateConfigArgs): Promise<void>
}

export const createStateNamespace = (envName: string, namespace: string): string => `state-${envName}-${namespace}`

export const buildStateData = async (
  envName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StateStaticFilesSource,
  persistent: boolean,
): Promise<StateData> => ({
  elements: new RemoteElementSource(
    await remoteMapCreator<Element>({
      namespace: createStateNamespace(envName, 'elements'),
      serialize: elem => serialize([elem], 'replaceRefWithValue', file => staticFilesSource.persistStaticFile(file)),
      deserialize: elem =>
        deserializeSingleElement(elem, staticFile =>
          staticFilesSource.getStaticFile({
            filepath: staticFile.filepath,
            encoding: staticFile.encoding,
            hash: staticFile.hash,
            isTemplate: staticFile.isTemplate,
          }),
        ),
      persistent,
    }),
  ),
  pathIndex: await remoteMapCreator<Path[]>({
    namespace: createStateNamespace(envName, 'path_index'),
    serialize: async paths => safeJsonStringify(paths),
    deserialize: async data => JSON.parse(data),
    persistent,
  }),
  topLevelPathIndex: await remoteMapCreator<Path[]>({
    namespace: createStateNamespace(envName, 'top_level_path_index'),
    serialize: async paths => safeJsonStringify(paths),
    deserialize: async data => JSON.parse(data),
    persistent,
  }),
  accountsUpdateDate: await remoteMapCreator<Date>({
    namespace: createStateNamespace(envName, 'service_update_date'),
    serialize: async date => date.toISOString(),
    deserialize: async data => new Date(data),
    persistent,
  }),
  saltoMetadata: await remoteMapCreator<string, 'version'>({
    namespace: createStateNamespace(envName, 'salto_metadata'),
    serialize: async data => data,
    deserialize: async data => data,
    persistent,
  }),
  staticFilesSource,
})
