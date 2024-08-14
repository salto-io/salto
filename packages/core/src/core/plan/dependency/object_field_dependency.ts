/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import {
  getChangeData,
  Field,
  DependencyChanger,
  ChangeEntry,
  DependencyChange,
  addParentDependency,
  isFieldChangeEntry,
  isDependentAction,
  isObjectTypeChangeEntry,
} from '@salto-io/adapter-api'

export const addFieldToObjectDependency: DependencyChanger = async changes => {
  const objectChanges = collections.iterable.groupBy(wu(changes).filter(isObjectTypeChangeEntry), ([_id, change]) =>
    getChangeData(change).elemID.getFullName(),
  )

  const addObjectDependency = ([id, change]: ChangeEntry<Field>): DependencyChange[] =>
    (objectChanges.get(getChangeData(change).parent.elemID.getFullName()) ?? [])
      .filter(([_id, objectChange]) => isDependentAction(change.action, objectChange.action))
      .map(([objectChangeId]) => addParentDependency(id, objectChangeId))

  return wu(changes).filter(isFieldChangeEntry).map(addObjectDependency).flatten()
}
