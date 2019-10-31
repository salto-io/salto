import {
  Element, Adapter, getChangeElement,
} from 'adapter-api'

import { Plan, PlanItem, PlanItemId } from './plan'


const deployAction = async (
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
      return adapter.add(parent.data.after)
    case 'remove':
      await adapter.remove(parent.data.before)
      return Promise.resolve(parent.data.before)
    case 'modify':
      return adapter.update(parent.data.before, parent.data.after, planItem.changes())
    default:
      throw new Error('Unkown action type')
  }
}

export const applyActions = async (
  deployPlan: Plan,
  adapters: Record<string, Adapter>,
  reportProgress: (action: PlanItem) => void,
  postApplyAction: (action: string, element: Promise<Element>) => Promise<void>
): Promise<void> =>
  deployPlan.walk((itemId: PlanItemId): Promise<void> => {
    const item = deployPlan.getItem(itemId) as PlanItem
    reportProgress(item)
    const deployActionResult = deployAction(item, adapters)
    return postApplyAction(item.parent().action, deployActionResult)
  })
