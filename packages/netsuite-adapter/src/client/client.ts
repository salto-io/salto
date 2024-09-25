/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  Change,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  CredentialError,
  isAdditionOrModificationChange,
  ElemID,
  SaltoError,
  AccountInfo,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { decorators, collections, values } from '@salto-io/lowerdash'
import { soap } from '@salto-io/adapter-components'
import _ from 'lodash'
import { captureServiceIdInfo } from '../service_id_info'
import { NetsuiteFetchQueries, NetsuiteQuery } from '../config/query'
import { Credentials, isSuiteAppCredentials, toUrlAccountId } from './credentials'
import SdfClient from './sdf_client'
import SuiteAppClient from './suiteapp_client/suiteapp_client'
import { deployFileCabinetInstances, importFileCabinet } from './suiteapp_client/suiteapp_file_cabinet'
import {
  ConfigRecord,
  EnvType,
  HasElemIDFunc,
  QueryRecordSchema,
  QueryRecordResponse,
  SavedSearchQuery,
  SystemInformation,
  SuiteAppType,
  SuiteQLQueryArgs,
} from './suiteapp_client/types'
import { CustomRecordResponse, SoapDeployResult, RecordResponse } from './suiteapp_client/soap_client/types'
import {
  DeployableChange,
  FeaturesMap,
  getChangeNodeId,
  GetCustomObjectsResult,
  getDeployableChanges,
  getNodeId,
  getOrTransformCustomRecordTypeToInstance,
  ImportFileCabinetResult,
  InvalidSuiteAppCredentialsError,
  ManifestDependencies,
  SDFObjectNode,
} from './types'
import { toCustomizationInfo } from '../transformer'
import {
  isFileCabinetDeployGroup,
  isSdfCreateOrUpdateGroupId,
  isSdfDeleteGroupId,
  isSuiteAppCreateRecordsGroupId,
  isSuiteAppDeleteRecordsGroupId,
  isSuiteAppUpdateRecordsGroupId,
  SUITEAPP_UPDATING_CONFIG_GROUP_ID,
} from '../group_changes'
import { DeployResult, getElementValueOrAnnotations, getServiceId } from '../types'
import { ADDITIONAL_DEPENDENCIES, APPLICATION_ID, CONFIG_FEATURES, CUSTOM_RECORD_TYPE, ROLE } from '../constants'
import { toConfigDeployResult, toSetConfigTypes } from '../suiteapp_config_elements'
import {
  FeaturesDeployError,
  MissingManifestFeaturesError,
  getChangesElemIdsToRemove,
  toFeaturesDeployPartialSuccessResult,
} from './errors'
import { Graph, GraphNode } from './graph_utils'
import { AdditionalDependencies } from '../config/types'
import { SuiteAppBundleType } from '../types/bundle_type'
import {
  getChangeTypeAndAddedObjects,
  getDeployResultFromSuiteAppResult,
  isRequiredFeature,
  removeRequiredFeatureSuffix,
  toDependencyError,
  toElementError,
  toError,
} from './utils'

const { awu } = collections.asynciterable
const { lookupValue } = values
const log = logger(module)
const { DefaultMap } = collections.map

type DependencyInfo = {
  dependencyMap: Map<string, Set<string>>
  dependencyGraph: Graph<SDFObjectNode>
}

const isRoleToCustomRecordType = (startNode: GraphNode<SDFObjectNode>, endNode: GraphNode<SDFObjectNode>): boolean =>
  startNode.value.customizationInfo.typeName === ROLE && endNode.value.customizationInfo.typeName === CUSTOM_RECORD_TYPE

const isLegalEdge = (
  startNode: GraphNode<SDFObjectNode>,
  endNode: GraphNode<SDFObjectNode>,
  serviceId: string,
): boolean =>
  startNode.id !== endNode.id &&
  (startNode.value.changeType === 'addition' ||
    startNode.value.addedObjects.has(serviceId) ||
    isRoleToCustomRecordType(startNode, endNode))

const determineAccountType = (accountId: string, envType: EnvType): EnvType | 'TEST' => {
  if (accountId.toUpperCase().startsWith('TSTDRV') || accountId.toUpperCase().startsWith('TD')) {
    log.debug(
      `using 'TEST' account type although ${envType} envType is returned from NS since we assume ${accountId} indicates a testing account`,
    )
    return 'TEST'
  }
  return envType
}

const logDecorator = decorators.wrapMethodWith(async ({ call, name }: decorators.OriginalCall): Promise<unknown> => {
  const desc = `client.${name}`
  try {
    // eslint-disable-next-line @typescript-eslint/return-await
    return await log.timeDebug(call, desc)
  } catch (e) {
    log.error('failed to run Netsuite client command on: %o', e)
    throw e
  }
})

export default class NetsuiteClient {
  private sdfClient: SdfClient
  private suiteAppClient?: SuiteAppClient
  public readonly url: URL

  constructor(sdfClient: SdfClient, suiteAppClient?: SuiteAppClient) {
    this.sdfClient = sdfClient
    this.suiteAppClient = suiteAppClient
    if (this.suiteAppClient === undefined) {
      log.debug('Salto SuiteApp not configured')
    } else {
      log.debug('Salto SuiteApp configured')
    }

    this.url = new URL(`https://${toUrlAccountId(this.sdfClient.getCredentials().accountId)}.app.netsuite.com`)
  }

  private static async suiteAppValidateCredentials(credentials: Credentials): Promise<SystemInformation | undefined> {
    if (isSuiteAppCredentials(credentials)) {
      try {
        return await SuiteAppClient.validateCredentials(credentials)
      } catch (e) {
        throw new CredentialError(`Salto SuiteApp Authentication failed. ${toError(e).message}`)
      }
    } else {
      log.debug('SuiteApp is not configured - skipping SuiteApp credentials validation')
      return undefined
    }
  }

  private static async sdfValidateCredentials(credentials: Credentials): Promise<AccountInfo> {
    try {
      return await SdfClient.validateCredentials(credentials)
    } catch (e) {
      throw new CredentialError(`SDF Authentication failed. ${toError(e).message}`)
    }
  }

  @logDecorator
  static async validateCredentials(credentials: Credentials): Promise<AccountInfo> {
    const systemInformation = await NetsuiteClient.suiteAppValidateCredentials(credentials)
    const { accountId } = await NetsuiteClient.sdfValidateCredentials(credentials)
    if (systemInformation?.envType === undefined) {
      return { accountId }
    }
    const accountType = determineAccountType(accountId, systemInformation.envType)
    return {
      accountId,
      isProduction: accountType === EnvType.PRODUCTION,
      accountType,
    }
  }

  @logDecorator
  async getConfigRecords(): Promise<ConfigRecord[]> {
    return this.suiteAppClient?.getConfigRecords() ?? []
  }

  @logDecorator
  async getInstalledBundles(): Promise<SuiteAppBundleType[]> {
    return this.suiteAppClient?.getInstalledBundles() ?? []
  }

  async getInstalledSuiteApps(): Promise<SuiteAppType[]> {
    return this.suiteAppClient?.getInstalledSuiteApps() ?? []
  }

  @logDecorator
  async deployConfigChanges(instancesChanges: Change<InstanceElement>[]): Promise<DeployResult> {
    if (this.suiteAppClient === undefined) {
      const message = `Salto SuiteApp is not configured and therefore changes group "${SUITEAPP_UPDATING_CONFIG_GROUP_ID}" cannot be deployed`
      return {
        errors: [
          {
            message,
            detailedMessage: message,
            severity: 'Error',
          },
        ],
        appliedChanges: [],
      }
    }
    const modificationChanges = instancesChanges.filter(isModificationChange)
    return toConfigDeployResult(
      modificationChanges,
      await this.suiteAppClient.setConfigRecordsValues(toSetConfigTypes(modificationChanges)),
    )
  }

  @logDecorator
  async getCustomObjects(typeNames: string[], queries: NetsuiteFetchQueries): Promise<GetCustomObjectsResult> {
    return this.sdfClient.getCustomObjects(typeNames, queries)
  }

  @logDecorator
  async importFileCabinetContent(
    query: NetsuiteQuery,
    maxFileCabinetSizeInGB: number,
    extensionsToExclude: string[],
    forceFileCabinetExclude: boolean,
  ): Promise<ImportFileCabinetResult> {
    if (this.suiteAppClient !== undefined) {
      return importFileCabinet(
        this.suiteAppClient,
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
        forceFileCabinetExclude,
      )
    }

    return this.sdfClient.importFileCabinetContent(query, maxFileCabinetSizeInGB)
  }

  private static async getSDFObjectGraphNodes(changes: DeployableChange[]): Promise<GraphNode<SDFObjectNode>[]> {
    return awu(changes)
      .filter(isAdditionOrModificationChange)
      .map(
        async change =>
          new GraphNode(getChangeNodeId(change), {
            change,
            serviceid: getServiceId(getChangeData(change)),
            customizationInfo: await toCustomizationInfo(
              getOrTransformCustomRecordTypeToInstance(getChangeData(change)),
            ),
            ...getChangeTypeAndAddedObjects(change),
          }),
      )
      .toArray()
  }

  public static async createDependencyMapAndGraph(changes: DeployableChange[]): Promise<DependencyInfo> {
    const dependencyMap = new DefaultMap<string, Set<string>>(() => new Set())
    const dependencyGraph = new Graph(await NetsuiteClient.getSDFObjectGraphNodes(changes))
    dependencyGraph.nodes.forEach(node => {
      const currSet = dependencyMap.get(node.id)
      lookupValue(node.value.customizationInfo.values, val => {
        if (!_.isString(val)) {
          return
        }
        const serviceIdInfoArray = captureServiceIdInfo(val)
        serviceIdInfoArray.forEach(serviceIdInfo => {
          currSet.add(serviceIdInfo.serviceId)
          const startNode = dependencyGraph.findNodeByField(
            'serviceid',
            serviceIdInfo.serviceIdType === 'path' ? serviceIdInfo.serviceId : serviceIdInfo.serviceId.split('.')[0],
          )
          if (startNode && isLegalEdge(startNode, node, serviceIdInfo.serviceId)) {
            startNode.addEdge(node)
          }
        })
      })
      delete node.value.customizationInfo.values[ADDITIONAL_DEPENDENCIES]
    })
    return { dependencyMap, dependencyGraph }
  }

  private static getDependenciesFromGraph(
    nodes: GraphNode<SDFObjectNode>[],
    dependencyGraph: Graph<SDFObjectNode>,
  ): { id: string; elemId: ElemID; dependOn: ElemID[] }[] {
    const originalNodeIds = new Set(nodes.map(node => node.id))

    const dependsOnMap = new DefaultMap<string, ElemID[]>(() => [])
    const nodeIdToElemId: Record<string, ElemID> = {}
    nodes.forEach(node => {
      const nodeElemId = getChangeData(node.value.change).elemID
      dependencyGraph
        .getNodeDependencies(node)
        .filter(dependencyNode => !originalNodeIds.has(dependencyNode.id))
        .forEach(dependencyNode => {
          nodeIdToElemId[dependencyNode.id] = getChangeData(dependencyNode.value.change).elemID
          dependsOnMap.get(dependencyNode.id).push(nodeElemId)
        })
    })

    return [...dependsOnMap.entries()].map(([id, dependOn]) => ({ id, elemId: nodeIdToElemId[id], dependOn }))
  }

  private static toManifestDependencies(
    additionalDependencies: AdditionalDependencies,
    featuresMap: FeaturesMap,
  ): ManifestDependencies {
    const {
      optional = [],
      required = [],
      excluded = [],
    } = _.groupBy(
      Object.entries(featuresMap).map(([name, { status }]) => ({ name, status })),
      feature => feature.status,
    )
    return {
      optionalFeatures: optional.map(feature => feature.name),
      requiredFeatures: required.map(feature => feature.name),
      excludedFeatures: excluded.map(feature => feature.name),
      includedObjects: additionalDependencies.include.objects,
      excludedObjects: additionalDependencies.exclude.objects,
      includedFiles: additionalDependencies.include.files,
      excludedFiles: additionalDependencies.exclude.files,
    }
  }

  private static createFeaturesMap(additionalDependencies: AdditionalDependencies): FeaturesMap {
    const [requiredFeatures, optionalFeatures] = _.partition(additionalDependencies.include.features, isRequiredFeature)
    return Object.fromEntries([
      ...optionalFeatures.map(featureName => [featureName, { status: 'optional', canBeRequired: true }]),
      ...requiredFeatures.map(removeRequiredFeatureSuffix).map(featureName => [featureName, { status: 'required' }]),
      ...additionalDependencies.exclude.features.map(featureName => [featureName, { status: 'excluded' }]),
    ])
  }

  private static updateFeaturesMap(
    featuresMap: FeaturesMap,
    missingFeaturesError: MissingManifestFeaturesError,
  ): { failedToUpdate: boolean; error?: SaltoError } {
    log.debug(
      'going to update the features map with the following missing features: %o',
      missingFeaturesError.missingFeatures,
    )

    const missingExcludedFeatures = new Set<string>()
    let failedToUpdate = false
    missingFeaturesError.missingFeatures.forEach(featureName => {
      const feature = featuresMap[featureName]
      if (feature === undefined) {
        featuresMap[featureName] = { status: 'optional', canBeRequired: true }
      } else if (feature.status === 'excluded') {
        featuresMap[featureName] = { status: 'optional', canBeRequired: false }
      } else if (feature.status === 'required') {
        log.error(
          'The %s feature is already required, but sdf returned an error: %o',
          featureName,
          missingFeaturesError,
        )
        failedToUpdate = true
      } else if (feature.status === 'optional' && feature.canBeRequired) {
        featuresMap[featureName] = { status: 'required' }
      } else if (feature.status === 'optional' && !feature.canBeRequired) {
        log.warn('The %s feature is required but it is excluded', featureName)
        missingExcludedFeatures.add(featureName)
      }
    })
    if (missingExcludedFeatures.size > 0) {
      const message = `The following features are required but they are excluded: ${Array.from(missingExcludedFeatures).join(', ')}.`
      return {
        failedToUpdate: true,
        error: {
          message,
          detailedMessage: message,
          severity: 'Error',
        },
      }
    }
    if (!failedToUpdate) {
      log.debug('features map was updated: %o', featuresMap)
    }
    return { failedToUpdate }
  }

  private async sdfDeploy({
    changes,
    additionalDependencies,
    validateOnly = false,
  }: {
    changes: ReadonlyArray<Change>
    additionalDependencies: AdditionalDependencies
    validateOnly?: boolean
  }): Promise<DeployResult> {
    const changesByTopLevel = _.groupBy(changes, change =>
      getChangeData(change).elemID.createTopLevelParentID().parent.getFullName(),
    )

    const deployableChanges = getDeployableChanges(changes)
    const someElementToDeploy = getChangeData(deployableChanges[0])
    const suiteAppId = getElementValueOrAnnotations(someElementToDeploy)[APPLICATION_ID]

    const errors: DeployResult['errors'] = []
    const { dependencyMap, dependencyGraph } = await NetsuiteClient.createDependencyMapAndGraph(deployableChanges)
    const featuresMap = NetsuiteClient.createFeaturesMap(additionalDependencies)

    while (dependencyGraph.nodes.size > 0) {
      const changesToDeploy = Array.from(dependencyGraph.nodes.values()).map(node => node.value.change)
      const changesToApply = changesToDeploy.flatMap(
        change => changesByTopLevel[getChangeData(change).elemID.getFullName()],
      )
      const manifestDependencies = NetsuiteClient.toManifestDependencies(additionalDependencies, featuresMap)

      try {
        log.debug('deploying %d changes', dependencyGraph.nodes.size)
        // eslint-disable-next-line no-await-in-loop
        await log.timeDebug(
          () => this.sdfClient.deploy(suiteAppId, { manifestDependencies, validateOnly }, dependencyGraph),
          'sdfDeploy',
        )
        return { errors, appliedChanges: changesToApply }
      } catch (error) {
        if (error instanceof FeaturesDeployError) {
          const { message } = error
          const featuresError = changesToDeploy
            .filter(isInstanceChange)
            .map(getChangeData)
            .filter(inst => inst.elemID.typeName === CONFIG_FEATURES)
            .map(({ elemID }) => toElementError({ elemID, message, detailedMessage: message }))

          return {
            errors: errors.concat(featuresError),
            appliedChanges: toFeaturesDeployPartialSuccessResult(error, changesToApply),
            failedFeaturesIds: error.ids,
          }
        }
        if (error instanceof MissingManifestFeaturesError) {
          const res = NetsuiteClient.updateFeaturesMap(featuresMap, error)
          if (res.failedToUpdate) {
            return {
              errors: errors
                .concat({ message: error.message, detailedMessage: error.message, severity: 'Error' })
                .concat(res.error ?? []),
              appliedChanges: [],
            }
          }
          // eslint-disable-next-line no-continue
          continue
        }
        const elemIdsWithError = getChangesElemIdsToRemove(error, dependencyMap, changesToDeploy)
        const elementErrors = elemIdsWithError.flatMap(({ message, elemID }) =>
          changesByTopLevel[elemID.getFullName()]
            .map(getChangeData)
            .map(elem => toElementError({ elemID: elem.elemID, message, detailedMessage: message })),
        )
        errors.push(...elementErrors)

        const nodesWithError = elemIdsWithError
          .map(({ elemID }) => dependencyGraph.getNode(getNodeId(elemID)))
          .filter(values.isDefined)

        const dependentNodes = NetsuiteClient.getDependenciesFromGraph(nodesWithError, dependencyGraph)
        if (!validateOnly) {
          const dependencyErrors = dependentNodes
            .flatMap(({ elemId, dependOn }) =>
              changesByTopLevel[elemId.getFullName()].map(change => ({
                elemId: getChangeData(change).elemID,
                dependOn,
              })),
            )
            .map(toDependencyError)
          errors.push(...dependencyErrors)
        }

        const numOfAttemptedNodesToDeploy = dependencyGraph.nodes.size
        nodesWithError.forEach(node => dependencyGraph.removeNode(node.id))
        dependentNodes.forEach(node => dependencyGraph.removeNode(node.id))

        const numOfRemovedNodes = numOfAttemptedNodesToDeploy - dependencyGraph.nodes.size
        if (numOfRemovedNodes === 0) {
          const { message } = toError(error)
          log.error('no changes were removed from error: %o', error)
          errors.push({ message, detailedMessage: message, severity: 'Error' })
          return { errors, appliedChanges: [] }
        }
        log.debug(
          'removed %d changes (%o) from error: %o',
          numOfRemovedNodes,
          changesToDeploy.map(getChangeNodeId).filter(nodeId => dependencyGraph.getNode(nodeId) === undefined),
          error,
        )
      }
    }
    return { errors, appliedChanges: [] }
  }

  @logDecorator
  public async validate(
    changes: Change[],
    groupID: string,
    additionalSdfDependencies: AdditionalDependencies,
  ): Promise<DeployResult['errors']> {
    if (isSdfCreateOrUpdateGroupId(groupID)) {
      return (
        await this.sdfDeploy({
          changes,
          additionalDependencies: additionalSdfDependencies,
          validateOnly: true,
        })
      ).errors
    }
    return []
  }

  @logDecorator
  public async deploy(
    changes: Change[],
    groupID: string,
    additionalSdfDependencies: AdditionalDependencies,
    hasElemID: HasElemIDFunc,
  ): Promise<DeployResult> {
    if (isSdfCreateOrUpdateGroupId(groupID)) {
      return this.sdfDeploy({
        changes,
        additionalDependencies: additionalSdfDependencies,
      })
    }

    const instancesChanges = changes.filter(isInstanceChange)
    if (isFileCabinetDeployGroup(groupID)) {
      const message = `Salto SuiteApp is not configured and therefore changes group "${groupID}" cannot be deployed`
      return this.suiteAppClient !== undefined
        ? deployFileCabinetInstances(this.suiteAppClient, instancesChanges, groupID)
        : {
            errors: [
              {
                message,
                detailedMessage: message,
                severity: 'Error',
              },
            ],
            appliedChanges: [],
          }
    }

    if (groupID === SUITEAPP_UPDATING_CONFIG_GROUP_ID) {
      return this.deployConfigChanges(instancesChanges)
    }

    return this.deployRecords(changes, groupID, hasElemID)
  }

  private async deployRecords(changes: Change[], groupID: string, hasElemID: HasElemIDFunc): Promise<DeployResult> {
    const relevantChanges = getDeployableChanges(changes)
    const relevantInstances = relevantChanges.map(getChangeData).map(getOrTransformCustomRecordTypeToInstance)

    try {
      const deployResults = await this.runDeployRecordsOperation(relevantInstances, groupID, hasElemID)
      return getDeployResultFromSuiteAppResult(relevantChanges, deployResults)
    } catch (error) {
      const { message } = toError(error)
      return {
        errors: [{ message, detailedMessage: message, severity: 'Error' }],
        appliedChanges: [],
      }
    }
  }

  private async runDeployRecordsOperation(
    elements: InstanceElement[],
    groupID: string,
    hasElemID: HasElemIDFunc,
  ): Promise<SoapDeployResult[]> {
    if (this.suiteAppClient === undefined) {
      throw new Error(`Salto SuiteApp is not configured and therefore changes group "${groupID}" cannot be deployed`)
    }

    if (isSuiteAppUpdateRecordsGroupId(groupID)) {
      return this.suiteAppClient.updateInstances(elements, hasElemID)
    }

    if (isSuiteAppCreateRecordsGroupId(groupID)) {
      return this.suiteAppClient.addInstances(elements, hasElemID)
    }

    if (isSuiteAppDeleteRecordsGroupId(groupID)) {
      return this.suiteAppClient.deleteInstances(elements)
    }

    if (isSdfDeleteGroupId(groupID)) {
      return this.suiteAppClient.deleteSdfInstances(elements)
    }

    throw new Error(`Cannot deploy group ID: ${groupID}`)
  }

  public async runSuiteQL(args: SuiteQLQueryArgs): Promise<Record<string, unknown>[] | undefined> {
    return this.suiteAppClient?.runSuiteQL(args)
  }

  public async runSavedSearchQuery(
    query: SavedSearchQuery,
    limit?: number,
  ): Promise<Record<string, unknown>[] | undefined> {
    return this.suiteAppClient?.runSavedSearchQuery(query, limit)
  }

  public async runRecordsQuery(ids: string[], schema: QueryRecordSchema): Promise<QueryRecordResponse[] | undefined> {
    return this.suiteAppClient?.runRecordsQuery(ids, schema)
  }

  public async getSystemInformation(): Promise<SystemInformation | undefined> {
    try {
      return await this.suiteAppClient?.getSystemInformation()
    } catch (error) {
      if (error instanceof InvalidSuiteAppCredentialsError) {
        throw error
      }
      log.error('The following error was thrown in getSystemInformation', { error })
      return undefined
    }
  }

  public isSuiteAppConfigured(): boolean {
    return this.suiteAppClient !== undefined
  }

  public async getNetsuiteWsdl(): Promise<soap.WSDL | undefined> {
    return this.suiteAppClient?.getNetsuiteWsdl()
  }

  @logDecorator
  public async getAllRecords(types: string[]): Promise<RecordResponse> {
    if (this.suiteAppClient === undefined) {
      throw new Error('Cannot call getAllRecords when SuiteApp is not installed')
    }
    return this.suiteAppClient.getAllRecords(types)
  }

  @logDecorator
  public async getCustomRecords(customRecordTypes: string[]): Promise<CustomRecordResponse> {
    if (this.suiteAppClient === undefined) {
      throw new Error('Cannot call getCustomRecords when SuiteApp is not installed')
    }
    return this.suiteAppClient.getCustomRecords(customRecordTypes)
  }

  public async getSelectValue(
    type: string,
    field: string,
    filterBy: { field: string; internalId: string }[] = [],
  ): Promise<Record<string, string[]>> {
    if (this.suiteAppClient === undefined) {
      throw new Error('Cannot call getSelectValue when SuiteApp is not installed')
    }
    return this.suiteAppClient.getSelectValue(type, field, filterBy)
  }
}
