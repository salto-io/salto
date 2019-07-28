import _ from 'lodash'
import wu from 'wu'
import {
  PlanAction, ObjectType, Element, Plan, ElemID,
} from 'adapter-api'
import { buildDiffGraph } from '../dag/diff'
import { DataNodeMap } from '../dag/nodemap'
import State from '../state/state'
import { Adapter } from './adapters'

const applyAction = async (
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
    await adapter.add(action.data.after as ObjectType)
  }
  if (action.action === 'remove') {
    await adapter.remove(action.data.before as ObjectType)
  }
  if (action.action === 'modify') {
    await adapter.update(action.data.before as ObjectType, action.data.after as ObjectType)
  }
}

export const getPlan = async (allElements: Element[]): Promise<Plan> => {
  const toNodeMap = (elements: Element[]): DataNodeMap<Element> => {
    const nodeMap = new DataNodeMap<Element>()
    elements.filter(e => e.elemID.adapter)
      .filter(e => e.elemID.name !== ElemID.CONFIG_INSTANCE_NAME)
      .forEach(element => nodeMap.addNode(element.elemID.getFullName(), [], element))
    return nodeMap
  }
  const state = new State()
  const before = toNodeMap(await state.getLastState())
  const after = toNodeMap(allElements)

  // TODO: enable this once we support instances and we can add test coverage
  // if (isInstanceElement(element)) {
  //   dependsOn.push(element.type.elemID.getFullName())
  // }
  // TODO: split elements to fields and fields values
  const diffGraph = buildDiffGraph(before, after,
    id => _.isEqual(before.getData(id), after.getData(id)))
  return wu(diffGraph.evaluationOrder()).map(
    id => (diffGraph.getData(id) as PlanAction)
  ).toArray()
}

export const applyActions = async (
  plan: Plan,
  adapters: Record<string, Adapter>,
  reportProgress: (action: PlanAction) => void
): Promise<void> =>
  wu(plan).reduce((result, action) => result.then(
    () => {
      reportProgress(action)
      return applyAction(action, adapters)
    }
  ), Promise.resolve())
