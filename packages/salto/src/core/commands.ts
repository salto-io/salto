import _ from 'lodash'
import path from 'path'
import {
  ObjectType, InstanceElement,
} from 'adapter-api'
import {
  applyActions, discoverAll, mergeAndValidate, getInstancesOfType,
} from './core'
import initAdapters from './adapters/adapters'
import { getPlan, Plan, PlanItem } from './plan'
import Parser from '../parser/salto'
import { Blueprint, getAllElements } from '../blueprints/blueprint'
import State from '../state/state'


export const plan = async (
  blueprints: Blueprint[],
): Promise<Plan> => {
  const elements = mergeAndValidate(await getAllElements(blueprints))
  const state = new State()
  return getPlan(state, elements)
}

export const apply = async (
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldApply: (plan: Plan) => Promise<boolean>,
  reportProgress: (action: PlanItem) => void,
  force = false
): Promise<Plan> => {
  const elements = mergeAndValidate(await getAllElements(blueprints))
  const state = new State()
  try {
    const actionPlan = await getPlan(state, elements)
    if (force || await shouldApply(actionPlan)) {
      const [adapters] = await initAdapters(elements, fillConfig)
      await applyActions(state, actionPlan, adapters, reportProgress)
    }
    return actionPlan
  } finally {
    await state.flush()
  }
}

export const discover = async (
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<Blueprint[]> => {
  const elements = mergeAndValidate(await getAllElements(blueprints))
  const [adapters, newAdapterConfigs] = await initAdapters(elements, fillConfig)
  const state = new State()
  try {
    const discoverElements = await discoverAll(state, adapters)
    // TODO: we should probably avoid writing credentials to the output BP folder
    // It would probably be better to store them in the salto env once we implement it
    const configBPs = _.isEmpty(newAdapterConfigs) ? [] : [
      { buffer: Buffer.from(await Parser.dump(Object.values(newAdapterConfigs))), filename: 'config' },
    ]
    const elemBPs = await Promise.all(_(discoverElements)
      .groupBy(elem => elem.path)
      .map(async grp => ({
        buffer: Buffer.from(await Parser.dump(grp)),
        filename: grp[0].path ? path.join(...grp[0].path) : grp[0].elemID.adapter,
      }))
      .flatten()
      .value())
    return _.flatten([configBPs, elemBPs])
  } finally {
    await state.flush()
  }
}

export const exportToCsv = async (
  typeId: string,
  blueprints: Blueprint[],
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<AsyncIterable<InstanceElement[]>> => {
  // Find the corresponding element in the state
  const state = new State()
  const stateElements = await state.get()
  const type = stateElements.find(elem => elem.elemID.getFullName() === typeId)
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto discover yet?`)
  }
  const elements = mergeAndValidate(await getAllElements(blueprints))
  const [adapters] = await initAdapters(elements, fillConfig)
  const instanceObjects = getInstancesOfType(type as ObjectType, adapters)
  return instanceObjects
}
