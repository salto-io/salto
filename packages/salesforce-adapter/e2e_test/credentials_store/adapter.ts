/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Adapter } from '@salto-io/e2e-credentials-store'
import { validateCredentials } from '../../src/client/client'
import { UsernamePasswordCredentials } from '../../src/types'

type Args = {
  username: string
  password: string
  'api-token'?: string
  sandbox: boolean
}

const adapter: Adapter<Args, UsernamePasswordCredentials> = {
  name: 'salesforce',
  credentialsOpts: {
    username: {
      type: 'string',
      demand: true,
    },
    password: {
      type: 'string',
      demand: true,
    },
    'api-token': {
      type: 'string',
      demand: false,
    },
    sandbox: {
      type: 'boolean',
      default: false,
    },
  },
  credentials: async args =>
    new UsernamePasswordCredentials({
      username: args.username,
      password: args.password,
      apiToken: args['api-token'],
      isSandbox: args.sandbox,
    }),
  validateCredentials: config => validateCredentials(config) as unknown as Promise<void>,
}

export default adapter
