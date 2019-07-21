import _ from 'lodash'
import wu from 'wu'
import {
  PlanAction, ObjectType, isInstanceElement, InstanceElement, Element, Plan, ElemID,
} from 'adapter-api'

import { buildDiffGraph } from '../dag/diff'
import { DataNodeMap } from '../dag/nodemap'
import Parser from '../parser/salto'
import State from '../state/state'
import Blueprint from './blueprint'
import { adapters, init as initAdapters } from './adapters'


export const getAllElements = async (blueprints: Blueprint[]): Promise<Element[]> => {
  const parseResults = await Promise.all(blueprints.map(
    bp => Parser.parse(bp.buffer, bp.filename)
  ))

  const elements = _.flatten(parseResults.map(r => r.elements))
  const errors = _.flatten(parseResults.map(r => r.errors))

  if (errors.length > 0) {
    throw new Error(`Failed to parse blueprints: ${errors.join('\n')}`)
  }
  return elements
}

const getPlan = async (allElements: Element[], state: State): Promise<Plan> => {
  const toNodeMap = (elements: Element[]): DataNodeMap<Element> => {
    const nodeMap = new DataNodeMap<Element>()
    elements.filter(e => e.elemID.adapter)
      .filter(e => e.elemID.name !== ElemID.CONFIG_INSTANCE_NAME)
      .forEach(element => nodeMap.addNode(element.elemID.getFullName(), [], element))
    return nodeMap
  }
  const before = toNodeMap(await state.getLastState())
  const after = toNodeMap(allElements)

  // TODO: enable this once we support instances and we can add test coverage
  // if (isInstanceElement(element)) {
  //   dependsOn.push(element.type.elemID.getFullName())
  // }
  // TODO: split elements to fields and fields values
  const diffGraph = buildDiffGraph(before, after,
    id => _.isEqual(before.getData(id), after.getData(id)))
  return wu(diffGraph.evaluationOrder()).map(id => (diffGraph.getData(id) as PlanAction))
}

// Should be the adapter interface in the param, waiting for merge
const applyAction = async (
  action: PlanAction,
  adapters: Record<string, SalesforceAdapter>
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

const getConfigInstance = async (elements: Element[],
  configType: ObjectType,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<InstanceElement> => {
  const configElements = elements.filter(
    element => isInstanceElement(element)
    && element.type.elemID.getFullName() === configType.elemID.getFullName()
  )
  const configElement = configElements.pop() as InstanceElement
  if (configElement) {
    return configElement
  }
  return fillConfig(configType)
}

const initAdapters = (
  salesforceConfig: InstanceElement
): Record<string, SalesforceAdapter> => {
  const adapters: Record<string, SalesforceAdapter> = {
    salesforce: new SalesforceAdapter(salesforceConfig),
  }
  return adapters
}

const applyActions = async (
  plan: Plan,
  adapters: Record<string, SalesforceAdapter>,
  reportProgress: (action: PlanAction) => void
): Promise<void> =>
  wu(plan).reduce((result, action) => result.then(
    () => {
      reportProgress(action)
      return applyAction(action, adapters)
    }
  ), Promise.resolve())

export const plan = async (
  blueprints: Blueprint[],
): Promise<Plan> => {
  const elements = await getAllElements(blueprints)

  const state = new State()
  const actionPlan = await getPlan(elements, state)
  return actionPlan
}

export const apply = async (
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldApply: (plan: Plan) => Promise<boolean>,
  reportProgress: (action: PlanAction) => void,
  force: boolean = false
): Promise<Plan> => {
  const elements = await getAllElements(blueprints)
  const salesforceConfigType = SalesforceAdapter.getConfigType()
  const salesforceConfig = await getConfigInstance(
    elements,
    salesforceConfigType,
    fillConfig
  )
  const adapters = initAdapters(salesforceConfig)

  const state = new State()
  const actionPlan = await getPlan(elements, state)
  if (force || await shouldApply(actionPlan)) {
    await applyActions(actionPlan, adapters, reportProgress)
  }
  return actionPlan
}

export const discover = async (
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<Blueprint> => {
  const state = new State()
  const elements = await getAllElements(blueprints)
  const salesforceConfigType = SalesforceAdapter.getConfigType()
  const salesforceConfig = await getConfigInstance(
    elements,
    salesforceConfigType,
    fillConfig
  )
  const adapters = initAdapters(salesforceConfig)

  const discoverElements = await adapters.salesforce.discover()
  const uniqElements = [...discoverElements, salesforceConfig]
  // Save state
  await state.saveState(uniqElements)
  const buffer = await Parser.dump(uniqElements)
  return { buffer, filename: 'none' }
}
