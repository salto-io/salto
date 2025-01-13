/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ODATA_TYPE_FIELD_NACL_CASE } from '../../../../constants'
import { ElementFieldCustomization } from '../../shared/types'

export const ASSIGNMENT_FIELD_CUSTOMIZATION: ElementFieldCustomization = {
  sort: {
    properties: [
      { path: `target.${ODATA_TYPE_FIELD_NACL_CASE}` },
      { path: 'target.groupId.displayName' },
      { path: 'target.deviceAndAppManagementAssignmentFilterId.displayName' },
      { path: 'target.deviceAndAppManagementAssignmentFilterId.platform' },
    ],
  },
}
