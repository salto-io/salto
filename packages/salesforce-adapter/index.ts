/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export { default } from './src/adapter'
export { adapter } from './src/adapter_creator'
export { default as SalesforceClient } from './src/client/client'
export { UsernamePasswordCredentials, OauthAccessTokenCredentials } from './src/types'
export { getAllInstances } from './src/filters/custom_objects_instances'
export { loadElementsFromFolder } from './src/sfdx_parser/sfdx_parser'
