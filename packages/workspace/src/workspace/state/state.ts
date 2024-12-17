/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DetailedChange, Element, ElemID } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { ElementsSource, RemoteElementSource } from '../elements_source'
import { PathIndex, Path } from '../path_index'
import { RemoteMap, RemoteMapCreator } from '../remote_map'
import { serialize, deserializeSingleElement } from '../../serializer/elements'
import { StateStaticFilesSource } from '../static_files/common'
import { StateConfig } from '../config/workspace_config_types'

export type UpdateStateElementsArgs = {
  changes: DetailedChange[]
  unmergedElements?: Element[]
  fetchAccounts?: string[]
}

export type StateData = {
  elements: RemoteElementSource
  accounts: RemoteMap<string[], 'account_names'>
  pathIndex: PathIndex
  saltoMetadata: RemoteMap<string, 'hash'>
  staticFilesSource: StateStaticFilesSource
  topLevelPathIndex: PathIndex
  deprecated: {
    accountsUpdateDate: RemoteMap<Date>
  }
}

type UpdateConfigArgs = {
  workspaceId: string
  stateConfig: StateConfig | undefined
}
export interface State extends ElementsSource {
  set(element: Element): Promise<void>
  remove(id: ElemID): Promise<void>
  existingAccounts(): Promise<string[]>
  getPathIndex(): Promise<PathIndex>
  getTopLevelPathIndex(): Promise<PathIndex>
  getHash(): Promise<string | undefined>
  setHash(hash: string): Promise<void>
  calculateHash(): Promise<void>
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
    await remoteMapCreator.create<Element>({
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
  pathIndex: await remoteMapCreator.create<Path[]>({
    namespace: createStateNamespace(envName, 'path_index'),
    serialize: async paths => safeJsonStringify(paths),
    deserialize: async data => JSON.parse(data),
    persistent,
  }),
  topLevelPathIndex: await remoteMapCreator.create<Path[]>({
    namespace: createStateNamespace(envName, 'top_level_path_index'),
    serialize: async paths => safeJsonStringify(paths),
    deserialize: async data => JSON.parse(data),
    persistent,
  }),
  accounts: await remoteMapCreator.create<string[], 'account_names'>({
    namespace: createStateNamespace(envName, 'accounts'),
    serialize: async data => safeJsonStringify(data),
    deserialize: async data => JSON.parse(data),
    persistent,
  }),
  saltoMetadata: await remoteMapCreator.create<string, 'hash'>({
    namespace: createStateNamespace(envName, 'salto_metadata'),
    serialize: async data => data,
    deserialize: async data => data,
    persistent,
  }),
  staticFilesSource,
  deprecated: {
    // TODO remove once all workspaces are converted to the new state format (cf. the 'accounts' member)
    accountsUpdateDate: await remoteMapCreator.create<Date>({
      namespace: createStateNamespace(envName, 'service_update_date'),
      serialize: async date => date.toISOString(),
      deserialize: async data => new Date(data),
      persistent,
    }),
  },
})
