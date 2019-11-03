import {
  Element, Adapter, getChangeElement,
} from 'adapter-api'
import { WalkError, NodeSkippedError } from '@salto/dag'
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

export type actionStep = 'started' | 'finished' | 'error' | 'cancelled'

export const applyActions = async (
  deployPlan: Plan,
  adapters: Record<string, Adapter>,
  reportProgress: (item: PlanItem, step: actionStep, details?: string) => void,
  postApplyAction: (action: string, element: Element) => Promise<void>
): Promise<void> => {
  try {
    await deployPlan.walk(async (itemId: PlanItemId): Promise<void> => {
      const item = deployPlan.getItem(itemId) as PlanItem
      reportProgress(item, 'started')
      try {
        const deployActionResult = await deployAction(item, adapters)
        reportProgress(item, 'finished')
        await postApplyAction(item.parent().action, deployActionResult)
      } catch (error) {
        reportProgress(item, 'error', error.message)
        throw error
      }
    })
  } catch (error) {
    if (error instanceof WalkError) {
      error.handlerErrors.forEach((nodeError: Error, key: PlanItemId) => {
        if (nodeError instanceof NodeSkippedError) {
          const item = deployPlan.getItem(key) as PlanItem
          const parnetItem = deployPlan.getItem(nodeError.causingNode) as PlanItem
          const parnetItemName = getChangeElement(parnetItem.parent()).elemID.getFullName()
          reportProgress(item, 'cancelled', parnetItemName)
        }
      })
      if (error.circularDependencyError) {
        throw error.circularDependencyError
      }
    } else {
      throw error
    }
  }
}
