/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { FixElementsFunc } from '@salto-io/adapter-api'
import { omitMissingUsersHandler } from './missing_users'
import { FixElementsArgs } from './types'
import { weakReferenceHandlers } from '../weak_references'

export const createFixElementFunctions = (args: FixElementsArgs): Record<string, FixElementsFunc> => ({
  omitMissingUsers: omitMissingUsersHandler(args),
  ..._.mapValues(weakReferenceHandlers, handler =>
    handler.removeWeakReferences({ elementsSource: args.elementsSource }),
  ),
})
