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

export type StateData = {
  elements: RemoteElementSource
  // The date of the last fetch
  servicesUpdateDate: RemoteMap<Date>
  pathIndex: PathIndex
  saltoMetadata: RemoteMap<string, StateMetadataKey>
}

export interface State extends ElementsSource {
  set(element: Element): Promise<void>
  remove(id: ElemID): Promise<void>
  override(elements: AsyncIterable<Element>, services?: string[]): Promise<void>
  getServicesUpdateDates(): Promise<Record<string, Date>>
  existingServices(): Promise<string[]>
  overridePathIndex(unmergedElements: Element[]): Promise<void>
  updatePathIndex(unmergedElements: Element[], servicesToMaintain: string[]): Promise<void>
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
  servicesUpdateDate: await remoteMapCreator<Date>({
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
