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
import wu from 'wu'
import _ from 'lodash'
import {
  Change, ObjectType, isObjectType, ElemID, getChangeElement,
} from '@salto-io/adapter-api'
import { GroupedNodeMap } from '@salto-io/dag'
import { Plan, PlanItem } from '../../src/core/plan'
import { getAllElements } from './elements'

export const getPlan = (): Plan => {
  const result = new GroupedNodeMap<Change>()

  const elem = getAllElements().find(isObjectType) as ObjectType
  const change: Change = { action: 'add', data: { after: elem } }
  const elemFullName = elem.elemID.getFullName()

  const planItem: PlanItem = {
    groupKey: elemFullName,
    items: new Map<string, Change>([[elemFullName, change]]),
    parent: () => change,
    changes: () => [change],
    detailedChanges: () => [],
    getElementName: () => elemFullName,
  }

  result.addNode(_.uniqueId(elemFullName), [], planItem)

  Object.assign(result, {
    itemsByEvalOrder(): Iterable<PlanItem> {
      return [planItem]
    },
    getItem(_id: string): PlanItem {
      return planItem
    },
  })
  return result as Plan
}

export const getFirstPlanItem = (plan: Plan): PlanItem =>
  wu(plan.itemsByEvalOrder()).next().value

export const getChange = (item: PlanItem, elemID: ElemID): Change =>
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  wu(item.changes()).find(change => getChangeElement(change).elemID.isEqual(elemID))!
