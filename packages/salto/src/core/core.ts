import _ from 'lodash'
import wu from 'wu'
import {
  PlanAction, ObjectType, Element, Plan, ElemID, isEqualElements, InstanceElement,
} from 'adapter-api'
import { buildDiffGraph } from '../dag/diff'
import { DataNodeMap } from '../dag/nodemap'
import State from '../state/state'
import { Adapter } from './adapters'
import { mergeElements } from './merger'
import validateElements from './validator'

const applyAction = async (
  state: State,
  action: PlanAction,
  adapters: Record<string, Adapter>
): Promise<void> => {
  const existingValue = (action.data.after || action.data.before) as Element
  const { elemID } = existingValue
  const adapterName = elemID && elemID.adapter as string
  const adapter = adapters[adapterName]

  if (!adapter) {
    throw new Error(`Missing adapter for ${adapterName}`)
  }
  if (action.action === 'add') {
    state.update([await adapter.add(action.data.after as ObjectType)])
  }
  if (action.action === 'remove') {
    await adapter.remove(action.data.before as ObjectType)
    state.remove([action.data.before as Element])
  }
  if (action.action === 'modify') {
    state.update([
      await adapter.update(action.data.before as ObjectType, action.data.after as ObjectType)])
  }
}

export const getPlan = async (state: State, allElements: Element[]): Promise<Plan> => {
  const toNodeMap = (elements: Element[]): DataNodeMap<Element> => {
    const nodeMap = new DataNodeMap<Element>()
    elements.filter(e => e.elemID.adapter)
      .filter(e => e.elemID.name !== ElemID.CONFIG_INSTANCE_NAME)
      .forEach(element => nodeMap.addNode(element.elemID.getFullName(), [], element))
    return nodeMap
  }
  const before = toNodeMap(await state.get())
  const after = toNodeMap(allElements)

  // TODO: enable this once we support instances and we can add test coverage
  // if (isInstanceElement(element)) {
  //   dependsOn.push(element.type.elemID.getFullName())
  // }
  // TODO: split elements to fields and fields values
  const diffGraph = buildDiffGraph(
    before,
    after,
    id => isEqualElements(before.getData(id), after.getData(id))
  )
  return wu(diffGraph.evaluationOrder()).map(
    id => (diffGraph.getData(id) as PlanAction)
  ).toArray()
}

export const applyActions = async (state: State,
  plan: Plan,
  adapters: Record<string, Adapter>,
  reportProgress: (action: PlanAction) => void
): Promise<void> =>
  wu(plan).reduce((result, action) => result.then(
    () => {
      reportProgress(action)
      return applyAction(state, action, adapters)
    }
  ), Promise.resolve())

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

export const getInstancesOfType = async (type: ObjectType, adapters: Record<string, Adapter>):
Promise<InstanceElement[]> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  return await adapter.getInstancesOfType(type)
}
