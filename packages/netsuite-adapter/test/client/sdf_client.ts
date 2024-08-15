/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import Bottleneck from 'bottleneck'
import SdfClient from '../../src/client/sdf_client'
import { ClientConfig } from '../../src/config/types'

const DUMMY_ACCOUNT_ID = 'tstdrv123456-sb'
const DUMMY_TOKEN_ID = 'dummyTokenId'
const DUMMY_TOKEN_SECRET = 'dummyTokenSecret'

export const DUMMY_CREDENTIALS = {
  accountId: DUMMY_ACCOUNT_ID,
  tokenId: DUMMY_TOKEN_ID,
  tokenSecret: DUMMY_TOKEN_SECRET,
}
const mockSdfClient = (config?: ClientConfig, instanceLimiter = (_t: string, _c: number) => false): SdfClient =>
  new SdfClient({
    credentials: DUMMY_CREDENTIALS,
    config,
    globalLimiter: new Bottleneck(),
    instanceLimiter,
  })

export default mockSdfClient
