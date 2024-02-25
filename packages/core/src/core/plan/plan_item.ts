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
import wu from 'wu'

import { NodeId, Group, ActionName } from '@salto-io/dag'
import { Change, getChangeData, CompareOptions, DetailedChangeWithBaseChange } from '@salto-io/adapter-api'
import { getDetailedChanges } from '@salto-io/adapter-utils'

export type PlanItemId = NodeId
export type ChangeWithDetails = Change & {
  detailedChanges: () => DetailedChangeWithBaseChange[]
}
export type PlanItem = Group<Change> & {
  action: ActionName
  account: string
  changes: () => Iterable<ChangeWithDetails>
  detailedChanges: () => Iterable<DetailedChangeWithBaseChange>
}

const getGroupAction = (group: Group<Change>): ActionName => {
  const changeTypes = wu(group.items.values())
    .filter(change => getChangeData(change).elemID.isTopLevel())
    .map(change => change.action)
    .unique()
    .toArray()
  // If all top level changes have the same action, this is the item's action. If not all
  // changes are the same, or if there are no top level changes, this is considered modify
  return changeTypes.length === 1 ? changeTypes[0] : 'modify'
}

const getGroupAccount = (group: Group<Change>): string =>
  getChangeData(wu(group.items.values()).toArray()[0]).elemID.adapter

export const addPlanItemAccessors = (group: Group<Change>, compareOptions?: CompareOptions): PlanItem =>
  Object.assign(group, {
    action: getGroupAction(group),
    account: getGroupAccount(group),
    changes() {
      return wu(group.items.values()).map(change => ({
        ...change,
        detailedChanges: () => getDetailedChanges(change, compareOptions),
      }))
    },
    detailedChanges() {
      return wu(group.items.values())
        .map(change => getDetailedChanges(change, compareOptions))
        .flatten()
    },
  })
