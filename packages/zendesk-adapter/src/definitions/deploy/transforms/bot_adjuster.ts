/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { transformResGraphQLItem } from '.'
import { getFullLanguageName } from '../../shared/transforms/bot_adjuster'

export const transformResponse: (
  innerRoot: string,
) => definitions.AdjustFunctionSingle<definitions.deploy.ChangeAndExtendedContext> = innerRoot => async item => {
  const { value } = await transformResGraphQLItem(innerRoot)(item)
  if (value?.enabledLanguages) {
    value.enabledLanguages = value.enabledLanguages.map(getFullLanguageName)
  }
  return { value }
}
