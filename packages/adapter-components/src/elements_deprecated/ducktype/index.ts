/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export { toInstance } from './instance_elements'
export { replaceInstanceTypeForDeploy, restoreInstanceTypeFromDeploy } from './deployment_placeholder_types'
export { extractStandaloneFields } from './standalone_field_extractor'
export {
  getAllElements,
  getTypeAndInstances,
  EntriesRequester,
  getEntriesResponseValues,
  getNewElementsFromInstances,
} from './transformer'
export { generateType } from './type_elements'
export { addRemainingTypes } from './add_remaining_types'
