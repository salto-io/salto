/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import {
  Field,
  InstanceElement,
  isType,
  getChangeData,
  ChangeEntry,
  isFieldChangeEntry,
  isInstanceChangeEntry,
  DependencyChanger,
  DependencyChange,
  addReferenceDependency,
  isDependentAction,
} from '@salto-io/adapter-api'

type FieldOrInstanceChange = ChangeEntry<Field | InstanceElement>
const isFieldOrInstanceChange = (entry: ChangeEntry): entry is FieldOrInstanceChange =>
  isFieldChangeEntry(entry) || isInstanceChangeEntry(entry)

export const addTypeDependency: DependencyChanger = async changes => {
  const typeChanges = collections.iterable.groupBy(
    wu(changes).filter(([_id, change]) => isType(getChangeData(change))),
    ([_id, change]) => getChangeData(change).elemID.getFullName(),
  )

  const addChangeTypeDependency = ([id, change]: FieldOrInstanceChange): DependencyChange[] =>
    (typeChanges.get(getChangeData(change).refType.elemID.getFullName()) ?? [])
      .filter(([_id, typeChange]) => isDependentAction(change.action, typeChange.action))
      .map(([typeChangeId, typeChange]) => addReferenceDependency(typeChange.action, id, typeChangeId))

  return wu(changes).filter(isFieldOrInstanceChange).map(addChangeTypeDependency).flatten()
}
