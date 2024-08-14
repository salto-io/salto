/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Adapter } from '@salto-io/e2e-credentials-store'
import { Credentials } from '../../src/auth'

type Args = {
  baseURL: string
  clientId: string
  clientSecret: string
}

const adapter: Adapter<Args, Credentials> = {
  name: 'zuora_billing',
  credentialsOpts: {
    baseURL: {
      type: 'string',
      demand: true,
    },
    clientId: {
      type: 'string',
      demand: true,
    },
    clientSecret: {
      type: 'string',
      demand: true,
    },
  },
  credentials: async args => ({
    baseURL: args.baseURL,
    clientId: args.clientId,
    clientSecret: args.clientSecret,
  }),
  validateCredentials: async () => {
    // TODO validate when connecting with real credentials
  },
}

export default adapter
