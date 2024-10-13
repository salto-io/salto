/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ServiceIds } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { ElementsSourceIndexes } from '../src/elements_source_index/types'
import { configType, NetsuiteConfig } from '../src/config/types'
import { NETSUITE } from '../src/constants'
import { NetsuiteChangeValidator } from '../src/change_validators/types'
import { fullFetchConfig } from '../src/config/config_creator'
import NetsuiteClient from '../src/client/client'
import { getTypesToInternalId } from '../src/data_elements/types'
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
  ...getTypesToInternalId([]),
})
