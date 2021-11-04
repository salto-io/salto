/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import {
  Adapter, InstanceElement, ObjectType, ElemID, AccountId, getChangeElement, isField,
  Change, DetailedChange, ChangeDataType, isFieldChange, AdapterFailureInstallResult,
  isAdapterSuccessInstallResult, AdapterSuccessInstallResult, AdapterAuthentication,
  SaltoError, Element, isElement, ReferenceExpression, isReferenceExpression,
  isInstanceElement, RemovalChange, AdditionChange,
} from '@salto-io/adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { promises, collections } from '@salto-io/lowerdash'
import { Workspace, ElementSelector, elementSource } from '@salto-io/workspace'
import { walkOnElement, WalkOnFunc, WalkOnFuncArgs, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { EOL } from 'os'
import { deployActions, DeployError, ItemStatus } from './core/deploy'
import {
  adapterCreators, getAdaptersCredentialsTypes, getAdapters, getAdapterDependencyChangers,
  initAdapters, getDefaultAdapterConfig,
} from './core/adapters'
import { getPlan, Plan, PlanItem } from './core/plan'
import {
  FetchChange,
  fetchChanges,
  FetchProgressEvents,
  getDetailedChanges,
  MergeErrorWithElements,
  fetchChangesFromWorkspace,
  getFetchAdapterAndServicesSetup,
} from './core/fetch'
import { defaultDependencyChangers } from './core/plan/plan'
import { createRestoreChanges } from './core/restore'
import { getAdapterChangeGroupIdFunctions } from './core/adapters/custom_group_key'
import { createDiffChanges } from './core/diff'
import { getChangeValidators, getAdaptersConfig } from './core/plan/change_validators'

export { cleanWorkspace } from './core/clean'

const { awu } = collections.asynciterable
const log = logger(module)

const getAdapterFromLoginConfig = (loginConfig: Readonly<InstanceElement>): Adapter =>
  adapterCreators[loginConfig.elemID.adapter]

export const verifyCredentials = async (
  loginConfig: Readonly<InstanceElement>
): Promise<AccountId> => {
  const adapterCreator = getAdapterFromLoginConfig(loginConfig)
  if (adapterCreator) {
    return adapterCreator.validateCredentials(loginConfig)
  }
  throw new Error(`unknown adapter: ${loginConfig.elemID.adapter}`)
}

export const updateCredentials = async (
  workspace: Workspace,
  newConfig: Readonly<InstanceElement>
): Promise<void> => {
  await verifyCredentials(newConfig)
  await workspace.updateServiceCredentials(newConfig.elemID.adapter, newConfig)
  log.debug(`persisted new configs for adapter: ${newConfig.elemID.adapter}`)
}

const shouldElementBeIncluded = (services: ReadonlyArray<string>) =>
  (id: ElemID): boolean => (
    services.includes(id.adapter)
    // Variables belong to all of the services
    || id.adapter === ElemID.VARIABLES_NAMESPACE
  )

export const preview = async (
  workspace: Workspace,
  services = workspace.services(),
): Promise<Plan> => {
  const stateElements = workspace.state()
  const adapters = await getAdapters(
    services,
    await workspace.servicesCredentials(services),
    workspace.serviceConfig.bind(workspace),
    await workspace.elements()
  )
  return getPlan({
    before: stateElements,
    after: await workspace.elements(),
    changeValidators: getChangeValidators(adapters),
    dependencyChangers: defaultDependencyChangers.concat(getAdapterDependencyChangers(adapters)),
    customGroupIdFunctions: getAdapterChangeGroupIdFunctions(adapters),
    topLevelFilters: [shouldElementBeIncluded(services)],
    adapterGetConfig: await getAdaptersConfig(adapters, workspace.serviceConfig.bind(workspace)),
  })
}

export interface DeployResult {
  success: boolean
  errors: DeployError[]
  changes?: Iterable<FetchChange>
}

export const deploy = async (
  workspace: Workspace,
  actionPlan: Plan,
  reportProgress: (item: PlanItem, status: ItemStatus, details?: string) => void,
  services = workspace.services(),
): Promise<DeployResult> => {
  const changedElements = elementSource.createInMemoryElementSource()
  const adapters = await getAdapters(
    services,
    await workspace.servicesCredentials(services),
    workspace.serviceConfig.bind(workspace),
    await workspace.elements()
  )

  const getUpdatedElement = async (change: Change): Promise<ChangeDataType> => {
    const changeElem = getChangeElement(change)
    if (!isField(changeElem)) {
      return changeElem
    }
    const topLevelElem = await workspace.state().get(changeElem.parent.elemID) as ObjectType
    return new ObjectType({
      ...topLevelElem,
      annotationRefsOrTypes: topLevelElem.annotationRefTypes,
      fields: change.action === 'remove'
        ? _.omit(topLevelElem.fields, changeElem.name)
        : _.merge({}, topLevelElem.fields, { [changeElem.name]: changeElem }),
    })
  }

  const postDeployAction = async (appliedChanges: ReadonlyArray<Change>): Promise<void> => {
    await promises.array.series(appliedChanges.map(change => async () => {
      const updatedElement = await getUpdatedElement(change)
      if (change.action === 'remove' && !isFieldChange(change)) {
        await workspace.state().remove(updatedElement.elemID)
      } else {
        await workspace.state().set(updatedElement)
        await changedElements.set(updatedElement)
      }
    }))
  }
  const errors = await deployActions(actionPlan, adapters, reportProgress, postDeployAction)

  // Add workspace elements as an additional context for resolve so that we can resolve
  // variable expressions. Adding only variables is not enough for the case of a variable
  // with the value of a reference.
  const changes = await awu(await getDetailedChanges(
    await workspace.elements(),
    changedElements,
    [id => changedElements.has(id)]
  )).map(change => ({ change, serviceChanges: [change] }))
    .toArray()
  const errored = errors.length > 0
  return {
    success: !errored,
    changes,
    errors: errored ? errors : [],
  }
}

export type FillConfigFunc = (configType: ObjectType) => Promise<InstanceElement>

export type FetchResult = {
  changes: Iterable<FetchChange>
  mergeErrors: MergeErrorWithElements[]
  fetchErrors: SaltoError[]
  success: boolean
  configChanges?: Plan
  updatedConfig : Record<string, InstanceElement[]>
  adapterNameToConfigMessage?: Record<string, string>
}
export type FetchFunc = (
  workspace: Workspace,
  progressEmitter?: EventEmitter<FetchProgressEvents>,
  services?: string[],
  ignoreStateElemIdMapping?: boolean,
) => Promise<FetchResult>

export type FetchFromWorkspaceFuncParams = {
  workspace: Workspace
  otherWorkspace: Workspace
  progressEmitter?: EventEmitter<FetchProgressEvents>
  services?: string[]
  env: string
}
export type FetchFromWorkspaceFunc = (args: FetchFromWorkspaceFuncParams) => Promise<FetchResult>

const updateStateWithFetchResults = async (
  workspace: Workspace,
  mergedElements: Element[],
  unmergedElements: Element[],
  fetchedServices: string[]
): Promise<void> => {
  const fetchElementsFilter = shouldElementBeIncluded(fetchedServices)
  const stateElementsNotCoveredByFetch = await awu(await workspace.state().getAll())
    .filter(element => !fetchElementsFilter(element.elemID)).toArray()
  await workspace.state()
    .override(awu(mergedElements)
      .concat(stateElementsNotCoveredByFetch), fetchedServices)
  await workspace.state().updatePathIndex(unmergedElements,
    (await workspace.state().existingServices()).filter(key => !fetchedServices.includes(key)))
  log.debug(`finish to override state with ${mergedElements.length} elements`)
}

export const fetch: FetchFunc = async (
  workspace,
  progressEmitter?,
  services?,
  ignoreStateElemIdMapping?,
) => {
  log.debug('fetch starting..')
  const fetchServices = services ?? workspace.services()
  const {
    currentConfigs,
    adaptersCreatorConfigs,
  } = await getFetchAdapterAndServicesSetup(
    workspace,
    fetchServices,
    ignoreStateElemIdMapping
  )

  const adapters = initAdapters(adaptersCreatorConfigs)

  if (progressEmitter) {
    progressEmitter.emit('adaptersDidInitialize')
  }
  const {
    changes, elements, mergeErrors, errors, updatedConfig,
    configChanges, adapterNameToConfigMessage, unmergedElements,
  } = await fetchChanges(
    adapters,
    await workspace.elements(),
    workspace.state(),
    currentConfigs,
    progressEmitter,
  )
  log.debug(`${elements.length} elements were fetched [mergedErrors=${mergeErrors.length}]`)
  await updateStateWithFetchResults(workspace, elements, unmergedElements, fetchServices)
  return {
    changes,
    fetchErrors: errors,
    mergeErrors,
    success: true,
    configChanges,
    updatedConfig,
    adapterNameToConfigMessage,
  }
}

export const fetchFromWorkspace: FetchFromWorkspaceFunc = async ({
  workspace,
  otherWorkspace,
  progressEmitter,
  services,
  env,
}: FetchFromWorkspaceFuncParams) => {
  log.debug('fetch starting from workspace..')
  const fetchServices = services ?? workspace.services()

  const { currentConfigs } = await getFetchAdapterAndServicesSetup(
    workspace,
    fetchServices,
  )

  const {
    changes, elements, mergeErrors, errors,
    configChanges, adapterNameToConfigMessage, unmergedElements,
  } = await fetchChangesFromWorkspace(
    otherWorkspace,
    fetchServices,
    await workspace.elements(),
    workspace.state(),
    currentConfigs,
    env,
    progressEmitter,
  )

  log.debug(`${elements.length} elements were fetched from a remote workspace [mergedErrors=${mergeErrors.length}]`)
  await updateStateWithFetchResults(workspace, elements, unmergedElements, fetchServices)
  return {
    changes,
    fetchErrors: errors,
    mergeErrors,
    success: true,
    updatedConfig: {},
    configChanges,
    adapterNameToConfigMessage,
    progressEmitter,
  }
}

export type LocalChange = Omit<FetchChange, 'pendingChanges'>

export const restore = async (
  workspace: Workspace,
  servicesFilters?: string[],
  elementSelectors: ElementSelector[] = [],
): Promise<LocalChange[]> => {
  log.debug('restore starting..')
  const fetchServices = servicesFilters ?? workspace.services()
  const changes = await createRestoreChanges(
    await workspace.elements(),
    workspace.state(),
    await workspace.state().getPathIndex(),
    elementSelectors,
    fetchServices
  )
  return changes.map(change => ({ change, serviceChanges: [change] }))
}

export const diff = async (
  workspace: Workspace,
  fromEnv: string,
  toEnv: string,
  includeHidden = false,
  useState = false,
  servicesFilters?: string[],
  elementSelectors: ElementSelector[] = [],
): Promise<LocalChange[]> => {
  const diffServices = servicesFilters ?? workspace.services()
  const fromElements = useState
    ? workspace.state(fromEnv)
    : await workspace.elements(includeHidden, fromEnv)
  const toElements = useState
    ? workspace.state(toEnv)
    : await workspace.elements(includeHidden, toEnv)

  const diffChanges = await createDiffChanges(
    toElements,
    fromElements,
    elementSelectors,
    [shouldElementBeIncluded(diffServices)]
  )

  return diffChanges.map(change => ({ change, serviceChanges: [change] }))
}

class AdapterInstallError extends Error {
  constructor(name: string, failureInstallResults: AdapterFailureInstallResult) {
    const header = `Failed to add the ${name} adapter.`
    super([header, ...failureInstallResults.errors].join(EOL))
  }
}

const getAdapterCreator = (adapterName: string): Adapter => {
  const adapter = adapterCreators[adapterName]
  if (adapter) {
    return adapter
  }
  throw new Error(`No adapter available for ${adapterName}`)
}

export const installAdapter = async (adapterName: string):
  Promise<AdapterSuccessInstallResult|undefined> => {
  const adapter = getAdapterCreator(adapterName)
  if (adapter.install === undefined) {
    return undefined
  }
  const installResult = await adapter.install()
  if (isAdapterSuccessInstallResult(installResult)) {
    return installResult
  }
  throw new AdapterInstallError(adapterName, installResult)
}

export const addAdapter = async (
  workspace: Workspace,
  adapterName: string,
): Promise<AdapterAuthentication> => {
  const adapter = getAdapterCreator(adapterName)
  await workspace.addService(adapterName)

  if (_.isUndefined((await workspace.serviceConfig(adapterName)))) {
    const defaultConfig = await getDefaultAdapterConfig(adapterName)
    if (!_.isUndefined(defaultConfig)) {
      await workspace.updateServiceConfig(adapterName, defaultConfig)
    }
  }
  return adapter.authenticationMethods
}

export type LoginStatus = { configTypeOptions: AdapterAuthentication; isLoggedIn: boolean }
export const getLoginStatuses = async (
  workspace: Workspace,
  adapterNames = workspace.services(),
): Promise<Record<string, LoginStatus>> => {
  const creds = await workspace.servicesCredentials(adapterNames)
  const logins = _.mapValues(getAdaptersCredentialsTypes(adapterNames),
    async (configTypeOptions, adapter) =>
      ({
        configTypeOptions,
        isLoggedIn: !!creds[adapter],
      }))

  return promises.object.resolveValues(logins)
}

export const getSupportedServiceAdapterNames = (): string[] => Object.keys(adapterCreators)

export class RenameElementIdError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, RenameElementIdError.prototype)
  }
}

const renameElementIdChecks = (
  sourceElemId: ElemID,
  targetElemId: ElemID
): void => {
  if (sourceElemId.getFullName() === targetElemId.getFullName()) {
    throw new RenameElementIdError(`Source and target element ids are the same: ${sourceElemId.getFullName()}`)
  }

  const sourceElemIdFullNameParts = sourceElemId.getFullNameParts()
  const targetElemIdFullNameParts = targetElemId.getFullNameParts()
  if (sourceElemIdFullNameParts.length !== ElemID.NUM_ELEM_ID_NON_NAME_PARTS + 1
    || sourceElemIdFullNameParts.length !== targetElemIdFullNameParts.length
    || sourceElemId.adapter !== targetElemId.adapter
    || sourceElemId.typeName !== targetElemId.typeName
    || sourceElemId.idType !== targetElemId.idType) {
    const renameMessage = `(${sourceElemIdFullNameParts.slice(0, ElemID.NUM_ELEM_ID_NON_NAME_PARTS + 1).join(ElemID.NAMESPACE_SEPARATOR)})`
    throw new RenameElementIdError(`Currently supporting renaming the instance name only ${renameMessage}`)
  }
}

const renameElementChecks = async (
  elementsSource: elementSource.ElementsSource,
  sourceElemId: ElemID,
  targetElemId: ElemID
): Promise<void> => {
  const sourceElement = await elementsSource.get(sourceElemId)
  if (sourceElement === undefined || !isElement(sourceElement)) {
    throw new RenameElementIdError(`Did not find any matches for element ${sourceElemId.getFullName()}`)
  }

  if (!isInstanceElement(sourceElement)) {
    throw new RenameElementIdError(`Currently supporting InstanceElement only (${sourceElemId.getFullName()} is of type '${sourceElemId.idType}')`)
  }

  if (await elementsSource.get(targetElemId) !== undefined) {
    throw new RenameElementIdError(`Element ${targetElemId.getFullName()} already exists`)
  }
}

export type RenameChange = {
  remove: RemovalChange<Element> & { id: ElemID }
  add: AdditionChange<Element> & { id: ElemID }
}

export const getRenameElementChanges = async (
  elementsSource: elementSource.ElementsSource,
  sourceElemId: ElemID,
  targetElemId: ElemID
): Promise<RenameChange> => {
  renameElementIdChecks(sourceElemId, targetElemId)
  await renameElementChecks(elementsSource, sourceElemId, targetElemId)

  const source = await elementsSource.get(sourceElemId)
  const target = new InstanceElement(
    targetElemId.getFullNameParts()[ElemID.NUM_ELEM_ID_NON_NAME_PARTS],
    source.refType,
    source.value,
    source.path,
    source.annotations
  )

  return {
    remove: {
      id: sourceElemId,
      action: 'remove',
      data: { before: source },
    },
    add: {
      id: targetElemId,
      action: 'add',
      data: { after: target },
    },
  }
}

export const getRenameReferencesChanges = async (
  elementsSource: elementSource.ElementsSource,
  sourceElemId: ElemID,
  targetElemId: ElemID
): Promise<DetailedChange[]> => {
  renameElementIdChecks(sourceElemId, targetElemId)

  const sourceElemIdFullNameParts = sourceElemId.getFullNameParts()
  const getReferences = (element: Element): WalkOnFuncArgs[] => {
    const references: WalkOnFuncArgs[] = []
    const func: WalkOnFunc = ({ value, path }) => {
      if (isReferenceExpression(value) && _.isEqual(sourceElemIdFullNameParts,
        value.elemID.getFullNameParts().slice(0, sourceElemIdFullNameParts.length))) {
        references.push({ value, path })
        return WALK_NEXT_STEP.SKIP
      }
      return WALK_NEXT_STEP.RECURSE
    }
    walkOnElement({ element, func })
    return references
  }

  const references = await awu(await elementsSource.getAll())
    .flatMap(elem => getReferences(elem)).toArray()

  return references.map((r): DetailedChange => {
    const targetReference = new ReferenceExpression(
      new ElemID(
        r.value.elemID.adapter,
        r.value.elemID.typeName,
        r.value.elemID.idType,
        targetElemId.getFullNameParts()[ElemID.NUM_ELEM_ID_NON_NAME_PARTS],
        ...r.value.elemID.getFullNameParts()
          .slice(ElemID.NUM_ELEM_ID_NON_NAME_PARTS + 1)
      ),
      r.value.resValue,
      r.value.topLevelParent
    )
    return {
      id: r.path,
      action: 'modify',
      data: {
        before: r.value,
        after: targetReference,
      },
    }
  })
}

export const getUpdatedTopLevelElements = async (
  elementsSource: elementSource.ElementsSource,
  changes: DetailedChange[]
): Promise<Element[]> => {
  const changesByTopLevelElemId = _.groupBy(
    changes, r => r.id.createTopLevelParentID().parent.getFullName()
  )
  return Promise.all(
    Object.entries(changesByTopLevelElemId).map(async ([e, refs]) => {
      const topLevelElem = await elementsSource.get(ElemID.fromFullName(e)) as InstanceElement
      return new InstanceElement(
        topLevelElem.elemID.getFullNameParts()[ElemID.NUM_ELEM_ID_NON_NAME_PARTS],
        topLevelElem.refType,
        _.merge({}, topLevelElem.value, ...refs
          .map(r => ({ [r.id.getFullNameParts().slice(-1)[0]]: getChangeElement(r) }))),
        topLevelElem.path,
        topLevelElem.annotations
      )
    })
  )
}
