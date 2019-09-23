import _ from 'lodash'
import {
  ObjectType, Element, Adapter, InstanceElement, Value, Values, ElemID, getChangeElement,
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

export const getInstancesOfType = (type: ObjectType, adapters: Record<string, Adapter>):
AsyncIterable<InstanceElement[]> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  return adapter.getInstancesOfType(type)
}

const recordToInstanceElement = (type: ObjectType, record: Values):
InstanceElement =>
  // Convert the result to Instance Elements
  new InstanceElement(
    new ElemID(type.elemID.adapter, type.elemID.name, record.Id),
    type,
    record
  )

const instancesIterator = async function *instancesIterator(
  type: ObjectType,
  records: Values[]
): AsyncIterable<InstanceElement> {
  const instances = records.map(record => recordToInstanceElement(type, record))
  // eslint-disable-next-line no-restricted-syntax
  for (const instance of instances) {
    yield instance
  }
}

export const importInstancesOfType = async (
  type: ObjectType, records: Value[], adapters: Record<string, Adapter>):
Promise<void> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  await adapter.importInstancesOfType(type, instancesIterator(type, records))
}

export const deleteInstancesOfType = async (
  type: ObjectType, records: Value[], adapters: Record<string, Adapter>):
Promise<void> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  await adapter.deleteInstancesOfType(type, instancesIterator(type, records))
}
