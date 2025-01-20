/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Adapter } from '@salto-io/e2e-credentials-store'
import { client as clientUtils } from '@salto-io/adapter-components'
import { e2eUtils } from '@salto-io/zendesk-adapter'

const { createConnection } = e2eUtils

type Args = {
  username: string
  password: string
  subdomain: string
}

const adapter: Adapter<Args, e2eUtils.Credentials> = {
  name: 'zendesk',
  credentialsOpts: {
    username: {
      type: 'string',
      demand: true,
    },
    password: {
      type: 'string',
      demand: true,
    },
    subdomain: {
      type: 'string',
      demand: true,
    },
  },
  credentials: async args => ({
    username: args.username,
    password: args.password,
    subdomain: args.subdomain,
  }),
  validateCredentials: async credentials => {
    await clientUtils.validateCredentials(credentials, { createConnection })
  },
}

export default adapter
