/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'

// System scopes are built-in default scopes that can't be added or removed.
export const isSystemScope = (change: Change<InstanceElement>): boolean => getChangeData(change).value.system === true

// "sub" is reserved claim name that can not be used by any other claim.
export const SUB_CLAIM_NAME = 'sub'

// A default claim that is created when the authorization server is created.
export const isSubDefaultClaim = (change: Change<InstanceElement>): boolean =>
  getChangeData(change).value.system === true && getChangeData(change).value.name === SUB_CLAIM_NAME
