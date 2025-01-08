/*
 * Copyright 2025 Salto Labs Ltd.
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
  isAdditionChange,
  isInstanceChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import _ from 'lodash'

export const projectDependencyChanger: DependencyChanger = async changes => {
  const projectChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )
    .filter(({ change }) => getChangeData(change).elemID.typeName === 'Project')
    .filter(({ change }) => getChangeData(change).value.key !== undefined)

  const keyToProjects = _.groupBy(projectChanges, ({ change }) => getChangeData(change).value.key)

  return Object.values(keyToProjects).flatMap(projectChangesGroup => {
    const removalChanges = projectChangesGroup.filter(({ change }) => isRemovalChange(change))
    const additionChanges = projectChangesGroup.filter(({ change }) => isAdditionChange(change))

    return additionChanges.flatMap(additionChange =>
      removalChanges.map(removalChange => dependencyChange('add', additionChange.key, removalChange.key)),
    )
  })
}
