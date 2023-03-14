/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, ServiceIds } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { ElementsSourceIndexes } from '../src/elements_source_index/types'
import { configType, NetsuiteConfig } from '../src/config'
import { NETSUITE } from '../src/constants'

export const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
  ElemID => new ElemID(adapterName, name)

export const getDefaultAdapterConfig = async (): Promise<NetsuiteConfig> => {
  const defaultConfigInstance = await createDefaultInstanceFromType(NETSUITE, configType)
  return defaultConfigInstance.value as NetsuiteConfig
}

export const createEmptyElementsSourceIndexes = (): ElementsSourceIndexes => ({
  serviceIdRecordsIndex: {},
  internalIdsIndex: {},
  customFieldsIndex: {},
  pathToInternalIdsIndex: {},
  elemIdToChangeByIndex: {},
  elemIdToChangeAtIndex: {},
})
