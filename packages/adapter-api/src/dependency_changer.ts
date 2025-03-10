/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { NodeId } from '@salto-io/dag'
import { Change, ChangeDataType, getChangeData } from './change'
import { Field, InstanceElement, ObjectType, isField, isInstanceElement, isObjectType } from './elements'

export type ChangeId = NodeId
export const changeId = (change: Change): ChangeId => `${getChangeData(change).elemID.getFullName()}/${change.action}`

type Dependency = {
  source: ChangeId
  target: ChangeId
}

export type DependencyChange = {
  action: 'add' | 'remove'
  dependency: Dependency
}

export type DependencyChanger = (
  changes: ReadonlyMap<ChangeId, Change>,
  dependencies: ReadonlyMap<ChangeId, ReadonlySet<ChangeId>>,
) => Promise<Iterable<DependencyChange>>

// Utility functions
export const dependencyChange = (
  action: DependencyChange['action'],
  source: ChangeId,
  target: ChangeId,
): DependencyChange => ({ action, dependency: { source, target } })

export const isDependentAction = (srcAction: Change['action'], targetAction: Change['action']): boolean =>
  targetAction !== 'modify' && (srcAction === 'modify' || srcAction === targetAction)

// Reference dependency means source must be added after target and removed before target
export const addReferenceDependency = (
  targetAction: Change['action'],
  src: ChangeId,
  target: ChangeId,
): DependencyChange =>
  targetAction === 'add' ? dependencyChange('add', src, target) : dependencyChange('add', target, src)

// Parent dependency means the source must be added after the target but the source cannot be
// removed before the target, so in both cases the change to the target must happen before the
// change to the source
export const addParentDependency = (src: ChangeId, target: ChangeId): DependencyChange =>
  dependencyChange('add', src, target)

export type ChangeEntry<T = ChangeDataType> = [ChangeId, Change<T>]
export const isFieldChangeEntry = (entry: ChangeEntry): entry is ChangeEntry<Field> => isField(getChangeData(entry[1]))
export const isInstanceChangeEntry = (entry: ChangeEntry): entry is ChangeEntry<InstanceElement> =>
  isInstanceElement(getChangeData(entry[1]))
export const isObjectTypeChangeEntry = (entry: ChangeEntry): entry is ChangeEntry<ObjectType> =>
  isObjectType(getChangeData(entry[1]))
