/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator } from '@salto-io/adapter-api'
import { uniquePageTitleUnderSpaceValidator, uniqueSpaceKeyValidator } from './change_validators'

export default (): Record<string, ChangeValidator> => ({
  uniquePageTitleUnderSpace: uniquePageTitleUnderSpaceValidator,
  uniqueSpaceKey: uniqueSpaceKeyValidator,
})
