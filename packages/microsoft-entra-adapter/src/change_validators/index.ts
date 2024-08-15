/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export { builtInInstancesValidator } from './built_in_instances_validator'
export { requiredFieldsValidator } from './required_fields_validator'
export {
  readOnlyFieldsValidator,
  TYPE_NAME_TO_READ_ONLY_FIELDS_ADDITION,
  TYPE_NAME_TO_READ_ONLY_FIELDS_MODIFICATION,
} from './read_only_fields_validator'
