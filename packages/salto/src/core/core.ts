import _ from 'lodash'
import {
  ObjectType, Element, getChangeElement, Adapter, InstanceElement, Value, Values, ElemID,
} from 'adapter-api'
import State from '../state/state'
import { mergeElements } from './merger'
import validateElements from './validator'
import { Plan, PlanItem, PlanItemId } from './plan'

// TODO: move apply and discover functions to dedicated files
const applyAction = async (
  state: State,
  action: PlanItem,
  adapters: Record<string, Adapter>
): Promise<void> => {
  const parent = action.parent()
  const { elemID } = getChangeElement(parent)
  const adapterName = elemID && elemID.adapter as string
  const adapter = adapters[adapterName]

  if (!adapter) {
    throw new Error(`Missing adapter for ${adapterName}`)
  }
  if (parent.action === 'add') {
    await state.update([await adapter.add(parent.data.after as ObjectType)])
  }
  if (parent.action === 'remove') {
    await adapter.remove(parent.data.before as ObjectType)
    await state.remove([parent.data.before as Element])
  }
  if (parent.action === 'modify') {
    await state.update([
      await adapter.update(parent.data.before as ObjectType, parent.data.after as ObjectType)])
  }
}

export const applyActions = async (state: State,
  plan: Plan,
  adapters: Record<string, Adapter>,
  reportProgress: (action: PlanItem) => void
): Promise<void> =>
  plan.walk((itemId: PlanItemId): Promise<void> => {
    const item = plan.getItem(itemId) as PlanItem
    reportProgress(item)
    return applyAction(state, item, adapters)
  })


export const mergeAndValidate = (elements: Element[]): Element[] => {
  const mergedElements = mergeElements(elements)
  const validationErrors = validateElements(mergedElements)

  if (validationErrors.length > 0) {
    throw new Error(`Failed to validate blueprints:
    ${validationErrors.map(e => e.message).join('\n')}`)
  }

  return mergedElements
}

export const discoverAll = async (state: State, adapters: Record<string, Adapter>):
Promise<Element[]> => {
  const result = _.flatten(await Promise.all(Object.values(adapters)
    .map(adapter => adapter.discover())))
  state.override(mergeAndValidate(result))
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
