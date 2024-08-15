/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  Change,
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { PROJECT_TYPE } from '../constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../filters/fields/constants'

/**
 * Make sure contexts will be deployed only after their relevant projects were deployed
 */
export const projectContextsDependencyChanger: DependencyChanger = async (changes, dependencies) => {
  const projectKeys = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(
      (change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
        isInstanceChange(change.change) && isAdditionOrModificationChange(change.change),
    )
    .filter(({ change }) => getChangeData(change).elemID.typeName === PROJECT_TYPE)
    .map(({ key }) => key)

  return projectKeys.flatMap(projectKey => {
    const contextDependencies = Array.from(dependencies.get(projectKey) ?? []).filter(key => {
      const change = changes.get(key)
      if (change === undefined) {
        return false
      }

      return getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME
    })

    return contextDependencies.flatMap(contextKey => [
      dependencyChange('remove', projectKey, contextKey),
      dependencyChange('add', contextKey, projectKey),
    ])
  })
}
