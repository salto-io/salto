import wu from 'wu'
import { ObjectType, InstanceElement, Element, ActionName } from 'adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto/logging'
import fs from 'fs'
import {
  deployActions, ItemStatus, DeployError,
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
import {
  fetchChanges, FetchChange, getDetailedChanges, createElemIdGetter,
  MergeErrorWithElements, FatalFetchMergeError, FetchProgressEvents,
} from './core/fetch'
import { Workspace, CREDS_DIR } from './workspace/workspace'
import { serialize } from './serializer/elements'

export { ItemStatus }

const log = logger(module)

export const preview = async (
  workspace: Workspace,
): Promise<Plan> => {
  const state = new State(workspace.config.stateLocation)
  return getPlan(await state.get(), workspace.elements)
}

export interface DeployResult {
  success: boolean
  errors: DeployError[]
  changes?: Iterable<FetchChange>
}
export const deploy = async (
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
  shouldDeploy: (plan: Plan) => Promise<boolean>,
  reportProgress: (item: PlanItem, status: ItemStatus, details?: string) => void,
  force = false
): Promise<DeployResult> => {
  const changedElements = [] as Element[]
  const deployActionOnState = async (state: State, action: ActionName, element: Element
  ): Promise<void> => {
    if (action === 'remove') {
      return state.remove([element])
    }
    changedElements.push(element)
    return state.update([element])
  }

  const state = new State(workspace.config.stateLocation)
  const stateElements = await state.get()
  try {
    const actionPlan = getPlan(stateElements, workspace.elements)
    if (force || await shouldDeploy(actionPlan)) {
      const [adapters] = await initAdapters(workspace.elements, fillConfig)
      const errors = await deployActions(
        actionPlan,
        adapters,
        reportProgress,
        (action, element) => deployActionOnState(state, action, element)
      )

      const changedElementsIds = changedElements.map(e => e.elemID.getFullName())

      const changes = wu(getDetailedChanges(workspace.elements
        .filter(e => changedElementsIds.includes(e.elemID.getFullName())), changedElements))
        .map(change => ({ change, serviceChange: change }))
      const errored = errors.length > 0
      return {
        success: errored,
        changes,
        errors: errored ? errors : [],
      }
    }
    return { success: true, errors: [] }
  } finally {
    await state.flush()
  }
}

export type fillConfigFunc = (configType: ObjectType) => Promise<InstanceElement>

export type FetchResult = {
  changes: Iterable<FetchChange>
  mergeErrors: MergeErrorWithElements[]
  success: boolean
}
export type fetchFunc = (
  workspace: Workspace,
  fillConfig: fillConfigFunc,
  progressEmitter?: EventEmitter<FetchProgressEvents>,
) => Promise<FetchResult>

export const fetch: fetchFunc = async (workspace, fillConfig, progressEmitter?) => {
  const configToChange = (config: InstanceElement): FetchChange => {
    config.path = [CREDS_DIR, config.elemID.adapter]
    const change: DetailedChange = {
      id: config.elemID,
      action: 'add',
      data: { after: config },
    }
    return { change, serviceChange: change }
  }
  log.debug('fetch starting..')

  const state = new State(workspace.config.stateLocation)
  const stateElements = await state.get()
  log.debug(`finished loading ${stateElements.length} state elements`)

  const [adapters, newConfigs] = await initAdapters(workspace.elements, fillConfig,
    createElemIdGetter(stateElements))
  if (progressEmitter) {
    progressEmitter.emit('adaptersDidInitialize')
  }
  log.debug(`${Object.keys(adapters).length} were initialized [newConfigs=${newConfigs.length}]`)
  try {
    const { changes, elements, mergeErrors } = await fetchChanges(
      adapters, workspace.elements, stateElements, progressEmitter,
    )
    const ser = serialize(elements)
    fs.writeFileSync('sf_adapter_res.bpc', ser)
    log.debug(`${elements.length} elements were fetched [mergedErrors=${mergeErrors.length}]`)
    state.override(elements)
    await state.flush()
    log.debug(`finish to override state with ${elements.length} elements`)
    return {
      changes: wu.chain(changes, newConfigs.map(configToChange)),
      mergeErrors,
      success: true,
    }
  } catch (error) {
    if (error instanceof FatalFetchMergeError) {
      return {
        changes: [],
        mergeErrors: error.causes,
        success: false,
      }
    }
    throw error
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
  inputPath: string,
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
  await importInstancesOfType(type as ObjectType, inputPath, adapters)
}

export const deleteFromCsvFile = async (
  typeId: string,
  inputPath: string,
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
  await deleteInstancesOfType(type as ObjectType, inputPath, adapters)
}

export const init = async (workspaceName?: string): Promise<Workspace> => {
  const workspace = await Workspace.init('.', workspaceName)
  const state = new State(workspace.config.stateLocation)
  await state.flush()
  await workspace.flush()
  return workspace
}
