import {
  Element, Adapter, getChangeElement,
} from 'adapter-api'

import { logger } from '@salto/logging'
import wu from 'wu'
import { Plan, PlanItem, PlanItemId } from './plan'

const log = logger(module)

const deployAction = async (
  planItem: PlanItem,
  adapters: Record<string, Adapter>
): Promise<Element> => {
  const parent = planItem.parent()
  const element = getChangeElement(parent) as Element
  const adapterName = element.elemID.adapter
  const adapter = adapters[adapterName]
  if (!adapter) {
    throw new Error(`Missing adapter for ${adapterName}`)
  }

  if (parent.action === 'add') {
    return adapter.add(element)
  } if (parent.action === 'remove') {
    await adapter.remove(element)
    return element
  }
  return adapter.update(parent.data.before, parent.data.after, planItem.changes())
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
