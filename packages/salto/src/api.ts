import wu from 'wu'
import {
  ObjectType, InstanceElement, Element, Value,
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

import { Workspace, CREDS_DIR } from './workspace/workspace'
import { fetchChanges, FetchChange, getDetailedChanges } from './core/fetch'
import { MergeError } from './core/merger/internal/common'


export const preview = async (
  workspace: Workspace,
): Promise<Plan> => {
  const state = new State(workspace.config.stateLocation)
  return getPlan(await state.get(), workspace.elements)
}

export interface DeployResult {
  sucesses: boolean
  changes?: Iterable<DetailedChange>
}
export const deploy = async (
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldDeploy: (plan: Plan) => Promise<boolean>,
  reportProgress: (action: PlanItem) => void,
  force = false
): Promise<DeployResult> => {
  const deployActionOnState = async (state: State, action: string, element: Promise<Element>
  ): Promise<void> => {
    if (action === 'remove') {
      return state.remove([await element])
    }
    return state.update([await element])
  }

  const state = new State(workspace.config.stateLocation)
  try {
    const actionPlan = getPlan(await state.get(), workspace.elements)
    if (force || await shouldDeploy(actionPlan)) {
      const [adapters] = await initAdapters(workspace.elements, fillConfig)
      await applyActions(
        actionPlan,
        adapters,
        reportProgress,
        (action, element) => deployActionOnState(state, action, element)
      )
      return {
        sucesses: true,
        changes: getDetailedChanges(workspace.elements, await state.get()) || undefined,
      }
    }
    return { sucesses: true }
  } finally {
    await state.flush()
  }
}

export type fillConfigFunc = (configType: ObjectType) => Promise<InstanceElement>

export type FetchResult = {
  changes: Iterable<FetchChange>
  mergeErrors: MergeError[]
}
export type fetchFunc = (
  workspace: Workspace,
  fillConfig: fillConfigFunc,
) => Promise<FetchResult>

export const fetch: fetchFunc = async (workspace, fillConfig) => {
  const configToChange = (config: InstanceElement): FetchChange => {
    config.path = [CREDS_DIR, config.elemID.adapter]
    const change: DetailedChange = {
      id: config.elemID,
      action: 'add',
      data: { after: config },
    }
    return { change, serviceChange: change }
  }

  const state = new State(workspace.config.stateLocation)
  const [adapters, newConfigs] = await initAdapters(workspace.elements, fillConfig)

  const { changes, elements, mergeErrors } = await fetchChanges(
    adapters, workspace.elements, await state.get(),
  )

  state.override(elements)
  await state.flush()
  return {
    changes: wu.chain(changes, newConfigs.map(configToChange)),
    mergeErrors,
  }
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
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto fetch yet?`)
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
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto fetch yet?`)
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
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto fetch yet?`)
  }
  const [adapters] = await initAdapters(workspace.elements, fillConfig)
  await deleteInstancesOfType(type as ObjectType, records, adapters)
}

export const init = async (workspaceName?: string): Promise<Workspace> => {
  const workspace = await Workspace.init('.', workspaceName)
  const state = new State(workspace.config.stateLocation)
  await state.flush()
  await workspace.flush()
  return workspace
}
