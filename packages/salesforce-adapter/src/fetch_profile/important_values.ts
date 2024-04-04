/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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

export const mergeWithDefaultImportantValues = (
  additionalImportantValues?: ImportantValues,
): ImportantValues => {
  if (additionalImportantValues === undefined) {
    return DEFAULT_IMPORTANT_VALUES
  }
  // The additional important values should override the default ones
  const additionalImportantValuesValues = new Set(
    additionalImportantValues.map((value) => value.value),
  )
  return DEFAULT_IMPORTANT_VALUES.filter(
    (importantValue) =>
      !additionalImportantValuesValues.has(importantValue.value),
  ).concat(additionalImportantValues)
}
