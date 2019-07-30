import {
  Plan, PlanAction, ObjectType, InstanceElement,
} from 'adapter-api'
import { getPlan, applyActions, discoverAll } from './core'
import { init as initAdapters } from './adapters'
import Parser from '../parser/salto'
import { getAllElements } from '../blueprints/loader'
import Blueprint from '../blueprints/blueprint'
import State from '../state/state'

export const plan = async (
  blueprints: Blueprint[],
): Promise<Plan> => {
  const elements = await getAllElements(blueprints)
  const actionPlan = await getPlan(new State(), elements)
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
  const state = new State()
  const actionPlan = await getPlan(state, elements)
  if (force || await shouldApply(actionPlan)) {
    const [adapters] = await initAdapters(elements, fillConfig)
    await applyActions(state, actionPlan, adapters, reportProgress)
    state.flush()
  }
  return actionPlan
}

export const discover = async (
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<Blueprint> => {
  const elements = await getAllElements(blueprints)
  const [adapters, newAdapterConfigs] = await initAdapters(elements, fillConfig)
  const state = new State()
  const discoverElements = await discoverAll(state, adapters)
  state.flush()
  const uniqElements = [...discoverElements, ...Object.values(newAdapterConfigs)]
  const buffer = await Parser.dump(uniqElements)
  return { buffer, filename: 'none' }
}
