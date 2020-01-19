import wu from 'wu'
import _ from 'lodash'
import {
  Change, ObjectType, isObjectType, ElemID, getChangeElement,
} from 'adapter-api'
import { GroupedNodeMap } from '@salto/dag'
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
