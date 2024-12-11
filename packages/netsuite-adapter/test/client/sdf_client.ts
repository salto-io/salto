/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import Bottleneck from 'bottleneck'
import SdfClient from '../../src/client/sdf_client'
import { ClientConfig, InstanceLimiterFunc } from '../../src/config/types'
import { SdfOauthCredentials, SdfTokenBasedCredentials } from '../../src/client/credentials'

const DUMMY_ACCOUNT_ID = 'tstdrv123456-sb'
const DUMMY_TOKEN_ID = 'dummyTokenId'
const DUMMY_TOKEN_SECRET = 'dummyTokenSecret'
const DUMMY_CERTIFICATE_ID = 'dummyCertificateId'
const DUMMY_PRIVATE_KEY = 'dummyPrivateKey'

export const DUMMY_TOKEN_BASED_CREDENTIALS: SdfTokenBasedCredentials = {
  accountId: `${DUMMY_ACCOUNT_ID}-tokenBased`,
  tokenId: DUMMY_TOKEN_ID,
  tokenSecret: DUMMY_TOKEN_SECRET,
}

export const DUMMY_OAUTH_CREDENTIALS: SdfOauthCredentials = {
  accountId: `${DUMMY_ACCOUNT_ID}-oauth`,
  certificateId: DUMMY_CERTIFICATE_ID,
  privateKey: DUMMY_PRIVATE_KEY,
}

const mockSdfClient = (
  {
    withOauth,
    config,
    instanceLimiter = () => false,
  }: {
    withOauth: boolean
    config?: ClientConfig
    instanceLimiter?: InstanceLimiterFunc
  } = { withOauth: true },
): SdfClient =>
  new SdfClient({
    credentials: withOauth ? DUMMY_OAUTH_CREDENTIALS : DUMMY_TOKEN_BASED_CREDENTIALS,
    config,
    globalLimiter: new Bottleneck(),
    instanceLimiter,
  })

export default mockSdfClient
