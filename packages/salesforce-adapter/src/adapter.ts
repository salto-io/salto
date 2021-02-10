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
  TypeElement, ObjectType, InstanceElement, isAdditionChange, Element, getChangeElement,
  ElemIdGetter, FetchResult, AdapterOperations, DeployResult, FetchOptions, DeployOptions,
} from '@salto-io/adapter-api'
import { resolveChangeElement, restoreChangeElement, logDuration } from '@salto-io/adapter-utils'
import { MetadataObject } from 'jsforce'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import SalesforceClient from './client/client'
import * as constants from './constants'
import {
  apiName, Types, isMetadataObjectType,
} from './transformers/transformer'
import layoutFilter from './filters/layouts'
import customObjectsFilter, { NESTED_INSTANCE_VALUE_TO_TYPE_NAME } from './filters/custom_objects'
import customSettingsFilter from './filters/custom_settings_filter'
import customObjectsSplitFilter from './filters/custom_object_split'
import profileInstanceSplitFilter from './filters/profile_instance_split'
import customObjectsInstancesFilter from './filters/custom_objects_instances'
import profilePermissionsFilter from './filters/profile_permissions'
import convertListsFilter from './filters/convert_lists'
import convertTypeFilter from './filters/convert_types'
import missingFieldsFilter from './filters/missing_fields'
import removeFieldsAndValuesFilter from './filters/remove_fields_and_values'
import standardValueSetFilter from './filters/standard_value_sets'
import flowFilter from './filters/flow'
import addMissingIdsFilter from './filters/add_missing_ids'
import animationRulesFilter from './filters/animation_rules'
import samlInitMethodFilter from './filters/saml_initiation_method'
import settingsFilter from './filters/settings_type'
import workflowFilter, { WORKFLOW_FIELD_TO_TYPE } from './filters/workflow'
import topicsForObjectsFilter from './filters/topics_for_objects'
import globalValueSetFilter from './filters/global_value_sets'
import referenceAnnotationsFilter from './filters/reference_annotations'
import fieldReferencesFilter from './filters/field_references'
import customObjectInstanceReferencesFilter from './filters/custom_object_instances_references'
import foreignKeyReferencesFilter from './filters/foreign_key_references'
import valueSetFilter from './filters/value_set'
import cpqLookupFieldsFilter from './filters/cpq/lookup_fields'
import cpqCustomScriptFilter from './filters/cpq/custom_script'
import customFeedFilterFilter, { CUSTOM_FEED_FILTER_METADATA_TYPE } from './filters/custom_feed_filter'
import extraDependenciesFilter from './filters/extra_dependencies'
import staticResourceFileExtFilter from './filters/static_resource_file_ext'
import xmlAttributesFilter from './filters/xml_attributes'
import profilePathsFilter from './filters/profile_paths'
import replaceFieldValuesFilter from './filters/replace_instance_field_values'
import valueToStaticFileFilter from './filters/value_to_static_file'
import convertMapsFilter from './filters/convert_maps'
import elementsUrlFilter from './filters/elements_url'
import { ConfigChangeSuggestion, FetchElements, SalesforceConfig } from './types'
import { getConfigFromConfigChanges, getConfigChangeMessage } from './config_change'
import { FilterCreator, Filter, filtersRunner } from './filter'
import { addDefaults } from './filters/utils'
import { retrieveMetadataInstances, fetchMetadataType, fetchMetadataInstances, listMetadataObjects } from './fetch'
import { isCustomObjectInstanceChanges, deployCustomObjectInstancesGroup } from './custom_object_instances_deploy'
import { getLookUpName } from './transformers/reference_mapping'
import { deployMetadata, NestedMetadataTypeInfo } from './metadata_deploy'

const { makeArray } = collections.array
const log = logger(module)

export const DEFAULT_FILTERS = [
  // should run before missingFieldsFilter
  settingsFilter,
  customFeedFilterFilter,
  missingFieldsFilter,
  // should run before customObjectsFilter
  workflowFilter,
  // customObjectsFilter depends on missingFieldsFilter and settingsFilter
  customObjectsFilter,
  // customSettingsFilter depends on customObjectsFilter
  customSettingsFilter,
  // customObjectsInstancesFilter depends on customObjectsFilter
  customObjectsInstancesFilter,
  removeFieldsAndValuesFilter,
  // addMissingIdsFilter should run after customObjectsFilter
  addMissingIdsFilter,
  layoutFilter,
  // profilePermissionsFilter depends on layoutFilter because layoutFilter
  // changes ElemIDs that the profile references
  profilePermissionsFilter,
  // profileMapsFilter should run before profile fieldReferencesFilter
  convertMapsFilter,
  standardValueSetFilter,
  flowFilter,
  customObjectInstanceReferencesFilter,
  cpqCustomScriptFilter,
  cpqLookupFieldsFilter,
  animationRulesFilter,
  samlInitMethodFilter,
  topicsForObjectsFilter,
  valueSetFilter,
  globalValueSetFilter,
  staticResourceFileExtFilter,
  xmlAttributesFilter,
  profilePathsFilter,
  elementsUrlFilter,
  // The following filters should remain last in order to make sure they fix all elements
  convertListsFilter,
  convertTypeFilter,
  replaceFieldValuesFilter,
  valueToStaticFileFilter,
  fieldReferencesFilter,
  // should run after customObjectsInstancesFilter for now
  referenceAnnotationsFilter,
  // foreignLeyReferences should come after referenceAnnotationsFilter
  foreignKeyReferencesFilter,
  // extraDependenciesFilter should run after addMissingIdsFilter
  extraDependenciesFilter,
  customObjectsSplitFilter,
  profileInstanceSplitFilter,
]

export interface SalesforceAdapterParams {
  // Metadata types that we want to fetch that exist in the SOAP API but not in the metadata API
  metadataAdditionalTypes?: string[]

  // Regular expressions for instances that we want to exclude from readMetadata
  // The regular expression would be matched against instances of the format METADATA_TYPE.INSTANCE
  // For example: CustomObject.Lead
  instancesRegexSkippedList?: string[]

  // Max items to fetch in one retrieve request
  maxItemsInRetrieveRequest?: number

  // Metadata types that we do not want to fetch even though they are returned as top level
  // types from the API
  metadataTypesSkippedList?: string[]

  // Metadata types that are being fetched in the filters
  metadataTypesOfInstancesFetchedInFilters?: string[]

  // Work with list-based profiles instead of map-based ones
  useOldProfiles?: boolean

  // Metadata types that we have to fetch using the retrieve API
  metadataToRetrieve?: string[]

  // Metadata types that we should not create, update or delete in the main adapter code
  metadataTypesToSkipMutation?: string[]

  // Metadata types that that include metadata types inside them
  nestedMetadataTypes?: Record<string, NestedMetadataTypeInfo>

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

const metadataToRetrieveAndDeploy = [
  // Metadata with content - we use retrieve to get the StaticFiles properly
  'ApexClass', // contains encoded zip content
  'ApexComponent', // contains encoded zip content
  'ApexPage', // contains encoded zip content
  'ApexTrigger', // contains encoded zip content
  'AssignmentRules', // contains encoded zip content
  'AuraDefinitionBundle', // Has several fields with base64Binary encoded content
  'Certificate', // contains encoded zip content
  'ContentAsset', // contains encoded zip content
  'Dashboard', // contains encoded zip content, is under a folder
  'DashboardFolder',
  'Document', // contains encoded zip content, is under a folder
  'DocumentFolder',
  'EclairGeoData', // contains encoded zip content
  'EmailFolder',
  'EmailTemplate', // contains encoded zip content, is under a folder
  'LightningComponentBundle', // Has several fields with base64Binary encoded content
  'NetworkBranding', // contains encoded zip content
  'Report', // contains encoded zip content, is under a folder
  'ReportFolder',
  'ReportType',
  'Scontrol', // contains encoded zip content
  'SiteDotCom', // contains encoded zip content
  'StaticResource', // contains encoded zip content
  // Other types that need retrieve / deploy to work
  'InstalledPackage', // listMetadataObjects of this types returns duplicates
  'Territory2', // All Territory2 types do not support CRUD
  'Territory2Model', // All Territory2 types do not support CRUD
  'Territory2Rule', // All Territory2 types do not support CRUD
  'Territory2Type', // All Territory2 types do not support CRUD
]

// See: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_custom_object__c.htm
export const allSystemFields = [
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
  'SetupOwnerId',
]

export default class SalesforceAdapter implements AdapterOperations {
  private metadataTypesSkippedList: string[]
  private instancesRegexSkippedList: RegExp[]
  private maxItemsInRetrieveRequest: number
  private metadataToRetrieve: string[]
  private metadataAdditionalTypes: string[]
  private metadataTypesOfInstancesFetchedInFilters: string[]
  private nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>
  private filtersRunner: Required<Filter>
  private client: SalesforceClient
  private userConfig: SalesforceConfig

  public constructor({
    metadataTypesSkippedList = [
      'CustomField', // We have special treatment for this type
      constants.SETTINGS_METADATA_TYPE,
      'FlowDefinition', // Only has the active flow version but we cant get flow versions anyway
      'CustomIndex', // readMetadata and retrieve fail on this type when fetching by name
      // readMetadata fails on those and pass on the parents (AssignmentRules and EscalationRules)
      'AssignmentRule', 'EscalationRule',
    ],
    metadataTypesOfInstancesFetchedInFilters = [CUSTOM_FEED_FILTER_METADATA_TYPE],
    instancesRegexSkippedList = [],
    maxItemsInRetrieveRequest = constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
    metadataToRetrieve = metadataToRetrieveAndDeploy,
    metadataAdditionalTypes = [
      'ProfileUserPermission',
      'WorkflowAlert',
      'WorkflowFieldUpdate',
      'WorkflowFlowAction',
      'WorkflowKnowledgePublish',
      'WorkflowOutboundMessage',
      'WorkflowTask',
      'KnowledgeCaseFieldsSettings',
      'KnowledgeCaseField',
      'KnowledgeWorkOrderFieldsSettings',
      'KnowledgeWorkOrderField',
      'KnowledgeWorkOrderLineItemFieldsSettings',
      'KnowledgeWorkOrderLineItemField',
      'PermissionSetApplicationVisibility',
      'PermissionSetApexClassAccess',
      'PermissionSetCustomMetadataTypeAccess',
      'PermissionSetCustomPermissions',
      'PermissionSetCustomSettingAccesses',
      'PermissionSetExternalDataSourceAccess',
      'PermissionSetFieldPermissions',
      'PermissionSetObjectPermissions',
      'PermissionSetApexPageAccess',
      'PermissionSetRecordTypeVisibility',
      'PermissionSetTabSetting',
      'PermissionSetUserPermission',
      'KnowledgeSitesSettings',
      'EntitlementProcessMilestoneItem',
    ],
    nestedMetadataTypes = {
      CustomLabels: {
        nestedInstanceFields: ['labels'],
        isNestedApiNameRelative: false,
      },
      AssignmentRules: {
        nestedInstanceFields: ['assignmentRule'],
        isNestedApiNameRelative: true,
      },
      AutoResponseRules: {
        nestedInstanceFields: ['autoresponseRule'],
        isNestedApiNameRelative: true,
      },
      EscalationRules: {
        nestedInstanceFields: ['escalationRule'],
        isNestedApiNameRelative: true,
      },
      MatchingRules: {
        nestedInstanceFields: ['matchingRules'],
        isNestedApiNameRelative: true,
      },
      SharingRules: {
        nestedInstanceFields: [
          'sharingCriteriaRules', 'sharingGuestRules', 'sharingOwnerRules', 'sharingTerritoryRules',
        ],
        isNestedApiNameRelative: true,
      },
      Workflow: {
        nestedInstanceFields: Object.keys(WORKFLOW_FIELD_TO_TYPE),
        isNestedApiNameRelative: true,
      },
      CustomObject: {
        nestedInstanceFields: [
          ...Object.keys(NESTED_INSTANCE_VALUE_TO_TYPE_NAME),
          'fields',
        ],
        isNestedApiNameRelative: true,
      },
    },
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    systemFields = allSystemFields,
    unsupportedSystemFields = [
      'LastReferencedDate',
      'LastViewedDate',
    ],
    useOldProfiles = constants.DEFAULT_USE_OLD_PROFILES,
    config,
  }: SalesforceAdapterParams) {
    this.metadataTypesSkippedList = metadataTypesSkippedList
      .concat(makeArray(config.metadataTypesSkippedList))
    this.instancesRegexSkippedList = instancesRegexSkippedList
      .concat(makeArray(config.instancesRegexSkippedList))
      .map(e => new RegExp(e))
    this.maxItemsInRetrieveRequest = config.maxItemsInRetrieveRequest ?? maxItemsInRetrieveRequest
    this.metadataToRetrieve = metadataToRetrieve
    this.userConfig = config
    this.metadataAdditionalTypes = metadataAdditionalTypes
    this.metadataTypesOfInstancesFetchedInFilters = metadataTypesOfInstancesFetchedInFilters
    this.nestedMetadataTypes = nestedMetadataTypes
    this.client = client
    this.filtersRunner = filtersRunner(
      this.client,
      {
        instancesRegexSkippedList: this.instancesRegexSkippedList,
        metadataTypesSkippedList: this.metadataTypesSkippedList,
        unsupportedSystemFields,
        dataManagement: config.dataManagement,
        systemFields,
        useOldProfiles: config.useOldProfiles ?? useOldProfiles,
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
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
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

    const elements = [
      ...annotationTypes, ...fieldTypes, ...missingTypes, ...(await metadataTypes),
    ] as Element[]
    progressReporter.reportProgress({ message: 'Finished fetching types. Fetching instances' })

    const {
      elements: metadataInstancesElements,
      configChanges: metadataInstancesConfigInstances,
    } = await metadataInstances
    elements.push(...metadataInstancesElements)

    progressReporter.reportProgress({ message: 'Finished fetching instances. Running filters for additional information' })
    const filtersConfigChanges = (
      await this.filtersRunner.onFetch(elements)
    ) as ConfigChangeSuggestion[]
    const configChangeSuggestions = [...metadataInstancesConfigInstances, ...filtersConfigChanges]
    const config = getConfigFromConfigChanges(
      configChangeSuggestions,
      this.userConfig,
    )
    if (_.isUndefined(config)) {
      return { elements }
    }
    return {
      elements,
      updatedConfig: { config, message: getConfigChangeMessage(configChangeSuggestions) },
    }
  }

  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const resolvedChanges = changeGroup.changes
      .map(change => resolveChangeElement(change, getLookUpName))

    resolvedChanges.filter(isAdditionChange).map(getChangeElement).forEach(addDefaults)

    await this.filtersRunner.preDeploy(resolvedChanges)

    const result = isCustomObjectInstanceChanges(resolvedChanges)
      ? await deployCustomObjectInstancesGroup(
        resolvedChanges, this.client, this.userConfig.dataManagement,
      )
      : await deployMetadata(resolvedChanges, this.client,
        this.nestedMetadataTypes, this.userConfig.client?.deploy?.deleteBeforeUpdate)

    // onDeploy can change the change list in place, so we need to give it a list it can modify
    const appliedChangesBeforeRestore = [...result.appliedChanges]
    await this.filtersRunner.onDeploy(appliedChangesBeforeRestore)

    const sourceElements = _.keyBy(
      changeGroup.changes.map(getChangeElement),
      elem => elem.elemID.getFullName(),
    )
    const appliedChanges = appliedChangesBeforeRestore
      .map(change => restoreChangeElement(change, sourceElements, getLookUpName))

    return {
      appliedChanges,
      errors: result.errors,
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
    const baseTypeNames = new Set(typeInfos.map(type => type.xmlName))
    const childTypeNames = new Set(
      typeInfos.flatMap(type => type.childXmlNames).filter(values.isDefined)
    )
    return (await Promise.all(typeInfos.map(typeInfo => fetchMetadataType(
      this.client, typeInfo, knownTypes, baseTypeNames, childTypeNames,
    )))).flat()
  }

  @logDuration('fetching instances')
  private async fetchMetadataInstances(
    typeInfoPromise: Promise<MetadataObject[]>,
    types: Promise<TypeElement[]>,
  ): Promise<FetchElements<InstanceElement[]>> {
    const readInstances = async (metadataTypesToRead: ObjectType[]):
      Promise<FetchElements<InstanceElement[]>> => {
      const result = await Promise.all(metadataTypesToRead
        // Just fetch metadata instances of the types that we receive from the describe call
        .filter(type => !this.metadataAdditionalTypes.includes(apiName(type)))
        .filter(type => !this.metadataTypesOfInstancesFetchedInFilters.includes(apiName(type)))
        .map(async type => this.createMetadataInstances(type)))
      return {
        elements: _.flatten(result.map(r => r.elements)),
        configChanges: _.flatten(result.map(r => r.configChanges)),
      }
    }

    const typeInfos = await typeInfoPromise
    const topLevelTypeNames = typeInfos.map(info => info.xmlName)
    const topLevelTypes = (await types)
      .filter(isMetadataObjectType)
      .filter(t => (
        topLevelTypeNames.includes(apiName(t))
        || t.annotations.folderContentType !== undefined
      ))
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
      }),
      readInstances(metadataTypesToRead),
    ])
    return {
      elements: _.flatten(allInstances.map(instances => instances.elements)),
      configChanges: _.flatten(allInstances.map(instances => instances.configChanges)),
    }
  }

  /**
   * Create all the instances of specific metadataType
   * @param type the metadata type
   */
  private async createMetadataInstances(type: ObjectType):
  Promise<FetchElements<InstanceElement[]>> {
    const typeName = apiName(type)
    const { elements: fileProps, configChanges } = await listMetadataObjects(
      this.client, typeName, [],
    )
    const instances = await fetchMetadataInstances({
      client: this.client,
      fileProps,
      metadataType: type,
      instancesRegexSkippedList: this.instancesRegexSkippedList,
    })
    return {
      elements: instances.elements,
      configChanges: [...instances.configChanges, ...configChanges],
    }
  }
}
