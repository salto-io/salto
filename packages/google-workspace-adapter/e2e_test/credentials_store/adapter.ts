/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Adapter } from '@salto-io/e2e-credentials-store'
import { Credentials } from '../../src/auth'

type Args = {
  clientId: string
  clientSecret: string
  refreshToken: string
}

const adapter: Adapter<Args, Credentials> = {
  name: 'google-workspace',
  credentialsOpts: {
    clientId: {
      type: 'string',
      demand: true,
    },
    clientSecret: {
      type: 'string',
      demand: true,
    },
    refreshToken: {
      type: 'string',
      demand: true,
    },
  },
  credentials: async args => ({
    clientId: args.clientId,
    clientSecret: args.clientSecret,
    refreshToken: args.refreshToken,
  }),
  validateCredentials: async () => undefined,
}

export default adapter
