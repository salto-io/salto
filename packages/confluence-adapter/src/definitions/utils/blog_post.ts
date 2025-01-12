/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { concatAdjustFunctions, definitions } from '@salto-io/adapter-components'
import { BLOG_POST_TYPE_NAME } from '../../constants'
import { createAdjustUserReferencesReverse } from './users'
import { increaseVersion } from './version'

export const adjustUserReferencesOnBlogPostReverse = createAdjustUserReferencesReverse(BLOG_POST_TYPE_NAME)

/**
 * AdjustFunction that runs all blog_post modification adjust functions.
 */
export const adjustBlogPostOnModification = concatAdjustFunctions<definitions.deploy.ChangeAndExtendedContext>(
  increaseVersion,
  adjustUserReferencesOnBlogPostReverse,
)
