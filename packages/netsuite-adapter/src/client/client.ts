/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { AccountId, Change, getChangeData, InstanceElement, isInstanceChange, isModificationChange, CredentialError, isInstanceElement, isField, isObjectType, ChangeDataType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { decorators, collections, values } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { NetsuiteQuery } from '../query'
import { Credentials, isSuiteAppCredentials, toUrlAccountId } from './credentials'
import SdfClient from './sdf_client'
import SuiteAppClient from './suiteapp_client/suiteapp_client'
import { createSuiteAppFileCabinetOperations, SuiteAppFileCabinetOperations, DeployType } from '../suiteapp_file_cabinet'
import { ConfigRecord, SavedSearchQuery, SystemInformation } from './suiteapp_client/types'
import { CustomRecordTypeRecords, RecordValue } from './suiteapp_client/soap_client/types'
import { AdditionalDependencies, CustomizationInfo, GetCustomObjectsResult, ImportFileCabinetResult } from './types'
import { getReferencedElements } from '../reference_dependencies'
import { getLookUpName, toCustomizationInfo } from '../transformer'
import { SDF_CHANGE_GROUP_ID, SUITEAPP_CREATING_FILES_GROUP_ID, SUITEAPP_CREATING_RECORDS_GROUP_ID, SUITEAPP_DELETING_FILES_GROUP_ID, SUITEAPP_DELETING_RECORDS_GROUP_ID, SUITEAPP_FILE_CABINET_GROUPS, SUITEAPP_UPDATING_CONFIG_GROUP_ID, SUITEAPP_UPDATING_FILES_GROUP_ID, SUITEAPP_UPDATING_RECORDS_GROUP_ID } from '../group_changes'
import { DeployResult, getElementValueOrAnnotations, isCustomRecordType } from '../types'
import { CONFIG_FEATURES, APPLICATION_ID, SCRIPT_ID } from '../constants'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'
import { createConvertStandardElementMapsToLists } from '../mapped_lists/utils'
import { toConfigDeployResult, toSetConfigTypes } from '../suiteapp_config_elements'
import { FeaturesDeployError, ObjectsDeployError, SettingsDeployError, ManifestValidationError } from '../errors'
import { toCustomRecordTypeInstance } from '../custom_records/custom_record_type'

const { awu } = collections.asynciterable
const log = logger(module)

const GROUP_TO_DEPLOY_TYPE: Record<string, DeployType> = {
  [SUITEAPP_CREATING_FILES_GROUP_ID]: 'add',
  [SUITEAPP_UPDATING_FILES_GROUP_ID]: 'update',
  [SUITEAPP_DELETING_FILES_GROUP_ID]: 'delete',
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

  private static toFeaturesDeployPartialSuccessResult(
    error: FeaturesDeployError,
    changes: ReadonlyArray<Change>
  ): Change[] {
    // this case happens when all changes where deployed successfully,
    // except of some features in config_features
    const [[featuresChange], successfullyDeployedChanges] = _.partition(
      changes, change => getChangeData(change).elemID.typeName === CONFIG_FEATURES
    )

    // if some changed features are not in errors.ids we want to include the change
    if (isInstanceChange(featuresChange) && isModificationChange(featuresChange) && !_.isEqual(
      _(featuresChange.data.before.value.feature)
        .keyBy(feature => feature.id).omit(error.ids).value(),
      _(featuresChange.data.after.value.feature)
        .keyBy(feature => feature.id).omit(error.ids).value(),
    )) {
      successfullyDeployedChanges.push(featuresChange)
    }

    return successfullyDeployedChanges
  }

  private static getFailedSdfDeployChangesElemIDs(
    error: ObjectsDeployError,
    changes: ReadonlyArray<Change>
  ): Set<string> {
    const changeData = changes.map(getChangeData)
    const failedElemIDs = new Set(changeData
      .filter(elem => (
        isInstanceElement(elem) && error.failedObjects.has(elem.value[SCRIPT_ID])
      ) || (
        isField(elem) && error.failedObjects.has(elem.parent.annotations[SCRIPT_ID])
      ) || (
        error.failedObjects.has(elem.annotations[SCRIPT_ID])
      ))
      .map(elem => elem.elemID.getFullName()))

    // in case we cannot find the failed instances we return all as failed
    return failedElemIDs.size === 0
      ? new Set(changeData.map(elem => elem.elemID.getFullName()))
      : failedElemIDs
  }

  private static async toCustomizationInfos(
    elements: ChangeDataType[],
    deployReferencedElements: boolean,
    elementsSourceIndex: LazyElementsSourceIndexes
  ): Promise<CustomizationInfo[]> {
    const elemIdSet = new Set(elements.map(element => element.elemID.getFullName()))
    const fieldsParents = _(elements)
      .filter(isField)
      .map(field => field.parent)
      .filter(parent => !elemIdSet.has(parent.elemID.getFullName()))
      .uniqBy(parent => parent.elemID.name)
      .value()

    const convertElementMapsToLists = await createConvertStandardElementMapsToLists(elementsSourceIndex)
    return awu(await getReferencedElements(
      elements.concat(fieldsParents),
      deployReferencedElements
    ))
      .map(element => resolveValues(element, getLookUpName))
      .map(convertElementMapsToLists)
      .map(element => {
        if (isInstanceElement(element)) {
          return element
        }
        if (isObjectType(element) && isCustomRecordType(element)) {
          return toCustomRecordTypeInstance(element)
        }
        return undefined
      })
      .filter(values.isDefined)
      .map(toCustomizationInfo)
      .toArray()
  }

  private async sdfDeploy({
    changes,
    deployReferencedElements,
    additionalDependencies,
    validateOnly = false,
    elementsSourceIndex,
  }: {
    changes: ReadonlyArray<Change>
    deployReferencedElements: boolean
    additionalDependencies: AdditionalDependencies
    validateOnly?: boolean
    elementsSourceIndex: LazyElementsSourceIndexes
  }): Promise<DeployResult> {
    const changesToDeploy = Array.from(changes)

    const someElementToDeploy = getChangeData(changes[0])
    const suiteAppId = getElementValueOrAnnotations(someElementToDeploy)[APPLICATION_ID]

    const errors: Error[] = []

    while (changesToDeploy.length > 0) {
      const changedInstances = changesToDeploy.map(getChangeData)
      // eslint-disable-next-line no-await-in-loop
      const customizationInfos = await NetsuiteClient.toCustomizationInfos(
        changedInstances,
        deployReferencedElements,
        elementsSourceIndex,
      )
      try {
        log.debug('deploying %d changes', changesToDeploy.length)
        // eslint-disable-next-line no-await-in-loop
        await log.time(
          () => this.sdfClient.deploy(
            customizationInfos,
            suiteAppId,
            { additionalDependencies, validateOnly }
          ),
          'sdfDeploy'
        )
        return { errors, appliedChanges: changesToDeploy }
      } catch (error) {
        errors.push(error)
        if (error instanceof ManifestValidationError) {
          log.debug('manifest validation errror: sdf deploy failed')
        }
        if (error instanceof FeaturesDeployError) {
          const successfullyDeployedChanges = NetsuiteClient.toFeaturesDeployPartialSuccessResult(
            error, changesToDeploy
          )
          return { errors, appliedChanges: successfullyDeployedChanges }
        }
        if (error instanceof ObjectsDeployError) {
          const failedElemIDs = NetsuiteClient.getFailedSdfDeployChangesElemIDs(
            error, changesToDeploy
          )
          log.debug('objects deploy error: sdf failed to deploy: %o', Array.from(failedElemIDs))
          _.remove(
            changesToDeploy,
            change => failedElemIDs.has(getChangeData(change).elemID.getFullName())
          )
        } else if (error instanceof SettingsDeployError) {
          const { failedConfigTypes } = error
          if (!changesToDeploy.some(change =>
            failedConfigTypes.has(getChangeData(change).elemID.typeName))) {
            log.debug('settings deploy error: no changes matched the failedConfigType list: %o', Array.from(failedConfigTypes))
            return { errors, appliedChanges: [] }
          }
          log.debug('settings deploy error: sdf failed to deploy: %o', Array.from(failedConfigTypes))
          _.remove(
            changesToDeploy,
            change => failedConfigTypes.has(getChangeData(change).elemID.typeName)
          )
        } else {
          // unknown error
          return { errors, appliedChanges: [] }
        }
      }
    }
    return { errors, appliedChanges: [] }
  }

  @NetsuiteClient.logDecorator
  public async validate(
    changes: Change[],
    groupID: string,
    deployReferencedElements: boolean,
    additionalSdfDependencies: AdditionalDependencies,
    elementsSourceIndex: LazyElementsSourceIndexes
  ): Promise<ReadonlyArray<Error>> {
    if (groupID.startsWith(SDF_CHANGE_GROUP_ID)) {
      return (await this.sdfDeploy({
        changes,
        deployReferencedElements,
        additionalDependencies: additionalSdfDependencies,
        validateOnly: true,
        elementsSourceIndex,
      })).errors
    }
    return []
  }

  @NetsuiteClient.logDecorator
  public async deploy(
    changes: Change[],
    groupID: string,
    deployReferencedElements: boolean,
    additionalSdfDependencies: AdditionalDependencies,
    elementsSourceIndex: LazyElementsSourceIndexes,
  ):
    Promise<DeployResult> {
    if (groupID.startsWith(SDF_CHANGE_GROUP_ID)) {
      return this.sdfDeploy({
        changes,
        deployReferencedElements,
        additionalDependencies: additionalSdfDependencies,
        elementsSourceIndex,
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
    const instanceChanges = changes.filter(isInstanceChange)
    const instances = instanceChanges.map(getChangeData)

    const deployResults = await this.runDeployRecordsOperation(instances, groupID)

    const results = deployResults
      .map((result, index) => (typeof result === 'number' ? instanceChanges[index] : result))
      .filter(values.isDefined)

    const [errors, appliedChanges] = _.partition(
      results, res => res instanceof Error
    ) as [Error[], Change[]]

    const elemIdToInternalId = Object.fromEntries(deployResults
      .map((result, index) => (typeof result === 'number' ? [instances[index].elemID.getFullName(), result.toString()] : undefined))
      .filter(values.isDefined))

    return { errors, appliedChanges, elemIdToInternalId }
  }

  private async runDeployRecordsOperation(elements: InstanceElement[], groupID: string):
  Promise<(number | Error)[]> {
    if (this.suiteAppClient === undefined) {
      return [new Error(`Salto SuiteApp is not configured and therefore changes group "${groupID}" cannot be deployed`)]
    }

    if (groupID.startsWith(SUITEAPP_UPDATING_RECORDS_GROUP_ID)) {
      return this.suiteAppClient.updateInstances(elements)
    }

    if (groupID.startsWith(SUITEAPP_CREATING_RECORDS_GROUP_ID)) {
      return this.suiteAppClient.addInstances(elements)
    }

    if (groupID.startsWith(SUITEAPP_DELETING_RECORDS_GROUP_ID)) {
      return this.suiteAppClient.deleteInstances(elements)
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
