/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import _ from 'lodash'
import { FixElementsFunc } from '@salto-io/adapter-api'
import { FixElementsArgs } from './types'
import { weakReferenceHandlers } from '../weak_references'
import { removeMissingExtensionsTransitionRulesHandler } from './remove_missing_extension_transition_rules'

export const createFixElementFunctions = (args: FixElementsArgs): Record<string, FixElementsFunc> => ({
  ..._.mapValues(weakReferenceHandlers, handler => handler.removeWeakReferences(args)),
  removeMissingExtensionsTransitionRules: removeMissingExtensionsTransitionRulesHandler(args),
})
