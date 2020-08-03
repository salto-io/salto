/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { AdditionDiff, RemovalDiff, ModificationDiff } from '@salto-io/dag'
import { Change, isAdditionDiff, isRemovalDiff, isModificationDiff, ChangeDataType } from './change'
import { ChangeId } from './dependency_changer'

export type ChangeGroupId = string

export type ChangeGroup = {
  groupID: ChangeGroupId
  changes: ReadonlyArray<Change>
}

export type ChangeGroupIdFunction = (changes: Map<ChangeId, Change>) =>
  Promise<Map<ChangeId, ChangeGroupId>>

export const isAdditionGroup = (
  changeGroup: ChangeGroup
): changeGroup is { groupID: ChangeGroupId; changes: AdditionDiff<ChangeDataType>[] } =>
  (changeGroup.changes.every(change => isAdditionDiff(change)))

export const isRemovalGroup = (
  changeGroup: ChangeGroup
): changeGroup is { groupID: ChangeGroupId; changes: RemovalDiff<ChangeDataType>[] } =>
  (changeGroup.changes.every(change => isRemovalDiff(change)))

export const isModificationGroup = (
  changeGroup: ChangeGroup
): changeGroup is { groupID: ChangeGroupId; changes: ModificationDiff<ChangeDataType>[] } =>
  (changeGroup.changes.every(change => isModificationDiff(change)))
