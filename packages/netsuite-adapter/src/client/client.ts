/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { AccountId, Change, getChangeData, InstanceElement, isInstanceChange, isModificationChange, CredentialError, isField, ChangeDataType, isAdditionChange, isAdditionOrModificationChange, ObjectType, isObjectTypeChange, isFieldChange, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { decorators, collections, values } from '@salto-io/lowerdash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { captureServiceIdInfo } from '../service_id_info'
import { NetsuiteQuery } from '../query'
import { Credentials, isSuiteAppCredentials, toUrlAccountId } from './credentials'
import SdfClient from './sdf_client'
import SuiteAppClient from './suiteapp_client/suiteapp_client'
import { createSuiteAppFileCabinetOperations, SuiteAppFileCabinetOperations, DeployType } from '../suiteapp_file_cabinet'
import { ConfigRecord, SavedSearchQuery, SystemInformation } from './suiteapp_client/types'
import { CustomRecordTypeRecords, RecordValue } from './suiteapp_client/soap_client/types'
import { CustomizationInfo, FeaturesMap, GetCustomObjectsResult, getOrTransformCustomRecordTypeToInstance, ImportFileCabinetResult, ManifestDependencies } from './types'
import { toCustomizationInfo } from '../transformer'
import { isSdfCreateOrUpdateGroupId, isSdfDeleteGroupId, isSuiteAppCreateRecordsGroupId, isSuiteAppDeleteRecordsGroupId, isSuiteAppUpdateRecordsGroupId, SUITEAPP_CREATING_FILES_GROUP_ID, SUITEAPP_DELETING_FILES_GROUP_ID, SUITEAPP_FILE_CABINET_GROUPS, SUITEAPP_UPDATING_CONFIG_GROUP_ID, SUITEAPP_UPDATING_FILES_GROUP_ID } from '../group_changes'
import { DeployResult, getElementValueOrAnnotations, isFileCabinetInstance } from '../types'
import { APPLICATION_ID, PATH, SCRIPT_ID } from '../constants'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'
import { toConfigDeployResult, toSetConfigTypes } from '../suiteapp_config_elements'
import { FeaturesDeployError, MissingManifestFeaturesError, getChangesElemIdsToRemove, toFeaturesDeployPartialSuccessResult } from './errors'
import { Graph, GraphNode, SDFObjectNode } from './graph_utils'
import { AdditionalDependencies, isRequiredFeature, removeRequiredFeatureSuffix } from '../config'

const { isDefined } = values
const { awu } = collections.asynciterable
const { lookupValue } = values
const log = logger(module)
const { DefaultMap } = collections.map

const GROUP_TO_DEPLOY_TYPE: Record<string, DeployType> = {
  [SUITEAPP_CREATING_FILES_GROUP_ID]: 'add',
  [SUITEAPP_UPDATING_FILES_GROUP_ID]: 'update',
  [SUITEAPP_DELETING_FILES_GROUP_ID]: 'delete',
}

const getServiceIdFromElement = (changeData: ChangeDataType): string => {
  if (isFileCabinetInstance(changeData)) {
    return getElementValueOrAnnotations(changeData)[PATH]
  }
  if (isField(changeData)) {
    return changeData.parent.annotations[SCRIPT_ID]
  }
  return getElementValueOrAnnotations(changeData)[SCRIPT_ID]
}

const getChangeType = (change: Change): 'addition' | 'modification' =>
  (isAdditionChange(change) ? 'addition' : 'modification')

type DependencyInfo = {
  dependencyMap: Map<string, Set<string>>
  dependencyGraph: Graph<SDFObjectNode>
}

export default class NetsuiteClient {
  private sdfClient: SdfClient
  private suiteAppClient?: SuiteAppClient
  private suiteAppFileCabinet?: SuiteAppFileCabinetOperations
  public readonly url: URL

  constructor(sdfClient: SdfClient, suiteAppClient?: SuiteAppClient) {
    this.sdfClient = sdfClient
    this.suiteAppClient = suiteAppClient
    if (this.suiteAppClient === undefined) {
      log.debug('Salto SuiteApp not configured')
    } else {
      this.suiteAppFileCabinet = createSuiteAppFileCabinetOperations(this.suiteAppClient)
      log.debug('Salto SuiteApp configured')
    }

    this.url = new URL(`https://${toUrlAccountId(this.sdfClient.getCredentials().accountId)}.app.netsuite.com`)
  }

  @NetsuiteClient.logDecorator
  static async validateCredentials(credentials: Credentials): Promise<AccountId> {
    if (isSuiteAppCredentials(credentials)) {
      try {
        await SuiteAppClient.validateCredentials(credentials)
      } catch (e) {
        e.message = `Salto SuiteApp Authentication failed. ${e.message}`
        throw new CredentialError(e.message)
      }
    } else {
      log.debug('SuiteApp is not configured - skipping SuiteApp credentials validation')
    }

    try {
      return await SdfClient.validateCredentials(credentials)
    } catch (e) {
      e.message = `SDF Authentication failed. ${e.message}`
      throw new CredentialError(e)
    }
  }

  @NetsuiteClient.logDecorator
  async getConfigRecords(): Promise<ConfigRecord[]> {
    return this.suiteAppClient?.getConfigRecords() ?? []
  }

  @NetsuiteClient.logDecorator
  async deployConfigChanges(
    instancesChanges: Change<InstanceElement>[]
  ): Promise<DeployResult> {
    if (this.suiteAppClient === undefined) {
      return { errors: [new Error(`Salto SuiteApp is not configured and therefore changes group "${SUITEAPP_UPDATING_CONFIG_GROUP_ID}" cannot be deployed`)], appliedChanges: [] }
    }
    const modificationChanges = instancesChanges.filter(isModificationChange)
    return toConfigDeployResult(
      modificationChanges,
      await this.suiteAppClient.setConfigRecordsValues(
        toSetConfigTypes(modificationChanges)
      )
    )
  }

  @NetsuiteClient.logDecorator
  async getCustomObjects(typeNames: string[], query: NetsuiteQuery):
    Promise<GetCustomObjectsResult> {
    return this.sdfClient.getCustomObjects(typeNames, query)
  }

  @NetsuiteClient.logDecorator
  async importFileCabinetContent(query: NetsuiteQuery):
    Promise<ImportFileCabinetResult> {
    if (this.suiteAppFileCabinet !== undefined) {
      return this.suiteAppFileCabinet.importFileCabinet(query)
    }

    return this.sdfClient.importFileCabinetContent(query)
  }

  private static async toCustomizationInfos(
    elements: (InstanceElement | ObjectType)[],
  ): Promise<CustomizationInfo[]> {
    return awu(elements)
      .map(getOrTransformCustomRecordTypeToInstance)
      .filter(isDefined)
      .map(toCustomizationInfo)
      .toArray()
  }

  private static async getSDFObjectNodes(
    changes: Change<InstanceElement | ObjectType>[],
  ): Promise<SDFObjectNode[]> {
    const elementsAndChangeTypes = changes
      .filter(isAdditionOrModificationChange)
      .map(change =>
        ({ element: getChangeData(change), changeType: getChangeType(change) }))
    return awu(elementsAndChangeTypes)
      .map(async ({ element, changeType }) => ({
        elemIdFullName: element.elemID.getFullName(),
        serviceid: getServiceIdFromElement(element),
        changeType,
        customizationInfo: (await NetsuiteClient.toCustomizationInfos([element]))[0],
      }))
      .toArray()
  }

  public static async createDependencyMapAndGraph(
    changes: Change<InstanceElement | ObjectType>[],
  ): Promise<DependencyInfo> {
    const dependencyMap = new DefaultMap<string, Set<string>>(() => new Set())
    const elemIdsAndCustInfos = await NetsuiteClient.getSDFObjectNodes(changes)
    const dependencyGraph = new Graph<SDFObjectNode>(
      'elemIdFullName', elemIdsAndCustInfos.map(elemIdsAndCustInfo => new GraphNode(elemIdsAndCustInfo))
    )
    elemIdsAndCustInfos.forEach(elemIdAndCustInfo => {
      const currSet = dependencyMap.get(elemIdAndCustInfo.elemIdFullName)
      const endNode = dependencyGraph.findNode(elemIdAndCustInfo)
      lookupValue(elemIdAndCustInfo.customizationInfo.values, val => {
        if (!_.isString(val)) {
          return
        }
        const serviceIdInfoArray = captureServiceIdInfo(val)
        serviceIdInfoArray.forEach(serviceIdInfo => {
          currSet.add(serviceIdInfo.serviceId)
          const startNode = dependencyGraph.findNodeByField('serviceid', serviceIdInfo.serviceId)
          if (startNode && endNode && startNode.value.changeType === 'addition') {
            startNode.addEdge(dependencyGraph.key, endNode)
          }
        })
      })
    })
    return { dependencyMap, dependencyGraph }
  }

  private static getDependenciesFromGraph(
    elemIds: ElemID[],
    dependencyGraph: Graph<SDFObjectNode>
  ): Set<string> {
    return new Set(elemIds.map(id => dependencyGraph.findNodeByKey(id.getFullName()))
      .filter(values.isDefined)
      .flatMap(node => dependencyGraph.getNodeDependencies(node))
      .map(node => node.value.elemIdFullName))
  }

  private static toManifestDependencies(
    additionalDependencies: AdditionalDependencies,
    featuresMap: FeaturesMap,
  ): ManifestDependencies {
    const { optional = [], required = [], excluded = [] } = _.groupBy(
      Object.entries(featuresMap).map(([name, { status }]) => ({ name, status })),
      feature => feature.status
    )
    return {
      optionalFeatures: optional.map(feature => feature.name),
      requiredFeatures: required.map(feature => feature.name),
      excludedFeatures: excluded.map(feature => feature.name),
      includedObjects: additionalDependencies.include.objects,
      excludedObjects: additionalDependencies.exclude.objects,
    }
  }

  private static createFeaturesMap(
    additionalDependencies: AdditionalDependencies
  ): FeaturesMap {
    const [requiredFeatures, optionalFeatures] = _.partition(
      additionalDependencies.include.features,
      isRequiredFeature
    )
    return Object.fromEntries([
      ...optionalFeatures
        .map(featureName => [featureName, { status: 'optional', canBeRequired: true }]),
      ...requiredFeatures
        .map(removeRequiredFeatureSuffix)
        .map(featureName => [featureName, { status: 'required' }]),
      ...additionalDependencies.exclude.features
        .map(featureName => [featureName, { status: 'excluded' }]),
    ])
  }

  private static updateFeaturesMap(
    featuresMap: FeaturesMap,
    missingFeaturesError: MissingManifestFeaturesError
  ): { failedToUpdate: boolean; error?: Error } {
    const missingExcludedFeatures = new Set<string>()
    let failedToUpdate = false
    missingFeaturesError.missingFeatures.forEach(featureName => {
      const feature = featuresMap[featureName]
      if (feature === undefined) {
        featuresMap[featureName] = { status: 'optional', canBeRequired: true }
      } else if (feature.status === 'excluded') {
        featuresMap[featureName] = { status: 'optional', canBeRequired: false }
      } else if (feature.status === 'required') {
        log.error('The %s feature is already required, but sdf returned an error: %o', featureName, missingFeaturesError)
        failedToUpdate = true
      } else if (feature.status === 'optional' && feature.canBeRequired) {
        featuresMap[featureName] = { status: 'required' }
      } else if (feature.status === 'optional' && !feature.canBeRequired) {
        log.warn('The %s feature is required but it is excluded', featureName)
        missingExcludedFeatures.add(featureName)
      }
    })
    if (missingExcludedFeatures.size > 0) {
      const error = new Error(`The following features are required but they are excluded: ${Array.from(missingExcludedFeatures).join(', ')}.`)
      return { failedToUpdate: true, error }
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
    const changesToDeploy = changes.filter(
      change => isInstanceChange(change) || isObjectTypeChange(change)
    ) as Change<InstanceElement | ObjectType>[]
    const fieldChangesByType = _.groupBy(
      changes.filter(isFieldChange),
      change => getChangeData(change).parent.elemID.getFullName()
    )

    const someElementToDeploy = getChangeData(changes[0])
    const suiteAppId = getElementValueOrAnnotations(someElementToDeploy)[APPLICATION_ID]

    const errors: Error[] = []
    const { dependencyMap, dependencyGraph } = await NetsuiteClient.createDependencyMapAndGraph(changesToDeploy)
    const featuresMap = NetsuiteClient.createFeaturesMap(additionalDependencies)

    while (changesToDeploy.length > 0) {
      const changesToApply = changesToDeploy.flatMap(change => [
        change,
        ...(fieldChangesByType[getChangeData(change).elemID.getFullName()] ?? []),
      ])
      const manifestDependencies = NetsuiteClient.toManifestDependencies(additionalDependencies, featuresMap)

      try {
        log.debug('deploying %d changes', changesToDeploy.length)
        // eslint-disable-next-line no-await-in-loop
        await log.time(
          () => this.sdfClient.deploy(
            suiteAppId,
            { manifestDependencies, validateOnly },
            dependencyGraph
          ),
          'sdfDeploy'
        )
        return { errors, appliedChanges: changesToApply }
      } catch (error) {
        errors.push(error)
        if (error instanceof FeaturesDeployError) {
          return {
            errors,
            appliedChanges: toFeaturesDeployPartialSuccessResult(error, changesToApply),
          }
        }
        if (error instanceof MissingManifestFeaturesError) {
          if (_.isEmpty(error.missingFeatures)) {
            return { errors, appliedChanges: [] }
          }
          const res = NetsuiteClient.updateFeaturesMap(featuresMap, error)
          if (res.failedToUpdate) {
            return { errors: errors.concat(res.error ?? []), appliedChanges: [] }
          }
          // remove error because if the deploy succeeds there shouldn't be a change error
          errors.pop()
          // eslint-disable-next-line no-continue
          continue
        }
        const elemIdsToRemove = NetsuiteClient.getDependenciesFromGraph(
          getChangesElemIdsToRemove(error, dependencyMap, changesToDeploy),
          dependencyGraph
        )
        elemIdsToRemove.forEach(elemIdName => dependencyGraph.removeNode(elemIdName))
        const removedChanges = _.remove(
          changesToDeploy,
          change => elemIdsToRemove.has(getChangeData(change).elemID.getFullName())
        )
        if (removedChanges.length === 0) {
          log.error('no changes were removed from error: %o', error)
          return { errors, appliedChanges: [] }
        }
        log.debug(
          'removed %d changes (%o) from error: %o',
          removedChanges.length,
          removedChanges.map(change => getChangeData(change).elemID.getFullName()),
          error
        )
      }
    }
    return { errors, appliedChanges: [] }
  }

  @NetsuiteClient.logDecorator
  public async validate(
    changes: Change[],
    groupID: string,
    additionalSdfDependencies: AdditionalDependencies,
  ): Promise<ReadonlyArray<Error>> {
    if (isSdfCreateOrUpdateGroupId(groupID)) {
      return (await this.sdfDeploy({
        changes,
        additionalDependencies: additionalSdfDependencies,
        validateOnly: true,
      })).errors
    }
    return []
  }

  @NetsuiteClient.logDecorator
  public async deploy(
    changes: Change[],
    groupID: string,
    additionalSdfDependencies: AdditionalDependencies,
    elementsSourceIndex: LazyElementsSourceIndexes,
  ): Promise<DeployResult> {
    if (isSdfCreateOrUpdateGroupId(groupID)) {
      return this.sdfDeploy({
        changes,
        additionalDependencies: additionalSdfDependencies,
      })
    }

    const instancesChanges = changes.filter(isInstanceChange)
    if (SUITEAPP_FILE_CABINET_GROUPS.includes(groupID)) {
      return this.suiteAppFileCabinet !== undefined
        ? this.suiteAppFileCabinet.deploy(
          instancesChanges,
          GROUP_TO_DEPLOY_TYPE[groupID],
          elementsSourceIndex
        )
        : { errors: [new Error(`Salto SuiteApp is not configured and therefore changes group "${groupID}" cannot be deployed`)], appliedChanges: [] }
    }

    if (groupID === SUITEAPP_UPDATING_CONFIG_GROUP_ID) {
      return this.deployConfigChanges(instancesChanges)
    }

    return this.deployRecords(changes, groupID)
  }

  private async deployRecords(changes: Change[], groupID: string): Promise<DeployResult> {
    const relevantInstances = changes.map(getChangeData).map(getOrTransformCustomRecordTypeToInstance).filter(isDefined)
    const relevantChanges = changes.filter(
      change => isDefined(getOrTransformCustomRecordTypeToInstance(getChangeData(change)))
    )

    const deployResults = await this.runDeployRecordsOperation(relevantInstances, groupID)
    const results = deployResults
      .map((result, index) => (typeof result === 'number' ? relevantChanges[index] : result))
      .filter(values.isDefined)

    const [errors, appliedChanges] = _.partition(
      results, res => res instanceof Error
    ) as [Error[], Change[]]

    const elemIdToInternalId = Object.fromEntries(deployResults
      .map((result, index) => (typeof result === 'number' ? [relevantInstances[index].elemID.getFullName(), result.toString()] : undefined))
      .filter(values.isDefined))

    return { errors, appliedChanges, elemIdToInternalId }
  }

  private async runDeployRecordsOperation(elements: InstanceElement[], groupID: string):
  Promise<(number | Error)[]> {
    if (this.suiteAppClient === undefined) {
      return [new Error(`Salto SuiteApp is not configured and therefore changes group "${groupID}" cannot be deployed`)]
    }

    if (isSuiteAppUpdateRecordsGroupId(groupID)) {
      return this.suiteAppClient.updateInstances(elements)
    }

    if (isSuiteAppCreateRecordsGroupId(groupID)) {
      return this.suiteAppClient.addInstances(elements)
    }

    if (isSuiteAppDeleteRecordsGroupId(groupID)) {
      return this.suiteAppClient.deleteInstances(elements)
    }

    if (isSdfDeleteGroupId(groupID)) {
      return this.suiteAppClient.deleteSdfInstances(elements)
    }

    throw new Error(`Cannot deploy group ID: ${groupID}`)
  }

  public async runSuiteQL(query: string):
    Promise<Record<string, unknown>[] | undefined> {
    return this.suiteAppClient?.runSuiteQL(query)
  }

  public async runSavedSearchQuery(query: SavedSearchQuery):
    Promise<Record<string, unknown>[] | undefined> {
    return this.suiteAppClient?.runSavedSearchQuery(query)
  }

  public async getSystemInformation(): Promise<SystemInformation | undefined> {
    return this.suiteAppClient?.getSystemInformation()
  }

  public isSuiteAppConfigured(): boolean {
    return this.suiteAppClient !== undefined
  }

  public getPathInternalId(path: string): number | undefined {
    const pathToId = this.suiteAppFileCabinet?.getPathToIdMap() ?? {}
    return pathToId[path]
  }

  private static logDecorator = decorators.wrapMethodWith(
    async (
      { call, name }: decorators.OriginalCall,
    ): Promise<unknown> => {
      const desc = `client.${name}`
      try {
        // eslint-disable-next-line @typescript-eslint/return-await
        return await log.time(call, desc)
      } catch (e) {
        log.error('failed to run Netsuite client command on: %o', e)
        throw e
      }
    }
  )

  public async getNetsuiteWsdl(): Promise<elementUtils.soap.WSDL | undefined> {
    return this.suiteAppClient?.getNetsuiteWsdl()
  }

  @NetsuiteClient.logDecorator
  public async getAllRecords(types: string[]): Promise<RecordValue[]> {
    if (this.suiteAppClient === undefined) {
      throw new Error('Cannot call getAllRecords when SuiteApp is not installed')
    }
    return this.suiteAppClient.getAllRecords(types)
  }

  @NetsuiteClient.logDecorator
  public async getCustomRecords(customRecordTypes: string[]): Promise<CustomRecordTypeRecords[]> {
    if (this.suiteAppClient === undefined) {
      throw new Error('Cannot call getCustomRecords when SuiteApp is not installed')
    }
    return this.suiteAppClient.getCustomRecords(customRecordTypes)
  }
}
