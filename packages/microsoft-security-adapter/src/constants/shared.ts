/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { naclCase } from '@salto-io/adapter-utils'

export const MICROSOFT_SECURITY = 'microsoft_security'

/* Fields */
// Used for service id purpose, when the id of the child is not globally unique
export const PARENT_ID_FIELD_NAME = 'parent_id'

/* OData constants */
export const ODATA_PREFIX = '#microsoft.graph.'

export const ODATA_ID_FIELD = '@odata.id'
export const ODATA_ID_FIELD_NACL_CASE = naclCase(ODATA_ID_FIELD)
export const ODATA_TYPE_FIELD = '@odata.type'
export const ODATA_TYPE_FIELD_NACL_CASE = naclCase(ODATA_TYPE_FIELD)
