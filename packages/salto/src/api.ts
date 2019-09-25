import wu from 'wu'
import {
  ObjectType, InstanceElement, Element, Value, Metrics,
} from 'adapter-api'
import {
  applyActions,
} from './core/core'
import {
  getInstancesOfType, importInstancesOfType, deleteInstancesOfType,
} from './core/records'
import initAdapters from './core/adapters/adapters'
import {
  getPlan, Plan, PlanItem, DetailedChange,
} from './core/plan'
import State from './state/state'
import { findElement, SearchResult } from './core/search'

import { Workspace } from './workspace/workspace'
import { discoverChanges } from './core/discover'

export interface Result {
  sucesses: boolean
}

const applyActionOnState = async (
  state: State,
  action: string,
  element: Promise<Element>
): Promise<void> => {
  if (action === 'remove') {
    return state.remove([await element])
  }
  return state.update([await element])
}

export const plan = async (
  workspace: Workspace,
): Promise<Plan> => {
  const state = new State(workspace.config.stateLocation)
  return getPlan(await state.get(), workspace.elements)
}

export const apply = async (
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldApply: (plan: Plan) => Promise<boolean>,
  reportProgress: (action: PlanItem) => void,
  force = false,
  metrics?: Metrics,
): Promise<Result> => {
  const state = new State(workspace.config.stateLocation)
  try {
    const actionPlan = getPlan(await state.get(), workspace.elements)
    if (force || await shouldApply(actionPlan)) {
      const [adapters] = await initAdapters(workspace.elements, fillConfig, metrics)
      await applyActions(
        actionPlan,
        adapters,
        reportProgress,
        (action, element) => applyActionOnState(state, action, element)
      )
    }
    return { sucesses: true }
  } finally {
    await state.flush()
  }
}

export const discover = async (
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  metrics?: Metrics,
): Promise<Result> => {
  const configToChange = (config: InstanceElement): DetailedChange => ({
    id: config.elemID,
    action: 'add',
    data: { after: config },
  })
  const state = new State(workspace.config.stateLocation)
  const [adapters, newConfigs] = await initAdapters(workspace.elements, fillConfig, metrics)

  const { changes, elements } = await discoverChanges(await state.get(), adapters)

  state.override(elements)
  await workspace.updateBlueprints(...wu.chain(changes, newConfigs.map(configToChange)))
  await Promise.all([workspace.flush(), state.flush()])

  return { sucesses: true }
}

export const describeElement = async (
  workspace: Workspace,
  searchWords: string[],
): Promise<SearchResult> =>
  findElement(searchWords, workspace.elements)


export const exportToCsv = async (
  typeId: string,
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<AsyncIterable<InstanceElement[]>> => {
  // Find the corresponding element in the state
  const state = new State(workspace.config.stateLocation)
  const stateElements = await state.get()
  const type = stateElements.find(elem => elem.elemID.getFullName() === typeId)
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto discover yet?`)
  }
  const [adapters] = await initAdapters(workspace.elements, fillConfig)

  return getInstancesOfType(type as ObjectType, adapters)
}

export const importFromCsvFile = async (
  typeId: string,
  records: Value[],
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<void> => {
  // Find the corresponding element in the state
  const state = new State(workspace.config.stateLocation)
  const stateElements = await state.get()
  const type = stateElements.find(elem => elem.elemID.getFullName() === typeId)
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto discover yet?`)
  }
  const [adapters] = await initAdapters(workspace.elements, fillConfig)
  await importInstancesOfType(type as ObjectType, records, adapters)
}

export const deleteFromCsvFile = async (
  typeId: string,
  records: Value[],
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<void> => {
  // Find the corresponding element in the state
  const state = new State(workspace.config.stateLocation)
  const stateElements = await state.get()
  const type = stateElements.find(elem => elem.elemID.getFullName() === typeId)
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto discover yet?`)
  }
  const [adapters] = await initAdapters(workspace.elements, fillConfig)
  await deleteInstancesOfType(type as ObjectType, records, adapters)
}
