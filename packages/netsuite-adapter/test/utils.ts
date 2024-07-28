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
import { ElemID, ServiceIds } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { ElementsSourceIndexes } from '../src/elements_source_index/types'
import { configType, NetsuiteConfig } from '../src/config/types'
import { NETSUITE } from '../src/constants'
import { NetsuiteChangeValidator } from '../src/change_validators/types'
import { fullFetchConfig } from '../src/config/config_creator'
import NetsuiteClient from '../src/client/client'
import mockSdfClient from './client/sdf_client'

export const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string): ElemID =>
  new ElemID(adapterName, name)

export const getDefaultAdapterConfig = async (): Promise<NetsuiteConfig> => {
  const defaultConfigInstance = await createDefaultInstanceFromType(NETSUITE, configType)
  return defaultConfigInstance.clone().value as NetsuiteConfig
}

export const createEmptyElementsSourceIndexes = (): ElementsSourceIndexes => ({
  serviceIdRecordsIndex: {},
  internalIdsIndex: {},
  customFieldsIndex: {},
  elemIdToChangeByIndex: {},
  elemIdToChangeAtIndex: {},
  customRecordFieldsServiceIdRecordsIndex: {},
  customFieldsSelectRecordTypeIndex: {},
})

export const mockChangeValidatorParams = (): Parameters<NetsuiteChangeValidator>[1] => ({
  deployReferencedElements: false,
  elementsSource: buildElementsSourceFromElements([]),
  config: {
    fetch: fullFetchConfig(),
  },
  client: new NetsuiteClient(mockSdfClient()),
  suiteQLNameToInternalIdsMap: {},
})
