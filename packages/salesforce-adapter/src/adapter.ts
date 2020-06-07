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
} from '@salto-io/adapter-api'
import {
  resolveValues, restoreValues,
} from '@salto-io/adapter-utils'
import {
  SaveResult, MetadataInfo, FileProperties, ListMetadataQuery,
  UpsertResult, RetrieveResult, RetrieveRequest,
} from 'jsforce'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { decorators, collections, promises } from '@salto-io/lowerdash'
import SalesforceClient, { API_VERSION } from './client/client'
import * as constants from './constants'
import {
  toCustomField, toCustomObject, apiName, Types, toMetadataInfo, createInstanceElement,
  metadataType, createMetadataTypeElements,
  defaultApiName, getLookUpName,
} from './transformers/transformer'
import { fromRetrieveResult, toMetadataPackageZip } from './transformers/xml_transformer'
import layoutFilter from './filters/layouts'
import customObjectsFilter from './filters/custom_objects'
import customObjectsSplitFilter from './filters/custom_object_split'
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
import { ConfigChangeSuggestion, FetchElements, SalesforceConfig } from './types'
import { createListMetadataObjectsConfigChange, createSkippedListConfigChange,
  createRetrieveConfigChange, getConfigFromConfigChanges,
  STOP_MANAGING_ITEMS_MSG } from './config_change'
import { FilterCreator, Filter, filtersRunner } from './filter'
import { id, addApiName, addMetadataType, addLabel } from './filters/utils'

const { makeArray } = collections.array
const { withLimitedConcurrency } = promises.array
const log = logger(module)

export const DEFAULT_FILTERS = [
  // should run before missingFieldsFilter
  settingsFilter,
  missingFieldsFilter,
  // should run before customObjectsFilter
  workflowFilter,
  // customObjectsFilter depends on missingFieldsFilter and settingsFilter
  customObjectsFilter,
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
  customObjectsSplitFilter,
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
  hideTypesInNacls?: boolean

  // Metadata types that we have to fetch using the retrieve API endpoint and add update or remove
  // using the deploy API endpoint
  metadataToRetrieveAndDeploy?: Record<string, string | undefined>

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
type RetrieveMember = {
  type: string
  name: string
}

export default class SalesforceAdapter {
  private hideTypesInNacls: boolean
  private metadataTypesSkippedList: string[]
  private instancesRegexSkippedList: RegExp[]
  private maxConcurrentRetrieveRequests: number
  private maxItemsInRetrieveRequest: number
  private metadataToRetrieveAndDeploy: Record<string, string | undefined>
  private metadataAdditionalTypes: string[]
  private metadataTypesToSkipMutation: string[]
  private metadataTypesToUseUpsertUponUpdate: string[]
  private nestedMetadataTypes: Record<string, string[]>
  private filtersRunner: Required<Filter>
  private client: SalesforceClient
  private systemFields: string[]
  private userConfig: SalesforceConfig

  public constructor({
    hideTypesInNacls = constants.DEFAULT_HIDE_TYPES_IN_NACLS,
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
    metadataToRetrieveAndDeploy = {
      ApexClass: undefined, // readMetadata is not supported, contains encoded zip content
      ApexTrigger: undefined, // readMetadata is not supported, contains encoded zip content
      ApexPage: undefined, // contains encoded zip content
      ApexComponent: undefined, // contains encoded zip content
      AssignmentRules: undefined,
      InstalledPackage: undefined, // listMetadataObjects of this types returns duplicates
      EmailTemplate: 'EmailFolder', // contains encoded zip content, is under a folder
      ReportType: undefined,
      Report: 'ReportFolder',
      Dashboard: 'DashboardFolder',
      SharingRules: undefined, // upsert does not work for creating rules
    },
    metadataAdditionalTypes = [
      'ProfileUserPermission',
      'EmailFolder',
      'ReportFolder',
      'DashboardFolder',
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
    this.hideTypesInNacls = config.hideTypesInNacls ?? hideTypesInNacls
    this.metadataTypesSkippedList = metadataTypesSkippedList
      .concat(makeArray(config.metadataTypesSkippedList))
    this.instancesRegexSkippedList = instancesRegexSkippedList
      .concat(makeArray(config.instancesRegexSkippedList))
      .map(e => new RegExp(e))
    this.maxConcurrentRetrieveRequests = config.maxConcurrentRetrieveRequests
      ?? maxConcurrentRetrieveRequests
    this.maxItemsInRetrieveRequest = config.maxItemsInRetrieveRequest ?? maxItemsInRetrieveRequest
    this.metadataToRetrieveAndDeploy = metadataToRetrieveAndDeploy
    this.userConfig = config
    this.metadataAdditionalTypes = metadataAdditionalTypes
    this.metadataTypesToSkipMutation = metadataTypesToSkipMutation
    this.metadataTypesToUseUpsertUponUpdate = metadataTypesToUseUpsertUponUpdate
    this.nestedMetadataTypes = nestedMetadataTypes
    this.client = client
    this.filtersRunner = filtersRunner(
      this.client,
      {
        instancesRegexSkippedList: this.instancesRegexSkippedList,
        metadataTypesSkippedList: this.metadataTypesSkippedList,
        unsupportedSystemFields,
      },
      filterCreators
    )
    this.systemFields = systemFields
    if (getElemIdFunc) {
      Types.setElemIdGetter(getElemIdFunc)
    }
  }

  /**
   * Fetch configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  public async fetch(): Promise<FetchResult> {
    log.debug('going to fetch salesforce account configuration..')
    const fieldTypes = Types.getAllFieldTypes()
    const missingTypes = Types.getAllMissingTypes()
    const annotationTypes = Types.getAnnotationTypes()
    const metadataTypeNames = this.listMetadataTypes()
    const metadataTypes = this.fetchMetadataTypes(
      metadataTypeNames,
      annotationTypes,
      this.hideTypesInNacls,
    )
    const metadataInstances = this.fetchMetadataInstances(metadataTypeNames, metadataTypes)

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

  /**
   * Add new element
   * @param element the object/instance to add
   * @returns the updated element with extra info like api name, label and metadata type
   * @throws error in case of failure
   */
  public async add(element: Element): Promise<Element> {
    let post: Element
    const resolved = resolveValues(element, getLookUpName)
    if (isObjectType(resolved)) {
      post = await this.addObject(resolved)
    } else {
      post = await this.addInstance(resolved as InstanceElement)
    }

    await this.filtersRunner.onAdd(post)
    return restoreValues(element, post, getLookUpName)
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
    addInstanceDefaults(post)
    if (this.isMetadataTypeToRetrieveAndDeploy(type)) {
      await this.deployInstance(post)
    } else if (!this.metadataTypesToSkipMutation.includes(metadataType(post))) {
      await this.client.upsert(type, toMetadataInfo(apiName(post), post.value))
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
  public async remove(element: Element): Promise<void> {
    const resolved = resolveValues(element, getLookUpName)
    const type = metadataType(resolved)
    if (isInstanceElement(resolved)
      && this.isMetadataTypeToRetrieveAndDeploy(type)) {
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
  public async update(before: Element, after: Element,
    changes: ReadonlyArray<Change>): Promise<Element> {
    const resBefore = resolveValues(before, getLookUpName)
    const resAfter = resolveValues(after, getLookUpName)
    const resChanges = changes.map(c => ({
      action: c.action,
      data: _.mapValues(c.data, (x => resolveValues(x, getLookUpName))),
    })) as ReadonlyArray<Change<Field | ObjectType>>
    let result = resAfter
    if (isObjectType(resBefore) && isObjectType(resAfter)) {
      result = await this.updateObject(
        resBefore,
        resAfter,
        resChanges
      )
    }

    if (isInstanceElement(resBefore) && isInstanceElement(resAfter)) {
      result = await this.updateInstance(resBefore, resAfter)
    }

    // Aspects should be updated once all object related properties updates are over
    await this.filtersRunner.onUpdate(resBefore, result, resChanges)
    return restoreValues(after, result, getLookUpName)
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

    if (this.isMetadataTypeToRetrieveAndDeploy(typeName)) {
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

  private async listMetadataTypes(): Promise<string[]> {
    return this.client.listMetadataTypes().then(
      types => types
        .map(x => x.xmlName)
        .concat(this.metadataAdditionalTypes)
        .filter(name => !this.metadataTypesSkippedList.includes(name))
    )
  }

  @logDuration('fetching metadata types')
  private async fetchMetadataTypes(
    typeNamesPromise: Promise<string[]>,
    knownMetadataTypes: TypeElement[],
    _hideTypesInNacls: boolean, // Will be use in the next PR
  ): Promise<TypeElement[]> {
    const typeNames = await typeNamesPromise
    const knownTypes = new Map<string, TypeElement>(
      knownMetadataTypes.map(mdType => [apiName(mdType), mdType])
    )
    return _.flatten(await Promise.all((typeNames)
      .map(typeName => this.fetchMetadataType(typeName, knownTypes, new Set(typeNames)))))
  }

  private async fetchMetadataType(
    objectName: string,
    knownTypes: Map<string, TypeElement>,
    baseTypeNames: Set<string>
  ): Promise<TypeElement[]> {
    const fields = await this.client.describeMetadataType(objectName)
    return createMetadataTypeElements(objectName, fields, knownTypes, baseTypeNames, this.client)
  }

  private async retrieveMetadata(metadataTypes: string[]):
  Promise<FetchElements<Record<string, NamespaceAndInstances[]>>> {
    const getFolders = async (typeToRetrieve: string):
    Promise<FetchElements<FileProperties[]>> => {
      const folderType = this.metadataToRetrieveAndDeploy[typeToRetrieve]
      if (folderType) {
        const { errors, result } = await this.client.listMetadataObjects({ type: folderType })
        return {
          elements: result,
          configChanges: errors.map(createListMetadataObjectsConfigChange),
        }
      }
      return { elements: [], configChanges: [] }
    }

    const isFolder = (type: string): boolean =>
      Object.values(this.metadataToRetrieveAndDeploy).includes(type)

    const retrieveMetadataTypes = metadataTypes
      .filter(type => !isFolder(type))
      .filter(type => !this.metadataTypesSkippedList.includes(type))
    const retrieveTypeAndFiles = await Promise.all(
      retrieveMetadataTypes
        .map(async type => {
          const { elements: folders, configChanges } = await getFolders(type)
          let listMetadataQuery: ListMetadataQuery | ListMetadataQuery[]
          if (_.isEmpty(folders)) {
            listMetadataQuery = { type }
          } else {
            listMetadataQuery = folders
              .filter(folder => !instanceNameMatchRegex(
                `${type}.${folder.fullName}`,
                this.instancesRegexSkippedList
              ))
              .map(folder => ({ type, folder: folder.fullName }))
          }
          const { result: objs, errors } = await this.client.listMetadataObjects(listMetadataQuery)
          return {
            configChanges: _.flatten([
              configChanges,
              errors.map(createListMetadataObjectsConfigChange),
            ]),
            retrieveTypeAndFiles: [type, [...objs, ...folders]],
          }
        })
    )
    const listTypesConfigChanges = _.flatten(retrieveTypeAndFiles.map(r => r.configChanges))
    const retrieveTypeToFiles: Record<string, FileProperties[]> = _
      .fromPairs(retrieveTypeAndFiles.map(r => r.retrieveTypeAndFiles))

    const retrieveMembers: RetrieveMember[] = _(retrieveTypeToFiles)
      .entries()
      .map(([type, files]) => _(files)
        .map(constants.INSTANCE_FULL_NAME_FIELD)
        .uniq()
        .filter(name => !instanceNameMatchRegex(`${type}.${name}`, this.instancesRegexSkippedList))
        .map(name => ({ type, name }))
        .value())
      .flatten()
      .value()

    const { elements: typeToInstanceInfos, configChanges } = await this.retrieveChunked(
      retrieveMembers, metadataTypes
    )
    const fullNameToNamespace: Record<string, string> = _(Object.values(retrieveTypeToFiles))
      .flatten()
      .map(file => [file.fullName, file.namespacePrefix])
      .fromPairs()
      .value()
    return {
      elements: _(Object.entries(typeToInstanceInfos))
        .map(([type, instanceInfos]) =>
          [type, instanceInfos.map(instanceInfo =>
            ({ namespace: fullNameToNamespace[instanceInfo.fullName], instanceInfo }))])
        .fromPairs()
        .value(),
      configChanges: [...configChanges, ...listTypesConfigChanges],
    }
  }

  private async retrieveChunked(retrieveMembers: RetrieveMember[], metadataTypes: string[]):
    Promise<FetchElements<Record<string, MetadataInfo[]>>> {
    const fromRetrieveResults = async (retrieveResults: RetrieveResult[]):
      Promise<Record<string, MetadataInfo[]>> => {
      const typesToInstances = await Promise.all(retrieveResults
        .map(async retrieveResult => fromRetrieveResult(retrieveResult, metadataTypes)))
      return _.mergeWith({}, ...typesToInstances,
        (objValue: MetadataInfo[], srcValue: MetadataInfo[]) =>
          _.concat(makeArray(objValue), srcValue))
    }

    const createRetrieveRequest = (membersChunk: RetrieveMember[]): RetrieveRequest => {
      const typeToMembers = _.groupBy(membersChunk, retrieveMember => retrieveMember.type)
      return {
        apiVersion: API_VERSION,
        singlePackage: false,
        unpackaged: {
          types: Object.entries(typeToMembers).map(([type, members]) =>
            ({
              name: type,
              members: members.map(member => member.name),
            })),
        },
      }
    }

    const chunkedRetrieveMembers = _.chunk(retrieveMembers, this.maxItemsInRetrieveRequest)
    const retrieveResults = _.flatten(
      await withLimitedConcurrency(chunkedRetrieveMembers.map(
        retrieveChunk => () => this.client.retrieve(createRetrieveRequest(retrieveChunk))
      ), this.maxConcurrentRetrieveRequests)
    )

    return {
      elements: await fromRetrieveResults(retrieveResults),
      configChanges: _.flatten(retrieveResults.map(createRetrieveConfigChange)),
    }
  }

  @logDuration('fetching instances')
  private async fetchMetadataInstances(typeNames: Promise<string[]>, types: Promise<TypeElement[]>):
    Promise<FetchElements<InstanceElement[]>> {
    type TypeAndInstances = { type: ObjectType; namespaceAndInstances: NamespaceAndInstances[] }
    const readInstances = async (metadataTypesToRead: ObjectType[]):
      Promise<FetchElements<TypeAndInstances[]>> => {
      const result = await Promise.all(metadataTypesToRead
        // Just fetch metadata instances of the types that we receive from the describe call
        .filter(type => !this.metadataAdditionalTypes.includes(apiName(type)))
        .map(async type => {
          const { elements, configChanges } = await this.listMetadataInstances(apiName(type))
          return { elements: { type, namespaceAndInstances: elements }, configChanges }
        }))
      return {
        elements: _.flatten(result.map(r => r.elements)),
        configChanges: _.flatten(result.map(r => r.configChanges)),
      }
    }

    const retrieveInstances = async (metadataTypesToRetrieve: ObjectType[]):
      Promise<FetchElements<TypeAndInstances[]>> => {
      const nameToType: Record<string, ObjectType> = _(metadataTypesToRetrieve)
        .map(t => [apiName(t), t])
        .fromPairs()
        .value()
      const { elements: typeNameToNamespaceAndInfos, configChanges } = await this.retrieveMetadata(
        Object.keys(nameToType)
      )
      return {
        elements: Object.entries(typeNameToNamespaceAndInfos)
          .map(([typeName, namespaceAndInstances]) =>
            ({ type: nameToType[typeName], namespaceAndInstances })),
        configChanges,
      }
    }

    const topLevelTypeNames = await typeNames
    const topLevelTypes = (await types)
      .filter(isObjectType)
      .filter(t => topLevelTypeNames.includes(apiName(t)))

    const [metadataTypesToRetrieve, metadataTypesToRead] = _.partition(
      topLevelTypes,
      t => this.isMetadataTypeToRetrieveAndDeploy(metadataType(t)),
    )

    const [retrievedInstances, instances] = await Promise.all(
      [retrieveInstances(metadataTypesToRetrieve), readInstances(metadataTypesToRead)]
    )
    const typesAndInstances = _.flatten([retrievedInstances.elements, instances.elements])
    return {
      elements: _(typesAndInstances)
        .map(typeAndInstances => typeAndInstances.namespaceAndInstances
          .filter(namespaceAndInstance => !_.isEmpty(namespaceAndInstance))
          .filter(namespaceAndInstance => namespaceAndInstance.instanceInfo.fullName !== undefined)
          .map(namespaceAndInstance => createInstanceElement(namespaceAndInstance.instanceInfo,
            typeAndInstances.type, namespaceAndInstance.namespace)))
        .flatten()
        .value(),
      configChanges: _.flatten([instances.configChanges, retrievedInstances.configChanges]),
    }
  }

  private isMetadataTypeToRetrieveAndDeploy(type: string): boolean {
    return [...Object.keys(this.metadataToRetrieveAndDeploy),
      ...Object.values(this.metadataToRetrieveAndDeploy)].includes(type)
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
