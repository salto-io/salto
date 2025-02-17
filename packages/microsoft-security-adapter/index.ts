/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export { adapter } from './src/adapter_creator'
export { OAUTH_REQUIRED_SCOPES } from './src/auth'
export { getOAuthRequiredScopes } from './src/client/oauth'
export * as e2eUtils from './src/e2e_index'
