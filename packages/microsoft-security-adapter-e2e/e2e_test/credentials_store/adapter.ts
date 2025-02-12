/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Adapter } from '@salto-io/e2e-credentials-store'
import { client as clientUtils } from '@salto-io/adapter-components'
import { e2eUtils } from '@salto-io/microsoft-security-adapter'

const { createConnection } = e2eUtils

type Args = {
  tenantId: string
  clientId: string
  clientSecret: string
  refreshToken: string
}

const adapter: Adapter<Args, e2eUtils.Credentials> = {
  name: 'microsoft_security',
  credentialsOpts: {
    tenantId: {
      type: 'string',
      demandOption: true,
    },
    clientId: {
      type: 'string',
      demandOption: true,
    },
    clientSecret: {
      type: 'string',
      demandOption: true,
    },
    refreshToken: {
      type: 'string',
      demandOption: true,
    },
  },
  credentials: async args => ({
    tenantId: args.tenantId,
    clientId: args.clientId,
    clientSecret: args.clientSecret,
    refreshToken: args.refreshToken,
    servicesToManage: {
      Entra: true,
      Intune: true,
    },
  }),
  validateCredentials: async credentials => {
    await clientUtils.validateCredentials(credentials, { createConnection })
  },
}

export default adapter
