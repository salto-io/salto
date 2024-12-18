/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Adapter } from '@salto-io/e2e-credentials-store'
import NetsuiteClient from '../../src/client/client'
import { Credentials, toCredentialsAccountId } from '../../src/client/credentials'

type Args = {
  accountId: string
  tokenId: string
  tokenSecret: string
  certificateId: string
  privateKey: string
  suiteAppTokenId: string
  suiteAppTokenSecret: string
  suiteAppActivationKey: string
}

const PRIVATE_KEY_PREFIX = '-----'

const adapter: Adapter<Args, Credentials> = {
  name: 'netsuite',
  credentialsOpts: {
    accountId: {
      type: 'string',
      demand: true,
    },
    tokenId: {
      type: 'string',
      demand: true,
    },
    tokenSecret: {
      type: 'string',
      demand: true,
    },
    certificateId: {
      type: 'string',
      demand: true,
    },
    privateKey: {
      type: 'string',
      demand: true,
    },
    suiteAppTokenId: {
      type: 'string',
      demand: true,
    },
    suiteAppTokenSecret: {
      type: 'string',
      demand: true,
    },
    suiteAppActivationKey: {
      type: 'string',
      demand: true,
    },
  },
  credentials: async args => {
    if (args.privateKey.length === 0 || args.privateKey.startsWith(PRIVATE_KEY_PREFIX)) {
      throw new Error(`specifiy privateKey without the '${PRIVATE_KEY_PREFIX}' prefix`)
    }
    return {
      accountId: toCredentialsAccountId(args.accountId),
      tokenId: args.tokenId,
      tokenSecret: args.tokenSecret,
      certificateId: args.certificateId,
      privateKey: PRIVATE_KEY_PREFIX.concat(args.privateKey),
      suiteAppTokenId: args.suiteAppTokenId,
      suiteAppTokenSecret: args.suiteAppTokenSecret,
      suiteAppActivationKey: args.suiteAppActivationKey,
    }
  },
  validateCredentials: credentials => NetsuiteClient.validateCredentials(credentials) as unknown as Promise<void>,
}

export default adapter
