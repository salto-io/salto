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
import { Element } from '@salto-io/adapter-api'
import { pathIndex, state, elementSource, remoteMap } from '@salto-io/workspace'


export const mockState = (
  services: string[] = [],
  elements: Element[] = [],
  index: remoteMap.RemoteMapEntry<pathIndex.Path[]>[] = []
): state.State => (
  state.buildInMemState(async () => ({
    elements: elementSource.createInMemoryElementSource(elements),
    pathIndex: new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>(index),
    servicesUpdateDate: new remoteMap.InMemoryRemoteMap<Date>(
      services.map(serviceName => ({ key: serviceName, value: new Date() }))
    ),
    saltoMetadata: new remoteMap.InMemoryRemoteMap<string, 'version'>([{ key: 'version', value: '0.0.1' }]),
  }))
)
