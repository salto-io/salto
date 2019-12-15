import wu from 'wu'
import {
  ObjectType, InstanceElement, Element, ActionName, DataModificationResult, ElemIdGetter, Adapter,
} from 'adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto/logging'
import {
  deployActions, ItemStatus, DeployError,
} from './core/deploy'
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
  MergeErrorWithElements, FatalFetchMergeError, FetchProgressEvents, toAddFetchChange,
} from './core/fetch'
import { Workspace, CREDS_DIR } from './workspace/workspace'

export { ItemStatus }

const log = logger(module)

export const login = async (
  workspace: Workspace,
  fillConfig: (t: ObjectType) => Promise<InstanceElement>,
  services: string[],
  getElemIdFunc?: ElemIdGetter
): Promise<Record<string, Adapter>> => {
  const configToChange = (config: InstanceElement): DetailedChange => {
    config.path = [CREDS_DIR, config.elemID.adapter]
    return toAddFetchChange(config).change
  }

  const [adapters, newConfigs] = await initAdapters(
    workspace.elements,
    fillConfig, services,
    getElemIdFunc
  )
  log.debug(`${Object.keys(adapters).length} adapters were initialized [newConfigs=${
    newConfigs.length}]`)

  if (newConfigs.length > 0) {
    await workspace.updateBlueprints(...newConfigs.map(configToChange))
    const criticalErrors = (await workspace.getWorkspaceErrors())
      .filter(e => e.severity === 'Error')
    if (criticalErrors.length > 0) {
      log.warn('can not persist new configs due to critical workspace errors.')
    } else {
      await workspace.flush()
      const newAdapters = newConfigs.map(config => config.elemID.adapter)
      log.debug(`persisted new configs for adapers: ${newAdapters.join(',')}`)
    }
  }
  return adapters
}

const filterElementsByServices = (
  elements: Element[] | readonly Element[],
  services: string[]
): Element[] => elements.filter(e => services.includes(e.elemID.adapter))

export const preview = async (
  workspace: Workspace,
  services: string[] = workspace.config.services
): Promise<Plan> => {
  const state = new State(workspace.config.stateLocation)
  const stateElements = await state.get()
  return getPlan(
    filterElementsByServices(stateElements, services),
    filterElementsByServices(workspace.elements, services)
  )
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
  services: string[] = workspace.config.services,
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
    const actionPlan = getPlan(
      filterElementsByServices(stateElements, services),
      filterElementsByServices(workspace.elements, services)
    )
    if (force || await shouldDeploy(actionPlan)) {
      const adapters = await login(workspace, fillConfig, services)
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
        success: !errored,
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
  services: string[],
  progressEmitter?: EventEmitter<FetchProgressEvents>,
) => Promise<FetchResult>

export const fetch: fetchFunc = async (
  workspace,
  fillConfig,
  services = workspace.config.services,
  progressEmitter?
) => {
  log.debug('fetch starting..')

  const state = new State(workspace.config.stateLocation)
  const stateElements = await state.get()
  const filteredStateElements = filterElementsByServices(stateElements, services)
  log.debug(`finished loading ${stateElements.length} state elements`)

  const adapters = await login(
    workspace,
    fillConfig,
    services,
    createElemIdGetter(filteredStateElements)
  )

  if (progressEmitter) {
    progressEmitter.emit('adaptersDidInitialize')
  }
  try {
    const { changes, elements, mergeErrors } = await fetchChanges(
      adapters,
      filterElementsByServices(workspace.elements, services),
      filteredStateElements,
      progressEmitter,
    )
    log.debug(`${elements.length} elements were fetched [mergedErrors=${mergeErrors.length}]`)
    state.override(elements)
    await state.flush()
    log.debug(`finish to override state with ${elements.length} elements`)
    return {
      changes,
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

const getTypeFromState = async (stateLocation: string, typeId: string): Promise<Element> => {
  const state = new State(stateLocation)
  const stateElements = await state.get()
  const type = stateElements.find(elem => elem.elemID.getFullName() === typeId)
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto fetch yet?`)
  }
  return type
}

export const exportToCsv = async (
  typeId: string,
  outPath: string,
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<DataModificationResult> => {
  const type = await getTypeFromState(workspace.config.stateLocation, typeId)
  const typeAdapter = type.elemID.adapter
  if (!workspace.config.services?.includes(typeAdapter)) {
    throw new Error(`The type is from a service (${typeAdapter}) that is not set up for this workspace`)
  }
  const adapters = await login(workspace, fillConfig, [typeAdapter])
  return getInstancesOfType(type as ObjectType, adapters, outPath)
}

export const importFromCsvFile = async (
  typeId: string,
  inputPath: string,
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<DataModificationResult> => {
  const type = await getTypeFromState(workspace.config.stateLocation, typeId)
  const typeAdapter = type.elemID.adapter
  if (!workspace.config.services?.includes(typeAdapter)) {
    throw new Error(`The type is from a service (${typeAdapter}) that is not set up for this workspace`)
  }
  const adapters = await login(workspace, fillConfig, [typeAdapter])
  return importInstancesOfType(type as ObjectType, inputPath, adapters)
}

export const deleteFromCsvFile = async (
  typeId: string,
  inputPath: string,
  workspace: Workspace,
  fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
): Promise<DataModificationResult> => {
  const type = await getTypeFromState(workspace.config.stateLocation, typeId)
  const typeAdapter = type.elemID.adapter
  if (!workspace.config.services?.includes(typeAdapter)) {
    throw new Error(`The type is from a service (${typeAdapter}) that is not set up for this workspace`)
  }
  const adapters = await login(workspace, fillConfig, [typeAdapter])
  return deleteInstancesOfType(type as ObjectType, inputPath, adapters)
}

export const init = async (workspaceName?: string): Promise<Workspace> => {
  const workspace = await Workspace.init('.', workspaceName)
  const state = new State(workspace.config.stateLocation)
  await state.flush()
  await workspace.flush()
  return workspace
}
