/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ImportantValue, ImportantValues } from '@salto-io/adapter-utils'

const highlighted = (value: string): ImportantValue => ({
  value,
  highlighted: true,
  indexed: false,
})

const highlightedAndIndexed = (value: string): ImportantValue => ({
  value,
  highlighted: true,
  indexed: true,
})

const DEFAULT_IMPORTANT_VALUES: ImportantValues = [
  highlighted('fullName'),
  highlighted('label'),
  highlighted('masterLabel'),
  highlighted('name'),
  highlighted('content'),
  highlighted('description'),
  highlighted('processType'),
  highlighted('relatedLists'),
  highlighted('layoutSections'),
  highlighted('lwcResources'),
  highlightedAndIndexed('apiVersion'),
  highlightedAndIndexed('status'),
  highlightedAndIndexed('active'),
]

export const mergeWithDefaultImportantValues = (additionalImportantValues?: ImportantValues): ImportantValues => {
  if (additionalImportantValues === undefined) {
    return DEFAULT_IMPORTANT_VALUES
  }
  // The additional important values should override the default ones
  const additionalImportantValuesValues = new Set(additionalImportantValues.map(value => value.value))
  return DEFAULT_IMPORTANT_VALUES.filter(
    importantValue => !additionalImportantValuesValues.has(importantValue.value),
  ).concat(additionalImportantValues)
}
