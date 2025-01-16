/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export { default } from './src/adapter'
export { adapter } from './src/adapter_creator'
export { Credentials, toCredentialsAccountId, toUrlAccountId } from './src/client/credentials'
export { SDK_VERSION as NETSUITE_SDF_VERSION } from '@salto-io/suitecloud-cli-new'
export { netsuiteSupportedTypes } from './src/types'
