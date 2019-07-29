import {
  Plan, PlanAction, ObjectType, InstanceElement,
} from 'adapter-api'
import { getPlan, applyActions } from './core'
import Parser from '../parser/salto'
import { getAllElements } from '../blueprints/loader'
import State from '../state/state'
import { init as initAdapters } from './adapters'
import Blueprint from '../blueprints/blueprint'

export const plan = async (
  blueprints: Blueprint[],
): Promise<Plan> => {
  const elements = await getAllElements(blueprints)

  const actionPlan = await getPlan(elements)
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
  const [adapters] = await initAdapters(elements, fillConfig)

  const actionPlan = await getPlan(elements)
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
  const [adapters, newAdapterConfigs] = await initAdapters(elements, fillConfig)

  const discoverElements = await adapters.salesforce.discover()
  const uniqElements = [...discoverElements, ...Object.values(newAdapterConfigs)]
  // Save state
  await state.saveState(uniqElements)
  const buffer = await Parser.dump(uniqElements)
  return { buffer, filename: 'none' }
}
