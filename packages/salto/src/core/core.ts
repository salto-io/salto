import _ from 'lodash'
import {
  ObjectType, Element, Adapter, getChangeElement,
} from 'adapter-api'

import { Plan, PlanItem, PlanItemId } from './plan'


const applyAction = async (
  planItem: PlanItem,
  adapters: Record<string, Adapter>
): Promise<Element> => {
  const parent = planItem.parent()
  const { elemID } = getChangeElement(parent)
  const adapterName = elemID && elemID.adapter as string
  const adapter = adapters[adapterName]

  if (!adapter) {
    throw new Error(`Missing adapter for ${adapterName}`)
  }
  switch (parent.action) {
    case 'add':
      return adapter.add(parent.data.after as ObjectType)
    case 'remove':
      await adapter.remove(parent.data.before as ObjectType)
      return Promise.resolve(parent.data.before)
    case 'modify':
      return adapter.update(parent.data.before as ObjectType, parent.data.after as ObjectType)
    default:
      throw new Error('Unkown action type')
  }
}

export const applyActions = async (
  applyPlan: Plan,
  adapters: Record<string, Adapter>,
  reportProgress: (action: PlanItem) => void,
  postApplyAction: (action: string, element: Promise<Element>) => Promise<void>
): Promise<void> =>
  applyPlan.walk((itemId: PlanItemId): Promise<void> => {
    const item = applyPlan.getItem(itemId) as PlanItem
    reportProgress(item)
    const applyActionResult = applyAction(item, adapters)
    return postApplyAction(item.parent().action, applyActionResult)
  })

export const discoverAll = async (adapters: Record<string, Adapter>):
Promise<Element[]> => {
  const result = _.flatten(await Promise.all(Object.values(adapters)
    .map(adapter => adapter.discover())))
  return result
}
