/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { transformGraphQLItem } from '.'

const log = logger(module)

const getFullLanguageName = (code: string, locale: string = 'en'): string => {
  const displayNames = new Intl.DisplayNames(locale, { type: 'language' })
  const displayName = displayNames.of(code)
  if (!displayName) {
    log.warn('Could not find display name for language code %s', code)
    return code
  }
  return displayName
}

export const transform: definitions.AdjustFunctionMulti = async item => {
  const values = await transformGraphQLItem('flows')(item)
  return values.map(({ value }) => {
    if (value?.enabledLanguages) {
      value.enabledLanguages = value.enabledLanguages.map(getFullLanguageName)
    }
    return { value }
  })
}
