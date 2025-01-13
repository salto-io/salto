/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement } from '@salto-io/adapter-api'
import { FILTER_TYPE_NAME } from '../constants'

export const isEnhancedSearchInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === FILTER_TYPE_NAME &&
  (instance.value.description?.startsWith('Filter managed by Enhanced Search') ||
    instance.value.description?.startsWith('Filter managed by ScriptRunner'))
