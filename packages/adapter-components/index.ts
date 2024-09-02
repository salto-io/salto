/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export * as auth from './src/auth'
export * as client from './src/client'
export * as credentials from './src/credentials'
export * as definitions from './src/definitions'
export * as deployment from './src/deployment'
export * as fetch from './src/fetch'
export * as filters from './src/filters'
export * as filterUtils from './src/filter_utils'
export * as e2eUtils from './src/e2e_utils'
export { FixElementsArgs, FixElementsHandler } from './src/fix_elements'
export * as references from './src/references'
export * from './src/add_alias'
export * from './src/adjust_utils'
export * from './src/references/element_fixers'
export * from './src/references/custom_references'
export * from './src/references/weak_reference_handler'
export * from './src/resolve_utils'
export * from './src/restore_utils'
export * from './src/references/get_references'
export * from './src/adapter-wrapper'
export * as openapi from './src/openapi'
export * as soap from './src/soap'

// TODO remove in SALTO-5538
export * as config from './src/config_deprecated'
export * as elements from './src/elements_deprecated'
