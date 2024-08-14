/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  dependencyChange,
  DependencyChanger,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../filters/fields/constants'

export const fieldContextDependencyChanger: DependencyChanger = async (changes, dependencies) => {
  const modificationChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(
      change =>
        isInstanceChange(change.change) &&
        isModificationChange(change.change) &&
        getChangeData(change.change).elemID.typeName === FIELD_TYPE_NAME,
    )
    .map(({ key }) => key)
  return modificationChanges.flatMap(modificationKey => {
    const contextDependencies = Array.from(dependencies.get(modificationKey) ?? []).filter(key => {
      const change = changes.get(key)
      if (change === undefined) {
        return false
      }
      return isAdditionChange(change) && getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME
    })
    return contextDependencies.map(contextKey => dependencyChange('remove', modificationKey, contextKey))
  })
}
