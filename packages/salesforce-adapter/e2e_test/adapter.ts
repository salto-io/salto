/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, ServiceIds } from '@salto-io/adapter-api'
import SalesforceClient from '../src/client/client'
import SalesforceAdapter, { SalesforceAdapterParams } from '../src/adapter'
import { SalesforceConfig, Credentials } from '../src/types'

type Reals = {
  client: SalesforceClient
  adapter: SalesforceAdapter
}

type Opts = {
  adapterParams?: Partial<SalesforceAdapterParams>
  credentials: Credentials
}
const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string): ElemID =>
  new ElemID(adapterName, name)

const realAdapter = ({ adapterParams, credentials }: Opts, config?: SalesforceConfig): Reals => {
  // Default to purge on delete to avoid leaving definitions in the recycle bin
  const clientConfig = _.merge({ deploy: { purgeOnDelete: true } }, config?.client)
  const client = (adapterParams && adapterParams.client) || new SalesforceClient({ credentials, config: clientConfig })
  const adapter = new SalesforceAdapter({
    client,
    // to be changed at https://salto-io.atlassian.net/browse/SALTO-7121
    config: _.merge({}, config, { fetch: { optionalFeatures: { shouldPopulateInternalIdAfterDeploy: false } } }),
    elementsSource: buildElementsSourceFromElements([]),
    ...(adapterParams || { getElemIdFunc: mockGetElemIdFunc }),
  })
  return { client, adapter }
}

export default realAdapter
