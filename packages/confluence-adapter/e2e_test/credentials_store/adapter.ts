/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Adapter } from '@salto-io/e2e-credentials-store'
import { Credentials } from '../../src/auth'

type Args = {
  token: string
  user: string
  baseUrl: string
}

const adapter: Adapter<Args, Credentials> = {
  name: 'confluence',
  credentialsOpts: {
    token: {
      type: 'string',
      demand: true,
    },
    user: {
      type: 'string',
      demand: true,
    },
    baseUrl: {
      type: 'string',
      demand: true,
    },
  },
  credentials: async args => ({
    token: args.token,
    user: args.user,
    baseUrl: args.baseUrl,
  }),
  validateCredentials: async () => undefined,
}

export default adapter
