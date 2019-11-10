import wu from 'wu'
import {
  Element, Adapter, getChangeElement, ActionName,
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

export class DeployError extends Error {
  public readonly elementId: string

  constructor(elementId: string, message: string) {
    super(message)
    this.elementId = elementId
  }
}

export type ItemStatus = 'started' | 'finished' | 'error' | 'cancelled'

export const deployActions = async (
  deployPlan: Plan,
  adapters: Record<string, Adapter>,
  reportProgress: (item: PlanItem, status: ItemStatus, details?: string) => void,
  postApplyAction: (action: ActionName, element: Element) => Promise<void>
): Promise<DeployError[]> => {
  const deployErrors: DeployError[] = []
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
    return deployErrors
  } catch (error) {
    if (error instanceof WalkError) {
      error.handlerErrors.forEach((nodeError: Error, key: PlanItemId) => {
        const item = deployPlan.getItem(key) as PlanItem
        const itemName = getChangeElement(item.parent()).elemID.getFullName()
        if (nodeError instanceof NodeSkippedError) {
          const parnetItem = deployPlan.getItem(nodeError.causingNode) as PlanItem
          const parnetItemName = getChangeElement(parnetItem.parent()).elemID.getFullName()
          reportProgress(item, 'cancelled', parnetItemName)
        }
        deployErrors.push(new DeployError(itemName, nodeError.message))
      })
      if (error.circularDependencyError) {
        // Take the first nodeId as the elementId - just cause we need one
        const nodePlanItemId = wu(error.circularDependencyError.nodes.keys()).toArray()[0]
        const node = deployPlan.getItem(nodePlanItemId) as PlanItem
        const nodeElementId = getChangeElement(node.parent()).elemID.getFullName()
        deployErrors.push(new DeployError(nodeElementId, error.circularDependencyError.message))
      }
    }
    return deployErrors
  }
}
