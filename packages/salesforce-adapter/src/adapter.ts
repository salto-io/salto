/*
*                      Copyright 2020 Salto Labs Ltd.
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
  TypeElement, ObjectType, InstanceElement, isModificationDiff,
  isRemovalDiff, isAdditionDiff, Field, Element, isObjectType, isInstanceElement,
  Change, getChangeElement, isField, isElement, ElemIdGetter, Values, FetchResult,
  AdapterOperations, ChangeGroup, DeployResult, isInstanceChange, isObjectTypeChange, isFieldChange,
} from '@salto-io/adapter-api'
import {
  resolveValues, restoreValues,
} from '@salto-io/adapter-utils'
import {
  SaveResult, MetadataInfo, FileProperties, UpsertResult, MetadataObject,
} from 'jsforce'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { decorators, collections } from '@salto-io/lowerdash'
import SalesforceClient from './client/client'
import * as constants from './constants'
import {
  toCustomField, toCustomObject, apiName, Types, toMetadataInfo, createInstanceElement,
  metadataType, createMetadataTypeElements, instancesToUpdateRecords, instancesToDeleteRecords,
  defaultApiName, getLookUpName, isCustomObject, instancesToCreateRecords,
} from './transformers/transformer'
import { toMetadataPackageZip } from './transformers/xml_transformer'
import layoutFilter from './filters/layouts'
import customObjectsFilter from './filters/custom_objects'
import customObjectsSplitFilter from './filters/custom_object_split'
import customObjectsInstancesFilter from './filters/custom_objects_instances'
import profilePermissionsFilter from './filters/profile_permissions'
import convertListsFilter from './filters/convert_lists'
import convertTypeFilter from './filters/convert_types'
import missingFieldsFilter from './filters/missing_fields'
import removeFieldsFilter from './filters/remove_fields'
import standardValueSetFilter from './filters/standard_value_sets'
import flowFilter from './filters/flow'
import lookupFiltersFilter from './filters/lookup_filters'
import animationRulesFilter from './filters/animation_rules'
import samlInitMethodFilter from './filters/saml_initiation_method'
import settingsFilter from './filters/settings_type'
import workflowFilter from './filters/workflow'
import topicsForObjectsFilter from './filters/topics_for_objects'
import globalValueSetFilter from './filters/global_value_sets'
import instanceReferences from './filters/instance_references'
import valueSetFilter from './filters/value_set'
import customObjectTranslationFilter from './filters/custom_object_translation'
import recordTypeFilter from './filters/record_type'
import hideTypesFilter from './filters/hide_types'
import { ConfigChangeSuggestion, FetchElements, SalesforceConfig } from './types'
import { createListMetadataObjectsConfigChange, createSkippedListConfigChange,
  getConfigFromConfigChanges,
  STOP_MANAGING_ITEMS_MSG } from './config_change'
import { FilterCreator, Filter, filtersRunner } from './filter'
import { id, addApiName, addMetadataType, addLabel } from './filters/utils'
import { retrieveMetadataInstances } from './fetch'
import { IS_FOLDER } from './constants'

const { makeArray } = collections.array
const log = logger(module)

export const DEFAULT_FILTERS = [
  // should run before missingFieldsFilter
  settingsFilter,
  missingFieldsFilter,
  // should run before customObjectsFilter
  workflowFilter,
  // customObjectsFilter depends on missingFieldsFilter and settingsFilter
  customObjectsFilter,
  // customObjectsInstancesFilter depends on customObjectsFilter
  customObjectsInstancesFilter,
  removeFieldsFilter,
  layoutFilter,
  // profilePermissionsFilter depends on layoutFilter because layoutFilter
  // changes ElemIDs that the profile references
  profilePermissionsFilter,
  standardValueSetFilter,
  flowFilter,
  lookupFiltersFilter,
  animationRulesFilter,
  samlInitMethodFilter,
  topicsForObjectsFilter,
  valueSetFilter,
  globalValueSetFilter,
  // customObjectTranslationFilter and recordTypeFilter depends on customObjectsFilter
  customObjectTranslationFilter,
  recordTypeFilter,
  // The following filters should remain last in order to make sure they fix all elements
  convertListsFilter,
  convertTypeFilter,
  instanceReferences,
  // hideTypesFilter should come before customObjectsSplitFilter
  hideTypesFilter,
  customObjectsSplitFilter,
]

export const TEST_FILTERS = [
  customObjectsFilter,
  // customObjectsInstancesFilter depends on customObjectsFilter
  customObjectsInstancesFilter,
]

const absoluteIDMetadataTypes: Record<string, string[]> = {
  CustomLabels: ['labels'],
}

const nestedIDMetadataTypes: Record<string, string[]> = {
  AssignmentRules: ['assignmentRule'],
  AutoResponseRules: ['autoresponseRule'],
  EscalationRules: ['escalationRule'],
  MatchingRules: ['matchingRules'],
  SharingRules: ['sharingCriteriaRules', 'sharingGuestRules',
    'sharingOwnerRules', 'sharingTerritoryRules'],
}

// Add elements defaults
const addDefaults = (element: ObjectType): void => {
  addApiName(element)
  addMetadataType(element)
  addLabel(element)
  Object.values(element.fields).forEach(field => {
    addApiName(field, undefined, apiName(element))
    addLabel(field)
  })
}

const instanceNameMatchRegex = (name: string, regex: RegExp[]): boolean =>
  regex.some(re => re.test(name))

const validateApiName = (prevElement: Element, newElement: Element): void => {
  if (apiName(prevElement) !== apiName(newElement)) {
    throw Error(
      `Failed to update element as api names prev=${apiName(
        prevElement
      )} and new=${apiName(newElement)} are different`
    )
  }
}

export interface SalesforceAdapterParams {
  // Metadata types that we want to fetch that exist in the SOAP API but not in the metadata API
  metadataAdditionalTypes?: string[]

  // Regular expressions for instances that we want to exclude from readMetadata
  // The regular expression would be matched against instances of the format METADATA_TYPE.INSTANCE
  // For example: CustomObject.Lead
  instancesRegexSkippedList?: string[]

  // Max retrieve requests that we want to send concurrently
  maxConcurrentRetrieveRequests?: number

  // Max items to fetch in one retrieve request
  maxItemsInRetrieveRequest?: number

  // Metadata types that we do not want to fetch even though they are returned as top level
  // types from the API
  metadataTypesSkippedList?: string[]

  // Determine whether hide type folder
  enableHideTypesInNacls?: boolean

  // Metadata types that we have to fetch using the retrieve API
  metadataToRetrieve?: string[]

  // Metadata types that we have to add update or remove using the deploy API endpoint
  metadataToDeploy?: string[]

  // Metadata types that we should not create, update or delete in the main adapter code
  metadataTypesToSkipMutation?: string[]

  // Metadata types that we should not use client.update but client.upsert upon instance update
  metadataTypesToUseUpsertUponUpdate?: string[]

  // Metadata types that that include metadata types inside them
  nestedMetadataTypes?: Record<string, string[]>

  // Filters to deploy to all adapter operations
  filterCreators?: FilterCreator[]

  // client to use
  client: SalesforceClient

  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter

  // System fields that salesforce may add to custom objects - to be ignored when creating objects
  systemFields?: string[]

  // Unsupported System fields that salesforce may add to custom objects
  // to not be fetched and managed
  unsupportedSystemFields?: string[]

  config: SalesforceConfig
}

const logDuration = (message?: string): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(
    async (original: decorators.OriginalCall): Promise<unknown> => {
      const element = original.args.find(isElement)
      const defaultMessage = `running salesforce.${original.name} ${
        element ? `element=${id(element)}` : ''} `
      return log.time(original.call, message || defaultMessage)
    }
  )

type NamespaceAndInstances = { namespace?: string; instanceInfo: MetadataInfo }

const metadataToRetrieveAndDeploy = [
  'ApexClass', // readMetadata is not supported, contains encoded zip content
  'ApexTrigger', // readMetadata is not supported, contains encoded zip content
  'ApexPage', // contains encoded zip content
  'ApexComponent', // contains encoded zip content
  'AssignmentRules',
  'InstalledPackage', // listMetadataObjects of this types returns duplicates
  'EmailTemplate', // contains encoded zip content, is under a folder
  'EmailFolder',
  'ReportType',
  'Report', // contains encoded zip content, is under a folder
  'ReportFolder',
  'Dashboard', // contains encoded zip content, is under a folder
  'DashboardFolder',
  'Document', // contains encoded zip content, is under a folder
  'DocumentFolder',
  'Territory2', // All Territory2 types do not support CRUD
  'Territory2Rule', // All Territory2 types do not support CRUD
  'Territory2Model', // All Territory2 types do not support CRUD
  'Territory2Type', // All Territory2 types do not support CRUD
]

export default class SalesforceAdapter implements AdapterOperations {
  private enableHideTypesInNacls: boolean
  private metadataTypesSkippedList: string[]
  private instancesRegexSkippedList: RegExp[]
  private maxConcurrentRetrieveRequests: number
  private maxItemsInRetrieveRequest: number
  private metadataToDeploy: string[]
  private metadataToRetrieve: string[]
  private metadataAdditionalTypes: string[]
  private metadataTypesToSkipMutation: string[]
  private metadataTypesToUseUpsertUponUpdate: string[]
  private nestedMetadataTypes: Record<string, string[]>
  private filtersRunner: Required<Filter>
  private client: SalesforceClient
  private systemFields: string[]
  private userConfig: SalesforceConfig

  public constructor({
    enableHideTypesInNacls = constants.DEFAULT_ENABLE_HIDE_TYPES_IN_NACLS,
    metadataTypesSkippedList = [
      'CustomField', // We have special treatment for this type
      'Settings',
      'StaticResource',
      'NetworkBranding',
      'FlowDefinition', // Only has the active flow version but we cant get flow versions anyway
      // readMetadata fails on those and pass on the parents (AssignmentRules and EscalationRules)
      'AssignmentRule', 'EscalationRule',
      'KnowledgeSettings',
    ],
    instancesRegexSkippedList = [],
    maxConcurrentRetrieveRequests = constants.DEFAULT_MAX_CONCURRENT_RETRIEVE_REQUESTS,
    maxItemsInRetrieveRequest = constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
    metadataToRetrieve = metadataToRetrieveAndDeploy,
    metadataToDeploy = [
      ...metadataToRetrieveAndDeploy,
      'SharingRules', // upsert does not work for creating rules, gets fetched via custom objects
    ],
    metadataAdditionalTypes = [
      'ProfileUserPermission',
      'WorkflowAlert',
      'WorkflowFieldUpdate',
      'WorkflowFlowAction',
      'WorkflowKnowledgePublish',
      'WorkflowOutboundMessage',
      'WorkflowTask',
    ],
    metadataTypesToSkipMutation = [
      'Workflow', // handled in workflow filter
    ],
    metadataTypesToUseUpsertUponUpdate = [
      'Flow', // update fails for Active flows
      'EscalationRules',
      'AutoResponseRules',
    ],
    nestedMetadataTypes = {
      ...absoluteIDMetadataTypes,
      ...nestedIDMetadataTypes,
    },
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    // See: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_custom_object__c.htm
    systemFields = [
      'ConnectionReceivedId',
      'ConnectionSentId',
      'CreatedById',
      'CreatedDate',
      'CurrencyIsoCode',
      'Id',
      'IsDeleted',
      'LastActivityDate',
      'LastModifiedDate',
      'LastModifiedById',
      'LastReferencedDate',
      'LastViewedDate',
      'Name',
      'RecordTypeId',
      'SystemModstamp',
      'OwnerId',
    ],
    unsupportedSystemFields = [
      'LastReferencedDate',
      'LastViewedDate',
    ],
    config,
  }: SalesforceAdapterParams) {
    this.enableHideTypesInNacls = config.enableHideTypesInNacls ?? enableHideTypesInNacls
    this.metadataTypesSkippedList = metadataTypesSkippedList
      .concat(makeArray(config.metadataTypesSkippedList))
    this.instancesRegexSkippedList = instancesRegexSkippedList
      .concat(makeArray(config.instancesRegexSkippedList))
      .map(e => new RegExp(e))
    this.maxConcurrentRetrieveRequests = config.maxConcurrentRetrieveRequests
      ?? maxConcurrentRetrieveRequests
    this.maxItemsInRetrieveRequest = config.maxItemsInRetrieveRequest ?? maxItemsInRetrieveRequest
    this.metadataToRetrieve = metadataToRetrieve
    this.metadataToDeploy = metadataToDeploy
    this.userConfig = config
    this.metadataAdditionalTypes = metadataAdditionalTypes
    this.metadataTypesToSkipMutation = metadataTypesToSkipMutation
    this.metadataTypesToUseUpsertUponUpdate = metadataTypesToUseUpsertUponUpdate
    this.nestedMetadataTypes = nestedMetadataTypes
    this.client = client
    this.systemFields = systemFields
    this.filtersRunner = filtersRunner(
      this.client,
      {
        instancesRegexSkippedList: this.instancesRegexSkippedList,
        metadataTypesSkippedList: this.metadataTypesSkippedList,
        unsupportedSystemFields,
        dataManagement: config.dataManagement,
        systemFields,
        enableHideTypesInNacls: this.enableHideTypesInNacls,
      },
      filterCreators
    )
    if (getElemIdFunc) {
      Types.setElemIdGetter(getElemIdFunc)
    }
  }

  /**
   * Fetch configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch(): Promise<FetchResult> {
    log.debug('going to fetch salesforce account configuration..')
    const fieldTypes = Types.getAllFieldTypes()
    const missingTypes = Types.getAllMissingTypes()
    const annotationTypes = Types.getAnnotationTypes()
    const metadataTypeInfos = this.listMetadataTypes()
    const metadataTypes = this.fetchMetadataTypes(
      metadataTypeInfos,
      annotationTypes,
    )
    const metadataInstances = this.fetchMetadataInstances(metadataTypeInfos, metadataTypes)

    const elements = _.flatten(
      await Promise.all([annotationTypes, fieldTypes, missingTypes,
        metadataTypes]) as Element[][]
    )
    const {
      elements: metadataInstancesElements,
      configChanges: metadataInstancesConfigInstances,
    } = await metadataInstances
    elements.push(...metadataInstancesElements)

    const filtersConfigChanges = (
      (await this.filtersRunner.onFetch(elements)) ?? []
    ) as ConfigChangeSuggestion[]

    const config = getConfigFromConfigChanges(
      Array.from(new Set([...metadataInstancesConfigInstances, ...filtersConfigChanges])),
      this.userConfig,
    )
    if (_.isUndefined(config)) {
      return { elements }
    }
    return { elements, updatedConfig: { config, message: STOP_MANAGING_ITEMS_MSG } }
  }

  async deploy(changeGroup: ChangeGroup): Promise<DeployResult> {
    const changeByElem = _.groupBy(
      changeGroup.changes,
      change => getChangeElement(change).elemID.createTopLevelParentID().parent.getFullName(),
    )
    const results = await Promise.all(
      Object.values(changeByElem)
        .map(elemChanges => this.deployElementChanges(elemChanges))
    )
    return {
      appliedChanges: _.flatten(results.map(res => res.appliedChanges)),
      errors: _.flatten(results.map(res => res.errors)),
    }
  }


  /**
   * Add new element
   * @param element the object/instance to add
   * @returns the updated element with extra info like api name, label and metadata type
   * @throws error in case of failure
   */
  private async add<T extends InstanceElement | ObjectType>(element: T): Promise<T> {
    const resolved = resolveValues(element, getLookUpName)
    const post = isObjectType(resolved)
      ? await this.addObject(resolved)
      : await this.addInstance(resolved as InstanceElement)

    await this.filtersRunner.onAdd(post)
    return restoreValues(element, post as T, getLookUpName)
  }

  /**
   * Add new object
   * @param element of ObjectType to add
   * @returns the updated object with extra info like api name, label and metadata type
   * @throws error in case of failure
   */
  private async addObject(element: ObjectType): Promise<ObjectType> {
    const post = element.clone()
    addDefaults(post)

    await this.client.upsert(
      constants.CUSTOM_OBJECT, toCustomObject(post, true, this.systemFields),
    )

    return post
  }

  /**
   * Add new Instance
   * @param element to add
   * @returns the updated instance
   * @throws error in case of failure
   */
  private async addInstance(element: InstanceElement): Promise<InstanceElement> {
    const addInstanceDefaults = (elem: InstanceElement): void => {
      if (elem.value[constants.INSTANCE_FULL_NAME_FIELD] === undefined) {
        elem.value[constants.INSTANCE_FULL_NAME_FIELD] = defaultApiName(elem)
      }
    }

    const post = element.clone()
    const type = metadataType(post)
    if (isCustomObject(post.type)) {
      const result = await this.client.bulkLoadOperation(
        apiName(post.type),
        'insert',
        instancesToCreateRecords([post]),
      )
      // Add autogenerated Id to the new instance so we will be able to update it immediately
      if (post.type.fields[constants.CUSTOM_OBJECT_ID_FIELD] !== undefined) {
        // Currently called with one instance so result is a single element array
        post.value[constants.CUSTOM_OBJECT_ID_FIELD] = result[0]?.id
      }
    } else {
      addInstanceDefaults(post)
      if (this.metadataToDeploy.includes(type)) {
        await this.deployInstance(post)
      } else if (!this.metadataTypesToSkipMutation.includes(metadataType(post))) {
        await this.client.upsert(type, toMetadataInfo(apiName(post), post.value))
      }
    }
    return post
  }

  private async deployInstance(instance: InstanceElement, deletion = false): Promise<void> {
    const zip = await toMetadataPackageZip(apiName(instance), metadataType(instance),
      instance.value, deletion)
    if (zip) {
      await this.client.deploy(zip)
    } else {
      log.warn('Skipped deploying instance %s of type %s', apiName(instance), metadataType(instance))
    }
  }

  /**
   * Remove an element (object/instance)
   * @param element to remove
   */
  @logDuration()
  private async remove(element: Element): Promise<void> {
    const resolved = resolveValues(element, getLookUpName)
    const type = metadataType(resolved)
    if (isInstanceElement(resolved) && isCustomObject(resolved.type)) {
      await this.client.bulkLoadOperation(
        apiName(resolved.type),
        'delete',
        instancesToDeleteRecords([resolved]),
      )
    } else if (isInstanceElement(resolved) && this.metadataToDeploy.includes(type)) {
      await this.deployInstance(resolved, true)
    } else if (!(isInstanceElement(resolved) && this.metadataTypesToSkipMutation.includes(type))) {
      await this.client.delete(type, apiName(resolved))
    }
    await this.filtersRunner.onRemove(resolved)
  }

  /**
   * Updates an Element
   * @param before The metadata of the old element
   * @param after The new metadata of the element to replace
   * @param changes to apply
   * @returns the updated element
   */
  @logDuration()
  private async update<T extends InstanceElement | ObjectType>(before: T, after: T,
    changes: ReadonlyArray<Change>): Promise<T> {
    const resBefore = resolveValues(before, getLookUpName)
    const resAfter = resolveValues(after, getLookUpName)
    const resChanges = changes.map(c => ({
      action: c.action,
      data: _.mapValues(c.data, (x => resolveValues(x, getLookUpName))),
    })) as ReadonlyArray<Change<Field | ObjectType>>
    const result = isObjectType(resBefore) && isObjectType(resAfter)
      ? await this.updateObject(resBefore, resAfter, resChanges)
      : await this.updateInstance(resBefore as InstanceElement, resAfter as InstanceElement)

    // Aspects should be updated once all object related properties updates are over
    await this.filtersRunner.onUpdate(resBefore, result, resChanges)
    return restoreValues(after, result as T, getLookUpName)
  }

  /**
   * Update a custom object
   * @param before The metadata of the old element
   * @param after The new metadata of the element to replace
   * @param changes to apply
   * @returns the updated object
   */
  private async updateObject(before: ObjectType, after: ObjectType,
    changes: ReadonlyArray<Change<Field | ObjectType>>): Promise<ObjectType> {
    validateApiName(before, after)
    const clonedObject = after.clone()
    changes
      .filter(isAdditionDiff)
      .map(getChangeElement)
      .filter(isField)
      .map(fieldChange => clonedObject.fields[fieldChange.name])
      .forEach(field => {
        addLabel(field)
        addApiName(field, undefined, apiName(clonedObject))
      })

    const fieldChanges = changes.filter(c => isField(getChangeElement(c))) as Change<Field>[]

    // There are fields that are not equal but their transformation
    // to CustomField is (e.g. lookup field with LookupFilter).
    const shouldUpdateField = (beforeField: Field, afterField: Field): boolean =>
      !_.isEqual(toCustomField(beforeField, true),
        toCustomField(afterField, true))

    await Promise.all([
      // Retrieve the custom fields for deletion and delete them
      this.deleteCustomFields(fieldChanges.filter(isRemovalDiff).map(getChangeElement)),
      // Retrieve the custom fields for addition and than create them
      this.createFields(fieldChanges
        .filter(isAdditionDiff)
        .filter(c => !this.systemFields.includes(getChangeElement(c).name))
        .map(c => clonedObject.fields[c.data.after.name])),
      // Update the remaining fields that were changed
      this.updateFields(fieldChanges
        .filter(isModificationDiff)
        .filter(c => shouldUpdateField(c.data.before, c.data.after))
        .map(c => clonedObject.fields[c.data.after.name])),
      this.updateObjectAnnotations(before, clonedObject, changes),
    ])
    return clonedObject
  }

  private async updateObjectAnnotations(before: ObjectType, clonedObject: ObjectType,
    changes: ReadonlyArray<Change<Field | ObjectType>>): Promise<SaveResult[]> {
    if (changes.some(c => isObjectType(getChangeElement(c)))
      && !_.isEqual(toCustomObject(before, false), toCustomObject(clonedObject, false))) {
      // Update object without its fields
      return this.client.update(
        metadataType(clonedObject),
        toCustomObject(clonedObject, false)
      )
    }
    return []
  }

  private async deleteRemovedMetadataObjects(oldInstance: InstanceElement,
    newInstance: InstanceElement, fieldName: string, withObjectPrefix: boolean): Promise<void> {
    const getDeletedObjectsNames = (oldObjects: Values[], newObjects: Values[]): string[] => {
      const newObjectsNames = newObjects.map(o => o.fullName)
      const oldObjectsNames = oldObjects.map(o => o.fullName)
      return oldObjectsNames.filter(o => !newObjectsNames.includes(o))
    }

    const fieldType = newInstance.type.fields[fieldName]?.type
    if (_.isUndefined(fieldType)) {
      return
    }
    const metadataTypeName = metadataType(fieldType)
    const deletedObjects = getDeletedObjectsNames(
      makeArray(oldInstance.value[fieldName]), makeArray(newInstance.value[fieldName])
    ).map(o => (withObjectPrefix ? [oldInstance.value.fullName, o] : [o])
      .join(constants.API_NAME_SEPERATOR))
    if (!_.isEmpty(deletedObjects)) {
      await this.client.delete(metadataTypeName, deletedObjects)
    }
  }

  /**
   * Update an instance
   * @param prevInstance The metadata of the old instance
   * @param newInstance The new metadata of the instance to replace
   * @returns the updated instance
   */
  private async updateInstance(prevInstance: InstanceElement, newInstance: InstanceElement):
    Promise<InstanceElement> {
    validateApiName(prevInstance, newInstance)
    const typeName = metadataType(newInstance)
    if (this.metadataTypesToSkipMutation.includes(typeName)) {
      return newInstance
    }

    if (Object.keys(this.nestedMetadataTypes).includes(typeName)) {
      // Checks if we need to delete metadata objects
      this.nestedMetadataTypes[typeName]
        .forEach(fieldName =>
          this.deleteRemovedMetadataObjects(
            prevInstance,
            newInstance,
            fieldName,
            Object.keys(nestedIDMetadataTypes).includes(typeName)
          ))
    }

    if (isCustomObject(newInstance.type)) {
      await this.client.bulkLoadOperation(
        apiName(newInstance.type),
        'update',
        instancesToUpdateRecords([newInstance])
      )
    } else if (this.metadataToDeploy.includes(typeName)) {
      await this.deployInstance(newInstance)
    } else if (this.metadataTypesToUseUpsertUponUpdate.includes(typeName)) {
      await this.client.upsert(typeName, toMetadataInfo(apiName(newInstance), newInstance.value))
    } else {
      await this.client.update(typeName, toMetadataInfo(
        apiName(newInstance),
        // As SALTO-79 Conclusions we decided to send the entire newInstance to salesforce API
        // instead of only the delta (changes between newInstance & prevInstance).
        // until we have a better understanding of update behavior for all fields types.
        newInstance.value
      ))
    }

    return newInstance
  }

  /**
   * Updates custom fields
   * @param fieldsToUpdate The fields to update
   * @returns successfully managed to update all fields
   */
  private async updateFields(fieldsToUpdate: Field[]): Promise<SaveResult[]> {
    return this.client.update(
      constants.CUSTOM_FIELD,
      fieldsToUpdate.map(f => toCustomField(f, true)),
    )
  }

  /**
   * Creates custom fields and their corresponding field permissions
   * @param fieldsToAdd The fields to create
   * @returns successfully managed to create all fields with their permissions or not
   */
  private async createFields(fieldsToAdd: Field[]): Promise<UpsertResult[]> {
    return this.client.upsert(
      constants.CUSTOM_FIELD,
      fieldsToAdd.map(f => toCustomField(f, true)),
    )
  }

  /**
   * Deletes custom fields
   * @param fields the custom fields we wish to delete
   */
  private async deleteCustomFields(fields: Field[]): Promise<SaveResult[]> {
    return this.client.delete(constants.CUSTOM_FIELD, fields
      .map(field => apiName(field)))
  }

  private async deployElementChanges(elemChanges: ReadonlyArray<Change>): Promise<DeployResult> {
    const getMainElemChange = (): Change => {
      const mainElemChange = elemChanges.find(
        change => getChangeElement(change).elemID.isTopLevel()
      )
      if (mainElemChange !== undefined) {
        return mainElemChange
      }
      // No changes on the top level element, we have to find the before and after objects
      // This is temporary code until we change the internal implementation of the adapter to
      // handle changes without relying on getting the top level elements
      const getBeforeAndAfterElements = (): { before: ObjectType; after: ObjectType } => {
        const updateChange = elemChanges.filter(isFieldChange).filter(isModificationDiff).pop()
        if (updateChange !== undefined) {
          return { before: updateChange.data.before.parent, after: updateChange.data.after.parent }
        }
        const removeChanges = elemChanges.filter(isFieldChange).filter(isRemovalDiff)
        const removedFields = removeChanges.map(change => change.data.before.name)
        const addChanges = elemChanges.filter(isFieldChange).filter(isAdditionDiff)
        const addedFields = addChanges.map(change => change.data.after.name)
        const before = removeChanges.length !== 0
          ? removeChanges[0].data.before.parent
          : new ObjectType({
            ...addChanges[0].data.after.parent,
            fields: _.omit(addChanges[0].data.after.parent.fields, addedFields),
          })
        const after = addChanges.length !== 0
          ? addChanges[0].data.after.parent
          : new ObjectType({
            ...removeChanges[0].data.before.parent,
            fields: _.omit(removeChanges[0].data.before.parent.fields, removedFields),
          })
        return { before, after }
      }
      return { action: 'modify', data: getBeforeAndAfterElements() }
    }
    const mainChange = getMainElemChange()
    if (!(isInstanceChange(mainChange) || isObjectTypeChange(mainChange))) {
      return {
        appliedChanges: [],
        errors: [new Error('only Instance or ObjectType changes supported')],
      }
    }
    try {
      if (mainChange.action === 'add') {
        const after = await this.add(mainChange.data.after)
        return {
          appliedChanges: [{ ...mainChange, data: { after } }],
          errors: [],
        }
      }
      if (mainChange.action === 'remove') {
        await this.remove(mainChange.data.before)
        return {
          appliedChanges: [mainChange],
          errors: [],
        }
      }
      const after = await this.update(
        mainChange.data.before, mainChange.data.after, elemChanges,
      )
      return {
        appliedChanges: [{ ...mainChange, data: { ...mainChange.data, after } }],
        errors: [],
      }
    } catch (e) {
      return {
        appliedChanges: [],
        errors: [e],
      }
    }
  }

  private async listMetadataTypes(): Promise<MetadataObject[]> {
    return [
      ...await this.client.listMetadataTypes(),
      ...this.metadataAdditionalTypes.map(xmlName => ({
        xmlName,
        childXmlNames: [],
        directoryName: '',
        inFolder: false,
        metaFile: false,
        suffix: '',
      })),
    ].filter(info => !this.metadataTypesSkippedList.includes(info.xmlName))
  }

  @logDuration('fetching metadata types')
  private async fetchMetadataTypes(
    typeInfoPromise: Promise<MetadataObject[]>,
    knownMetadataTypes: TypeElement[],
  ): Promise<TypeElement[]> {
    const typeInfos = await typeInfoPromise
    const knownTypes = new Map<string, TypeElement>(
      knownMetadataTypes.map(mdType => [apiName(mdType), mdType])
    )
    return _.flatten(await Promise.all((typeInfos).map(typeInfo => this.fetchMetadataType(
      typeInfo, knownTypes, new Set(typeInfos.map(type => type.xmlName)),
    ))))
  }

  private async fetchMetadataType(
    typeInfo: MetadataObject,
    knownTypes: Map<string, TypeElement>,
    baseTypeNames: Set<string>
  ): Promise<TypeElement[]> {
    const typeDesc = await this.client.describeMetadataType(typeInfo.xmlName)
    const folderType = typeInfo.inFolder ? typeDesc.parentField?.foreignKeyDomain : undefined
    const mainTypes = await createMetadataTypeElements({
      name: typeInfo.xmlName,
      fields: typeDesc.valueTypeFields,
      knownTypes,
      baseTypeNames,
      client: this.client,
      annotations: { hasMetaFile: typeInfo.metaFile ? true : undefined, folderType },
    })
    const folderTypes = folderType === undefined
      ? []
      : await createMetadataTypeElements({
        name: folderType,
        fields: (await this.client.describeMetadataType(folderType)).valueTypeFields,
        knownTypes,
        baseTypeNames,
        client: this.client,
        annotations: { hasMetaFile: true, isFolder: true },
      })
    return [...mainTypes, ...folderTypes]
  }

  @logDuration('fetching instances')
  private async fetchMetadataInstances(
    typeInfoPromise: Promise<MetadataObject[]>, types: Promise<TypeElement[]>
  ): Promise<FetchElements<InstanceElement[]>> {
    const readInstances = async (metadataTypesToRead: ObjectType[]):
      Promise<FetchElements<InstanceElement[]>> => {
      const result = await Promise.all(metadataTypesToRead
        // Just fetch metadata instances of the types that we receive from the describe call
        .filter(type => !this.metadataAdditionalTypes.includes(apiName(type)))
        .map(async type => {
          const { elements, configChanges } = await this.listMetadataInstances(apiName(type))
          return {
            elements: elements
              .filter(elem => !_.isEmpty(elem.instanceInfo))
              .map(elem => createInstanceElement(elem.instanceInfo, type, elem.namespace)),
            configChanges,
          }
        }))
      return {
        elements: _.flatten(result.map(r => r.elements)),
        configChanges: _.flatten(result.map(r => r.configChanges)),
      }
    }

    const typeInfos = await typeInfoPromise
    const topLevelTypeNames = typeInfos.map(info => info.xmlName)
    const topLevelTypes = (await types)
      .filter(isObjectType)
      .filter(t => topLevelTypeNames.includes(apiName(t)) || t.annotations[IS_FOLDER] === true)

    const [metadataTypesToRetrieve, metadataTypesToRead] = _.partition(
      topLevelTypes,
      t => this.metadataToRetrieve.includes(apiName(t)),
    )

    const allInstances = await Promise.all([
      retrieveMetadataInstances({
        client: this.client,
        types: metadataTypesToRetrieve,
        instancesRegexSkippedList: this.instancesRegexSkippedList,
        maxItemsInRetrieveRequest: this.maxItemsInRetrieveRequest,
        maxConcurrentRetrieveRequests: this.maxConcurrentRetrieveRequests,
      }),
      readInstances(metadataTypesToRead),
    ])
    return {
      elements: _.flatten(allInstances.map(instances => instances.elements)),
      configChanges: _.flatten(allInstances.map(instances => instances.configChanges)),
    }
  }

  /**
   * List all the instances of specific metadataType
   * @param type the metadata type
   */
  private async listMetadataInstances(type: string):
  Promise<FetchElements<NamespaceAndInstances[]>> {
    const { result: objs, errors: listErrors } = await this.client.listMetadataObjects({ type })
    const listObjectsConfigChanges = listErrors.map(createListMetadataObjectsConfigChange)
    if (!objs) {
      return { elements: [], configChanges: listObjectsConfigChanges }
    }
    const getFullName = (obj: FileProperties): string => {
      const namePrefix = obj.namespacePrefix
        ? `${obj.namespacePrefix}${constants.NAMESPACE_SEPARATOR}` : ''
      return obj.fullName.startsWith(namePrefix) ? obj.fullName : `${namePrefix}${obj.fullName}`
    }
    const fullNameToNamespace = _(objs)
      .map(obj => [getFullName(obj), obj.namespacePrefix])
      .fromPairs()
      .value()

    const instancesFullNames = objs.map(getFullName)
      .filter(name => !instanceNameMatchRegex(`${type}.${name}`, this.instancesRegexSkippedList))
    const readMetadataResult = await this.client.readMetadata(type, instancesFullNames)
    const readMetadataConfigChanges = readMetadataResult.errors
      .map(e => createSkippedListConfigChange(type, e))

    return {
      elements: readMetadataResult.result.map(instanceInfo =>
        ({ namespace: fullNameToNamespace[instanceInfo.fullName], instanceInfo })),
      configChanges: [...readMetadataConfigChanges, ...listObjectsConfigChanges],
    }
  }
}
