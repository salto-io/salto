/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import Connection from '../src/client/jsforce'
import SalesforceClient from '../src/client/client'
import SalesforceAdapter, { SalesforceAdapterParams } from '../src/adapter'
import createClient from './client'

type Mocks = {
  connection: MockInterface<Connection>
  client: SalesforceClient
  adapter: SalesforceAdapter
}

type Opts = {
  adapterParams?: Partial<SalesforceAdapterParams>
}

const mockAdapter = ({ adapterParams }: Opts = {}): Mocks => {
  const { connection, client } = createClient(adapterParams?.config?.client)
  const adapter = new SalesforceAdapter({
    client,
    metadataTypesOfInstancesFetchedInFilters: ['Queue'],
    config: {},
    elementsSource: buildElementsSourceFromElements([]),
    ...(adapterParams || {}),
  })
  return {
    connection,
    client,
    adapter,
  }
}

export default mockAdapter
