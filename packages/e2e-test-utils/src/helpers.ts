/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { DetailedChangeWithBaseChange, InstanceElement, toChange } from '@salto-io/adapter-api'
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import { getDetailedChanges } from '@salto-io/adapter-utils'

export const getAdditionDetailedChangesFromInstances = (
  instances: InstanceElement[],
): DetailedChangeWithBaseChange[] => {
  const changes = instances.map(inst => toChange({ after: inst }))
  return changes.flatMap(change => getDetailedChanges(change))
}

export const getDeletionDetailedChangesFromInstances = (
  instances: InstanceElement[],
): DetailedChangeWithBaseChange[] => {
  const changes = instances.map(inst => toChange({ before: inst }))
  return changes.flatMap(change => getDetailedChanges(change))
}

// Omit hidden fields that are not written to nacl after deployment
export const getHiddenFieldsToOmit = <Options extends definitionsUtils.fetch.FetchApiDefinitionsOptions>({
  fetchDefinitions,
  typeName,
  fieldNamesToIgnore = ['id'],
}: {
  fetchDefinitions: definitionsUtils.fetch.FetchApiDefinitions<Options>
  typeName: string
  fieldNamesToIgnore?: string[]
}): string[] => {
  const customizations = definitionsUtils.queryWithDefault(fetchDefinitions.instances).query(typeName)
    ?.element?.fieldCustomizations
  return Object.entries(customizations ?? {})
    .filter(([, customization]) => customization.hide === true)
    .map(([fieldName]) => fieldName)
    .filter(fieldName => !fieldNamesToIgnore.includes(fieldName))
}
