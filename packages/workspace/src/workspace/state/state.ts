/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Element, ElemID } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { ElementsSource, RemoteElementSource } from '../elements_source'
import { PathIndex, Path } from '../path_index'
import { RemoteMap, RemoteMapCreator } from '../remote_map'
import { serialize, deserializeSingleElement } from '../../serializer/elements'

export type StateMetadataKey = 'version' | 'hash'

// This distinction is temporary for the transition to multiple services.
// Remove this when no longer used, SALTO-1661
type OldStateData = {
  elements: RemoteElementSource
  // The date of the last fetch
  accountsUpdateDate: RemoteMap<Date>
  pathIndex: PathIndex
  saltoMetadata: RemoteMap<string, StateMetadataKey>
}

// This distinction is temporary for the transition to multiple services.
// Remove this when no longer used, SALTO-1661
type NewStateData = {
  elements: RemoteElementSource
  // The date of the last fetch
  servicesUpdateDate: RemoteMap<Date>
  pathIndex: PathIndex
  saltoMetadata: RemoteMap<string, StateMetadataKey>
}

export type StateData = OldStateData | NewStateData

// This function is temporary for the transition to multiple services.
// Remove this when no longer used, SALTO-1661
export const getUpdateDate = (data: StateData): RemoteMap<Date> => {
  if ('servicesUpdateDate' in data) {
    return data.servicesUpdateDate
  }
  return data.accountsUpdateDate
}

export interface State extends ElementsSource {
  set(element: Element): Promise<void>
  remove(id: ElemID): Promise<void>
  override(elements: AsyncIterable<Element>, accounts?: string[]): Promise<void>
  getAccountsUpdateDates(): Promise<Record<string, Date>>
  // getServicesUpdateDates is deprecated, kept for backwards compatibility.
  // use getAccountsUpdateDates.
  // Remove this when no longer used, SALTO-1661
  getServicesUpdateDates(): Promise<Record<string, Date>>
  existingAccounts(): Promise<string[]>
  overridePathIndex(unmergedElements: Element[]): Promise<void>
  updatePathIndex(unmergedElements: Element[], accountsToMaintain: string[]): Promise<void>
  getPathIndex(): Promise<PathIndex>
  getHash(): Promise<string | undefined>
  setHash(hash: string): Promise<void>
  calculateHash(): Promise<void>
  getStateSaltoVersion(): Promise<string | undefined>
}


export const createStateNamespace = (envName: string, namespace: string): string =>
  `state-${envName}-${namespace}`

export const buildStateData = async (
  envName: string,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean
):
Promise<StateData> => ({
  elements: new RemoteElementSource(await remoteMapCreator<Element>({
    namespace: createStateNamespace(envName, 'elements'),
    serialize: elem => serialize([elem]),
    // TODO: I don't think we should add reviver here but I need to think about it more
    deserialize: deserializeSingleElement,
    persistent,
  })),
  pathIndex: await remoteMapCreator<Path[]>({
    namespace: createStateNamespace(envName, 'path_index'),
    serialize: paths => safeJsonStringify(paths),
    deserialize: async data => JSON.parse(data),
    persistent,
  }),
  accountsUpdateDate: await remoteMapCreator<Date>({
    namespace: createStateNamespace(envName, 'service_update_date'),
    serialize: date => date.toISOString(),
    deserialize: async data => new Date(data),
    persistent,
  }),
  saltoMetadata: await remoteMapCreator<string, 'version'>({
    namespace: createStateNamespace(envName, 'salto_metadata'),
    serialize: data => data,
    deserialize: async data => data,
    persistent,
  }),
})
