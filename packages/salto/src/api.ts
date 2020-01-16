import wu from 'wu'
import {
  ObjectType, InstanceElement, Element, DataModificationResult,
  ChangeValidator, ElemID, ActionName, Adapter, ElemIdGetter,
} from 'adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto/logging'
import _ from 'lodash'
import { promises } from '@salto/lowerdash'
import {
  deployActions, ItemStatus, DeployError,
} from './core/deploy'
import {
  getInstancesOfType, importInstancesOfType, deleteInstancesOfType,
} from './core/records'
import { initAdapters, getAdaptersLoginConf } from './core/adapters/adapters'
import { addServiceToConfig, loadConfig } from './workspace/config'
import adapterCreators from './core/adapters/creators'
import { getPlan, Plan, PlanItem } from './core/plan'
import { findElement, SearchResult } from './core/search'
import {
  fetchChanges, FetchChange, getDetailedChanges, createElemIdGetter, toChangesWithPath,
  MergeErrorWithElements, FatalFetchMergeError, FetchProgressEvents,
} from './core/fetch'
import { Workspace } from './workspace/workspace'
import Credentials from './workspace/credentials'

export { ItemStatus }

const log = logger(module)

export const updateLoginConfig = async (
  workspace: Workspace,
  newConfigs: Readonly<InstanceElement[]>
): Promise<void> => {
  if (newConfigs.length > 0) {
    await Promise.all(newConfigs
      .map(config => workspace.credentials.set(config.elemID.adapter, config)))
    const newAdapters = newConfigs.map(config => config.elemID.adapter)
    log.debug(`persisted new configs for adapers: ${newAdapters.join(',')}`)
  }
}

const filterElementsByServices = (
  elements: Element[] | readonly Element[],
  services: string[]
): Element[] => elements.filter(e => services.includes(e.elemID.adapter))

const getChangeValidators = (): Record<string, ChangeValidator> =>
  _(adapterCreators)
    .entries()
    .map(([name, creator]) => [name, creator.changeValidator])
    .fromPairs()
    .value()

export const preview = async (
  workspace: Workspace,
  services: string[] = workspace.config.services
): Promise<Plan> => getPlan(
  filterElementsByServices(await workspace.state.getAll(), services),
  filterElementsByServices(workspace.elements, services),
  getChangeValidators()
)

const getAdapters = async (
  credentials: Credentials,
  adapters: string[],
  elemIdGetter?: ElemIdGetter,
): Promise<Record<string, Adapter>> => {
  const adaptersCredentials = _.fromPairs(await Promise.all(adapters.map(
    async adapter => ([adapter, await credentials.get(adapter)])
  )))
  return initAdapters(adaptersCredentials, elemIdGetter)
}

export interface DeployResult {
  success: boolean
  errors: DeployError[]
  changes?: Iterable<FetchChange>
}
export const deploy = async (
  workspace: Workspace,
  shouldDeploy: (plan: Plan) => Promise<boolean>,
  reportProgress: (item: PlanItem, status: ItemStatus, details?: string) => void,
  services: string[] = workspace.config.services,
  force = false
): Promise<DeployResult> => {
  const changedElements: Element[] = []
  const actionPlan = await getPlan(
    filterElementsByServices(await workspace.state.getAll(), services),
    filterElementsByServices(workspace.elements, services),
    getChangeValidators()
  )
  if (force || await shouldDeploy(actionPlan)) {
    const adapters = await getAdapters(workspace.credentials, services)

    const postDeploy = async (action: ActionName, element: Element): Promise<void> =>
      ((action === 'remove')
        ? workspace.state.remove(element.elemID)
        : workspace.state.set(element)
          .then(() => { changedElements.push(element) }))
    let errors: DeployError[]
    try {
      errors = await deployActions(actionPlan, adapters, reportProgress, postDeploy)
    } finally {
      if (workspace.state.flush) {
        await workspace.state.flush()
      }
    }

    const changedElementMap = _.groupBy(changedElements, e => e.elemID.getFullName())
    // Clone the elements because getDetailedChanges can change its input
    const clonedElements = changedElements.map(e => e.clone())
    const relevantWorkspaceElements = workspace.elements
      .filter(e => changedElementMap[e.elemID.getFullName()] !== undefined)

    const changes = wu(await getDetailedChanges(relevantWorkspaceElements, clonedElements))
      .map(change => ({ change, serviceChange: change }))
      .map(toChangesWithPath(name => changedElementMap[name] || []))
      .flatten()
    const errored = errors.length > 0
    return {
      success: !errored,
      changes,
      errors: errored ? errors : [],
    }
  }
  return { success: true, errors: [] }
}

export type fillConfigFunc = (configType: ObjectType) => Promise<InstanceElement>

export type FetchResult = {
  changes: Iterable<FetchChange>
  mergeErrors: MergeErrorWithElements[]
  success: boolean
}
export type fetchFunc = (
  workspace: Workspace,
  services: string[],
  progressEmitter?: EventEmitter<FetchProgressEvents>,
) => Promise<FetchResult>

export const fetch: fetchFunc = async (
  workspace,
  services = workspace.config.services,
  progressEmitter?
) => {
  const overrideState = async (elements: Element[]): Promise<void> => {
    await workspace.state.remove(await workspace.state.list())
    await workspace.state.set(elements)
    if (workspace.state.flush) {
      await workspace.state.flush()
    }
    log.debug(`finish to override state with ${elements.length} elements`)
  }
  log.debug('fetch starting..')
  const filteredStateElements = filterElementsByServices(await workspace.state.getAll(),
    services)

  const adapters = await getAdapters(
    workspace.credentials,
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
    await overrideState(elements)
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

const getTypeFromState = async (ws: Workspace, typeId: string): Promise<Element> => {
  const type = await ws.state.get(ElemID.fromFullName(typeId))
  if (!type) {
    throw new Error(`Couldn't find the type you are looking for: ${typeId}. Have you run salto fetch yet?`)
  }
  return type
}

const getTypeForDataMigration = async (workspace: Workspace, typeId: string): Promise<Element> => {
  const type = await getTypeFromState(workspace, typeId)
  const typeAdapter = type.elemID.adapter
  if (!workspace.config.services?.includes(typeAdapter)) {
    throw new Error(`The type is from a service (${typeAdapter}) that is not set up for this workspace`)
  }
  return type
}

export const exportToCsv = async (
  typeId: string,
  outPath: string,
  workspace: Workspace,
): Promise<DataModificationResult> => {
  const type = await getTypeForDataMigration(workspace, typeId)
  const adapters = await getAdapters(workspace.credentials, [type.elemID.adapter])
  return getInstancesOfType(type as ObjectType, adapters, outPath)
}

export const importFromCsvFile = async (
  typeId: string,
  inputPath: string,
  workspace: Workspace,
): Promise<DataModificationResult> => {
  const type = await getTypeForDataMigration(workspace, typeId)
  const adapters = await getAdapters(workspace.credentials, [type.elemID.adapter])
  return importInstancesOfType(type as ObjectType, inputPath, adapters)
}

export const deleteFromCsvFile = async (
  typeId: string,
  inputPath: string,
  workspace: Workspace,
): Promise<DataModificationResult> => {
  const type = await getTypeForDataMigration(workspace, typeId)
  const adapters = await getAdapters(workspace.credentials, [type.elemID.adapter])
  return deleteInstancesOfType(type as ObjectType, inputPath, adapters)
}

export const init = async (workspaceName?: string): Promise<Workspace> => {
  const workspace = await Workspace.init('.', workspaceName)
  await workspace.flush()
  return workspace
}

export const addAdapter = async (
  workspaceDir: string,
  adapterName: string
): Promise<ObjectType> => {
  const adapterConfig = getAdaptersLoginConf([adapterName])[adapterName]
  if (!adapterConfig) {
    throw new Error('No adapter available for this service')
  }
  await addServiceToConfig(await loadConfig(workspaceDir), adapterName)
  return adapterConfig
}

export type LoginStatus = { configType: ObjectType; isLoggedIn: boolean }
export const getLoginStatuses = async (
  workspace: Workspace,
  adapterNames = workspace.config.services,
): Promise<Record<string, LoginStatus>> => {
  const logins = _.mapValues(getAdaptersLoginConf(adapterNames),
    async (config, adapter) =>
      ({
        configType: config,
        isLoggedIn: !!await workspace.credentials.get(adapter),
      }))

  return promises.object.resolveValues(logins)
}
