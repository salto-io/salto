/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { FixElementsFunc } from '@salto-io/adapter-api'
import { FixElementsArgs } from '@salto-io/adapter-components'
import { UserConfig } from '../config'
import { Options } from '../definitions/types'
import { replaceGroupsDomainHandler } from './replace_groups_domain'

export const createFixElementFunctions = (
  args: FixElementsArgs<Options, UserConfig>,
): Record<string, FixElementsFunc> => ({
  replaceGroupsDomain: replaceGroupsDomainHandler(args),
})
