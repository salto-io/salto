/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdapterOperations,
  Change,
  DeployResult,
  Element,
  ElemID,
  ElemIdGetter,
  FetchOptions,
  FetchResult,
  Field,
  FixElementsFunc,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isField,
  isInstanceElement,
  isObjectType,
  ObjectType,
  PartialFetchData,
  ReadOnlyElementsSource,
  TypeElement,
  CancelServiceAsyncTaskInput,
  CancelServiceAsyncTaskResult,
} from '@salto-io/adapter-api'
import {
  filter,
  GetLookupNameFunc,
  inspectValue,
  logDuration,
  ResolveValuesFunc,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { resolveChangeElement, resolveValues, restoreChangeElement } from '@salto-io/adapter-components'
import { MetadataObject } from '@salto-io/jsforce'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, objects, promises, values } from '@salto-io/lowerdash'
import SalesforceClient, { CustomListFuncDef } from './client/client'
import * as constants from './constants'
import {
  APEX_CLASS_METADATA_TYPE,
  ArtificialTypes,
  CUSTOM_FIELD,
  CUSTOM_OBJECT,
  CUSTOM_OBJECT_ID_FIELD,
  FLOW_METADATA_TYPE,
  LAST_MODIFIED_DATE,
  OWNER_ID,
  PROFILE_RELATED_METADATA_TYPES,
  WAVE_DATAFLOW_METADATA_TYPE,
} from './constants'
import {
  apiName,
  createInstanceElement,
  createMetadataTypeElements,
  isCustom,
  isMetadataObjectType,
  MetadataMetaType,
  StandardSettingsMetaType,
  Types,
} from './transformers/transformer'
import layoutFilter from './filters/layouts'
import customObjectsFromDescribeFilter from './filters/custom_objects_from_soap_describe'
import customObjectsToObjectTypeFilter, {
  NESTED_INSTANCE_VALUE_TO_TYPE_NAME,
} from './filters/custom_objects_to_object_type'
import customSettingsFilter from './filters/custom_settings_filter'
import customTypeSplit from './filters/custom_type_split'
import customObjectAuthorFilter from './filters/author_information/custom_objects'
import dataInstancesAuthorFilter from './filters/author_information/data_instances'
import sharingRulesAuthorFilter from './filters/author_information/sharing_rules'
import profileInstanceSplitFilter from './filters/profile_instance_split'
import customObjectsInstancesFilter from './filters/custom_objects_instances'
import profilePermissionsFilter from './filters/profile_permissions'
import emailTemplateFilter from './filters/email_template_static_files'
import minifyDeployFilter from './filters/minify_deploy'
import convertListsFilter from './filters/convert_lists'
import convertTypeFilter from './filters/convert_types'
import removeFieldsAndValuesFilter from './filters/remove_fields_and_values'
import removeRestrictionAnnotationsFilter from './filters/remove_restriction_annotations'
import standardValueSetFilter from './filters/standard_value_sets'
import flowFilter from './filters/flow'
import addMissingIdsFilter from './filters/add_missing_ids'
import animationRulesFilter from './filters/animation_rules'
import samlInitMethodFilter from './filters/saml_initiation_method'
import legacySettingsFilter from './filters/settings_type'
import settingsFilter from './filters/settings_types'
import workflowFilter, { WORKFLOW_FIELD_TO_TYPE } from './filters/workflow'
import topicsForObjectsFilter from './filters/topics_for_objects'
import globalValueSetFilter from './filters/global_value_sets'
import referenceAnnotationsFilter from './filters/reference_annotations'
import fieldReferencesFilter from './filters/field_references'
import customObjectInstanceReferencesFilter from './filters/custom_object_instances_references'
import foreignKeyReferencesFilter from './filters/foreign_key_references'
import cpqLookupFieldsFilter from './filters/cpq/lookup_fields'
import cpqCustomScriptFilter from './filters/cpq/custom_script'
import cpqRulesAndConditionsRefsFilter from './filters/cpq/rules_and_conditions_refs'
import cpqReferencableFieldReferencesFilter from './filters/cpq/referencable_field_references'
import hideReadOnlyValuesFilter from './filters/cpq/hide_read_only_values'
import extraDependenciesFilter from './filters/extra_dependencies'
import staticResourceFileExtFilter from './filters/static_resource_file_ext'
import staticResourceZipTimestamps from './filters/static_resource_zip_timestamps'
import xmlAttributesFilter from './filters/xml_attributes'
import profilePathsFilter from './filters/profile_paths'
import replaceFieldValuesFilter from './filters/replace_instance_field_values'
import valueToStaticFileFilter from './filters/value_to_static_file'
import convertMapsFilter from './filters/convert_maps'
import elementsUrlFilter from './filters/elements_url'
import territoryFilter from './filters/territory'
import customMetadataRecordsFilter from './filters/custom_metadata'
import currencyIsoCodeFilter from './filters/currency_iso_code'
import enumFieldPermissionsFilter from './filters/field_permissions_enum'
import splitCustomLabels from './filters/split_custom_labels'
import flowsFilter from './filters/flows_filter'
import hideTypesFolder from './filters/hide_types_folder'
import customMetadataToObjectTypeFilter from './filters/custom_metadata_to_object_type'
import installedPackageGeneratedDependencies from './filters/installed_package_generated_dependencies'
import createMissingInstalledPackagesInstancesFilter from './filters/create_missing_installed_packages_instances'
import metadataInstancesAliasesFilter from './filters/metadata_instances_aliases'
import formulaDepsFilter from './filters/formula_deps'
import removeUnixTimeZeroFilter from './filters/remove_unix_time_zero'
import organizationWideDefaults from './filters/organization_settings'
import centralizeTrackingInfoFilter from './filters/centralize_tracking_info'
import changedAtSingletonFilter from './filters/changed_at_singleton'
import importantValuesFilter from './filters/important_values_filter'
import omitStandardFieldsNonDeployableValuesFilter from './filters/omit_standard_fields_non_deployable_values'
import waveStaticFilesFilter from './filters/wave_static_files'
import generatedDependenciesFilter from './filters/generated_dependencies'
import extendTriggersMetadataFilter from './filters/extend_triggers_metadata'
import profilesAndPermissionSetsBrokenPathsFilter from './filters/profiles_and_permission_sets_broken_paths'
import fetchTargetsFilter from './filters/fetch_targets'
import { CUSTOM_REFS_CONFIG, FetchElements, FetchProfile, MetadataQuery, SalesforceConfig } from './types'
import mergeProfilesWithSourceValuesFilter from './filters/merge_profiles_with_source_values'
import flowCoordinatesFilter from './filters/flow_coordinates'
import taskAndEventCustomFields from './filters/task_and_event_custom_fields'
import picklistReferences from './filters/picklist_references'
import addParentToInstancesWithinFolderFilter from './filters/add_parent_to_instances_within_folder'
import addParentToRecordTriggeredFlows from './filters/add_parent_to_record_triggered_flows'
import addParentToApprovalProcess from './filters/add_parent_to_approval_process'
import { getConfigFromConfigChanges } from './config_change'
import { Filter, FilterContext, FilterCreator, FilterResult } from './filter'
import {
  addDefaults,
  apiNameSync,
  buildDataRecordsSoqlQueries,
  getFLSProfiles,
  getMetadataIncludeFromFetchTargets,
  instanceInternalId,
  isCustomObjectSync,
  isCustomType,
  isInstanceOfCustomObjectSync,
  isInstanceOfTypeSync,
  isMetadataInstanceElementSync,
  isOrderedMapTypeOrRefType,
  listMetadataObjects,
  metadataTypeSync,
  queryClient,
} from './filters/utils'
import {
  fetchMetadataInstances,
  fetchMetadataType,
  retrieveMetadataInstanceForFetchWithChangesDetection,
  retrieveMetadataInstances,
} from './fetch'
import { deployCustomObjectInstancesGroup, isCustomObjectInstanceChanges } from './custom_object_instances_deploy'
import { getLookUpName, getLookupNameForDataInstances } from './transformers/reference_mapping'
import { deployMetadata, NestedMetadataTypeInfo } from './metadata_deploy'
import nestedInstancesAuthorInformation from './filters/author_information/nested_instances'
import { buildFetchProfile } from './fetch_profile/fetch_profile'
import {
  buildFilePropsMetadataQuery,
  buildMetadataQuery,
  buildMetadataQueryForFetchWithChangesDetection,
} from './fetch_profile/metadata_query'
import { getLastChangeDateOfTypesWithNestedInstances } from './last_change_date_of_types_with_nested_instances'
import { fixElementsFunc } from './custom_references/handlers'
import { createListApexClassesDef, createListMissingWaveDataflowsDef } from './client/custom_list_funcs'
import { SalesforceAdapterDeployOptions } from './adapter_creator'

const { awu } = collections.asynciterable
const { partition } = promises.array
const { concatObjects } = objects
const { isDefined } = values

const log = logger(module)

export const allFilters: Array<FilterCreator> = [
  waveStaticFilesFilter,
  createMissingInstalledPackagesInstancesFilter,
  legacySettingsFilter,
  settingsFilter,
  // should run before customObjectsFilter
  workflowFilter,
  // fetchFlowsFilter should run before flowFilter
  flowsFilter,
  // customMetadataToObjectTypeFilter should run before customObjectsFromDescribeFilter
  customMetadataToObjectTypeFilter,
  // customObjectsFilter depends on missingFieldsFilter and settingsFilter
  customObjectsFromDescribeFilter,
  // customSettingsFilter depends on customObjectsFilter
  customSettingsFilter,
  customObjectsToObjectTypeFilter,
  // organizationWideDefaults depends on customObjectsToObjectTypeFilter
  organizationWideDefaults,
  // customObjectsInstancesFilter depends on customObjectsToObjectTypeFilter
  customObjectsInstancesFilter,
  removeFieldsAndValuesFilter,
  removeRestrictionAnnotationsFilter,
  // addMissingIdsFilter should run after customObjectsFilter
  addMissingIdsFilter,
  customMetadataRecordsFilter,
  layoutFilter,
  // profilePermissionsFilter depends on layoutFilter because layoutFilter
  // changes ElemIDs that the profile references
  profilePermissionsFilter,
  // emailTemplateFilter should run before convertMapsFilter
  emailTemplateFilter,
  // standardValueSetFilter should run before convertMapsFilter
  standardValueSetFilter,
  cpqLookupFieldsFilter,
  // convertMapsFilter should run before profile fieldReferencesFilter
  convertMapsFilter,
  flowFilter,
  elementsUrlFilter,
  // customObjectInstanceReferencesFilter should run after elementsUrlFilter
  customObjectInstanceReferencesFilter,
  cpqReferencableFieldReferencesFilter,
  cpqCustomScriptFilter,
  // cpqRulesAndConditionsFilter depends on cpqReferencableFieldReferencesFilter
  cpqRulesAndConditionsRefsFilter,
  animationRulesFilter,
  samlInitMethodFilter,
  topicsForObjectsFilter,
  globalValueSetFilter,
  staticResourceFileExtFilter,
  staticResourceZipTimestamps,
  extendTriggersMetadataFilter,
  profilePathsFilter,
  territoryFilter,
  nestedInstancesAuthorInformation,
  customObjectAuthorFilter,
  dataInstancesAuthorFilter,
  sharingRulesAuthorFilter,
  hideReadOnlyValuesFilter,
  currencyIsoCodeFilter,
  splitCustomLabels,
  xmlAttributesFilter,
  minifyDeployFilter,
  formulaDepsFilter,
  // centralizeTrackingInfoFilter depends on customObjectsToObjectTypeFilter and must run before customTypeSplit
  centralizeTrackingInfoFilter,
  // The following filters should remain last in order to make sure they fix all elements
  convertListsFilter,
  convertTypeFilter,
  // should be after convertTypeFilter & convertMapsFilter and before profileInstanceSplitFilter
  enumFieldPermissionsFilter,
  // should run after convertListsFilter
  replaceFieldValuesFilter,
  valueToStaticFileFilter,
  // addParentToRecordTriggeredFlows should run before fieldReferenceFilter
  addParentToRecordTriggeredFlows,
  addParentToApprovalProcess,
  fieldReferencesFilter,
  // should run after customObjectsInstancesFilter for now
  referenceAnnotationsFilter,
  // foreignLeyReferences should come after referenceAnnotationsFilter
  foreignKeyReferencesFilter,
  // extraDependenciesFilter should run after addMissingIdsFilter
  extraDependenciesFilter,
  installedPackageGeneratedDependencies,
  omitStandardFieldsNonDeployableValuesFilter,
  // picklistReferences should run after convertMapsFilter, fieldReferencesFilter and omitStandardFieldsNonDeployableValuesFilter
  picklistReferences,
  // taskAndEventCustomFields should run before customTypeSplit
  taskAndEventCustomFields,
  mergeProfilesWithSourceValuesFilter,
  // profilesAndPermissionSetsBrokenPathsFilter should run after mergeProfilesWithSourceValuesFilter
  profilesAndPermissionSetsBrokenPathsFilter,
  fetchTargetsFilter,
  // customTypeSplit should run after omitStandardFieldsNonDeployableValuesFilter, profilesAndPermissionSetsBrokenPathsFilter and fetchTargetsFilter
  customTypeSplit,
  // profileInstanceSplitFilter should run after mergeProfilesWithSourceValuesFilter and profilesAndPermissionSetsBrokenPathsFilter
  profileInstanceSplitFilter,
  // Any filter that relies on _created_at or _changed_at should run after removeUnixTimeZero
  removeUnixTimeZeroFilter,
  metadataInstancesAliasesFilter,
  importantValuesFilter,
  hideTypesFolder,
  generatedDependenciesFilter,
  flowCoordinatesFilter,
  // createChangedAtSingletonInstanceFilter should run last
  changedAtSingletonFilter,
  addParentToInstancesWithinFolderFilter,
]

export interface SalesforceAdapterParams {
  // Max items to fetch in one retrieve request
  maxItemsInRetrieveRequest?: number

  // Metadata types that are being fetched in the filters
  metadataTypesOfInstancesFetchedInFilters?: string[]

  // Metadata types that we have to fetch using the retrieve API
  metadataToRetrieve?: string[]

  // Metadata types that we should not create, update or delete in the main adapter code
  metadataTypesToSkipMutation?: string[]

  // Metadata types that that include metadata types inside them
  nestedMetadataTypes?: Record<string, NestedMetadataTypeInfo>

  // Filters to deploy to all adapter operations
  filterCreators?: Array<FilterCreator>

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

  elementsSource: ReadOnlyElementsSource
}

const METADATA_TO_RETRIEVE = [
  // Metadata with content - we use retrieve to get the StaticFiles properly
  'ApexClass', // contains encoded zip content
  'ApexComponent', // contains encoded zip content
  'ApexPage', // contains encoded zip content
  'ApexTrigger', // contains encoded zip content
  'AssignmentRules', // contains encoded zip content
  'AuraDefinitionBundle', // Has several fields with base64Binary encoded content
  'Certificate', // contains encoded zip content
  'ContentAsset', // contains encoded zip content
  'CustomApplication',
  'CustomMetadata', // For the XML attributes
  'CustomObject',
  'CustomPermission',
  'Dashboard', // contains encoded zip content, is under a folder
  'DashboardFolder',
  'DiscoveryAIModel',
  'Document', // contains encoded zip content, is under a folder
  'DocumentFolder',
  'EclairGeoData', // contains encoded zip content
  'EmailFolder',
  'EmailTemplate', // contains encoded zip content, is under a folder
  'EmbeddedServiceConfig',
  'ExperienceBundle',
  'ExternalDataSource',
  'FlexiPage',
  'FlowDefinition',
  'GenAiFunction',
  'GenAiPlanner',
  'GenAiPlugin',
  'GenAiPromptTemplate',
  'LightningComponentBundle', // Has several fields with base64Binary encoded content
  'NetworkBranding', // contains encoded zip content
  'Profile',
  'PermissionSet',
  'Report', // contains encoded zip content, is under a folder
  'ReportFolder',
  'ReportType',
  'Scontrol', // contains encoded zip content
  'Settings',
  'SharingRules',
  'SiteDotCom', // contains encoded zip content
  'StaticResource', // contains encoded zip content
  // Other types that need retrieve / deploy to work
  'InstalledPackage', // listMetadataObjects of this types returns duplicates
  'Territory2', // All Territory2 types do not support CRUD
  'Territory2Model', // All Territory2 types do not support CRUD
  'Territory2Rule', // All Territory2 types do not support CRUD
  'Territory2Type', // All Territory2 types do not support CRUD
  'TopicsForObjects',
  'Layout', // retrieve returns more information about relatedLists
  'Workflow',
]

export const NESTED_METADATA_TYPES = {
  CustomLabels: {
    nestedInstanceFields: ['labels'],
    isNestedApiNameRelative: false,
  },
  AssignmentRules: {
    nestedInstanceFields: ['assignmentRule'],
    isNestedApiNameRelative: true,
  },
  AutoResponseRules: {
    nestedInstanceFields: ['autoResponseRule'],
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
    nestedInstanceFields: ['sharingCriteriaRules', 'sharingGuestRules', 'sharingOwnerRules', 'sharingTerritoryRules'],
    isNestedApiNameRelative: true,
  },
  Workflow: {
    nestedInstanceFields: Object.keys(WORKFLOW_FIELD_TO_TYPE),
    isNestedApiNameRelative: true,
  },
  CustomObject: {
    nestedInstanceFields: [...Object.keys(NESTED_INSTANCE_VALUE_TO_TYPE_NAME), 'fields'],
    isNestedApiNameRelative: true,
  },
}

// See: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_custom_object__c.htm
export const SYSTEM_FIELDS = [
  'ConnectionReceivedId',
  'ConnectionSentId',
  'CreatedById',
  'CreatedDate',
  'Id',
  'IsDeleted',
  'LastActivityDate',
  LAST_MODIFIED_DATE,
  'LastModifiedById',
  'LastReferencedDate',
  'LastViewedDate',
  'Name',
  'RecordTypeId',
  'SystemModstamp',
  OWNER_ID,
  'SetupOwnerId',
]

export const UNSUPPORTED_SYSTEM_FIELDS = ['LastReferencedDate', 'LastViewedDate']

const getIncludedTypesFromElementsSource = async (
  elementsSource: ReadOnlyElementsSource,
  metadataQuery: MetadataQuery,
): Promise<TypeElement[]> =>
  awu(await elementsSource.getAll())
    .filter(isMetadataObjectType)
    // standard and custom objects
    .filter(metadataType => !isCustomObjectSync(metadataType))
    // custom types (CustomMetadata / CustomObject (non-standard) / CustomSettings)
    .filter(metadataType => !isCustomType(metadataType))
    .filter(type => metadataQuery.isTypeMatch(apiNameSync(type) ?? ''))
    .toArray()

type CreateFiltersRunnerParams = {
  fetchProfile: FetchProfile
  contextOverrides?: Partial<FilterContext>
}

const isFieldWithOrderedMapAnnotation = (field: Field): boolean =>
  Object.values(field.getTypeSync().annotationRefTypes).some(isOrderedMapTypeOrRefType)

const isElementWithOrderedMap = (element: Element): boolean => {
  if (isField(element)) {
    return isFieldWithOrderedMapAnnotation(element)
  }
  if (isInstanceElement(element)) {
    return Object.values(element.getTypeSync().fields).some(field => isOrderedMapTypeOrRefType(field.getTypeSync()))
  }
  if (isObjectType(element)) {
    return Object.values(element.fields).some(isFieldWithOrderedMapAnnotation)
  }
  return false
}

export const salesforceAdapterResolveValues: ResolveValuesFunc = async (
  element,
  getLookUpNameFunc,
  elementsSource,
  allowEmpty = true,
) => {
  const resolvedElement = await resolveValues(element, getLookUpNameFunc, elementsSource, allowEmpty)
  // Since OrderedMaps' order values reference values that may contain references, we should resolve the Element twice
  // in order to fully resolve it. An example use-case for this is the Field `SBQQ__ProductRule__c.SBQQ__LookupObject__c`
  // Where the `fullName` of the Picklist values is a Reference to a Custom Object.
  return isElementWithOrderedMap(resolvedElement)
    ? resolveValues(resolvedElement, getLookUpNameFunc, elementsSource, allowEmpty)
    : resolvedElement
}

export const resolveSalesforceChanges = (
  changes: readonly Change[],
  getLookupNameFunc: GetLookupNameFunc,
): Promise<Change[]> =>
  Promise.all(changes.map(change => resolveChangeElement(change, getLookupNameFunc, salesforceAdapterResolveValues)))

type SalesforceAdapterOperations = Omit<AdapterOperations, 'deploy' | 'validate'> & {
  deploy: (deployOptions: SalesforceAdapterDeployOptions) => Promise<DeployResult>
  validate: (deployOptions: SalesforceAdapterDeployOptions) => Promise<DeployResult>
}

export default class SalesforceAdapter implements SalesforceAdapterOperations {
  private maxItemsInRetrieveRequest: number
  private metadataToRetrieve: string[]
  private metadataTypesOfInstancesFetchedInFilters: string[]
  private nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>
  private createFiltersRunner: (params: CreateFiltersRunnerParams) => Required<Filter>

  private client: SalesforceClient
  private userConfig: SalesforceConfig
  private elementsSource: ReadOnlyElementsSource
  private fixElementsFunc: FixElementsFunc

  public constructor({
    metadataTypesOfInstancesFetchedInFilters = [FLOW_METADATA_TYPE],
    maxItemsInRetrieveRequest = constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
    metadataToRetrieve = METADATA_TO_RETRIEVE,
    nestedMetadataTypes = NESTED_METADATA_TYPES,
    filterCreators = allFilters,
    client,
    getElemIdFunc,
    elementsSource,
    systemFields = SYSTEM_FIELDS,
    unsupportedSystemFields = UNSUPPORTED_SYSTEM_FIELDS,
    config,
  }: SalesforceAdapterParams) {
    this.maxItemsInRetrieveRequest = config.maxItemsInRetrieveRequest ?? maxItemsInRetrieveRequest
    this.metadataToRetrieve = metadataToRetrieve
    this.userConfig = config
    this.metadataTypesOfInstancesFetchedInFilters = metadataTypesOfInstancesFetchedInFilters
    this.nestedMetadataTypes = nestedMetadataTypes
    this.client = client
    this.elementsSource = elementsSource
    this.createFiltersRunner = ({ fetchProfile, contextOverrides = {} }: CreateFiltersRunnerParams) =>
      filter.filtersRunner(
        {
          client: this.client,
          config: {
            unsupportedSystemFields,
            systemFields,
            fetchProfile,
            elementsSource,
            separateFieldToFiles: config.fetch?.metadata?.objectsToSeperateFieldsToFiles,
            flsProfiles: getFLSProfiles(config),
            ...contextOverrides,
          },
        },
        filterCreators,
        concatObjects,
      )
    if (getElemIdFunc) {
      Types.setElemIdGetter(getElemIdFunc)
    }
    this.fixElementsFunc = fixElementsFunc({ elementsSource, config })
  }

  private async getCustomObjectsWithDeletedFields(): Promise<Set<string>> {
    await listMetadataObjects(this.client, CUSTOM_FIELD)
    const listedFields = this.client.listedInstancesByType.get(constants.CUSTOM_FIELD)
    const fieldsFromElementsSource = await awu(await this.elementsSource.getAll())
      .filter(isCustomObjectSync)
      .flatMap(obj => Object.values(obj.fields))
      .filter(field => isCustom(apiNameSync(field)))
      .toArray()
    return new Set(
      fieldsFromElementsSource
        .filter(field => !listedFields.has(apiNameSync(field) ?? ''))
        .map(field => apiNameSync(field.parent))
        .filter(isDefined),
    )
  }

  private initializeCustomListFunctions(withChangesDetection: boolean): void {
    const commonListFunctions: Record<string, CustomListFuncDef> = {
      [WAVE_DATAFLOW_METADATA_TYPE]: createListMissingWaveDataflowsDef(),
    }
    this.client.setCustomListFuncDefByType(
      withChangesDetection
        ? {
            ...commonListFunctions,
            [APEX_CLASS_METADATA_TYPE]: createListApexClassesDef(this.elementsSource),
          }
        : commonListFunctions,
    )
  }

  /**
   * Fetch configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter, withChangesDetection = false }: FetchOptions): Promise<FetchResult> {
    const fetchParams = this.userConfig.fetch ?? {}
    this.initializeCustomListFunctions(withChangesDetection)
    const baseQuery = buildMetadataQuery({ fetchParams })
    const metadataTypeInfos = await this.client.listMetadataTypes()
    const lastChangeDateOfTypesWithNestedInstances = await getLastChangeDateOfTypesWithNestedInstances({
      client: this.client,
      metadataQuery: buildFilePropsMetadataQuery(baseQuery),
      metadataTypeInfos,
    })
    const targetedFetchInclude = fetchParams.target
      ? await getMetadataIncludeFromFetchTargets(fetchParams.target, this.elementsSource)
      : undefined
    const metadataQuery = withChangesDetection
      ? await buildMetadataQueryForFetchWithChangesDetection({
          fetchParams,
          targetedFetchInclude,
          elementsSource: this.elementsSource,
          lastChangeDateOfTypesWithNestedInstances,
          customObjectsWithDeletedFields: await this.getCustomObjectsWithDeletedFields(),
        })
      : buildMetadataQuery({ fetchParams, targetedFetchInclude })
    const fetchProfile = buildFetchProfile({
      fetchParams,
      customReferencesSettings: this.userConfig[CUSTOM_REFS_CONFIG],
      metadataQuery,
      maxItemsInRetrieveRequest: this.maxItemsInRetrieveRequest,
    })
    log.debug('going to fetch salesforce account configuration..')
    const fieldTypes = Types.getAllFieldTypes()
    const hardCodedTypes = [
      // Missing Metadata subtypes will come from the elementsSource. We want to avoid duplicates
      ...(withChangesDetection ? [] : Types.getAllMissingTypes()),
      ...Types.getAnnotationTypes(),
      ...Object.values(ArtificialTypes),
    ]
    const hardCodedTypesMap = new Map(
      hardCodedTypes
        .map(type => [apiNameSync(type), type] as [string | undefined, TypeElement])
        .filter((namedType): namedType is [string, TypeElement] => namedType[0] !== undefined),
    )
    const metadataMetaType = fetchProfile.isFeatureEnabled('metaTypes') ? MetadataMetaType : undefined
    const metadataTypeInfosPromise = Promise.resolve(
      metadataTypeInfos.filter(typeInfo => metadataQuery.isTypeMatch(typeInfo.xmlName)),
    )
    progressReporter.reportProgress({ message: 'Fetching types' })
    const metadataTypes = await this.fetchTypes({
      metadataQuery,
      withChangesDetection,
      metadataTypeInfosPromise,
      hardCodedTypes: hardCodedTypesMap,
      metadataMetaType,
    })

    progressReporter.reportProgress({ message: 'Fetching instances' })
    const { elements: metadataInstancesElements, configChanges: metadataInstancesConfigInstances } =
      await this.fetchMetadataInstances(metadataTypeInfosPromise, metadataTypes, fetchProfile)

    progressReporter.reportProgress({ message: 'Fetching Metadata Settings types' })
    const standardSettingsMetaType = fetchProfile.isFeatureEnabled('metaTypes') ? StandardSettingsMetaType : undefined
    const settingsTypes =
      fetchProfile.isFeatureEnabled('retrieveSettings') && !withChangesDetection
        ? await this.fetchMetadataSettingsTypes({
            instances: metadataInstancesElements,
            knownTypes: hardCodedTypesMap,
            standardSettingsMetaType,
          })
        : []

    const elements = [
      ...[metadataMetaType, standardSettingsMetaType].filter(isDefined),
      ...fieldTypes,
      ...hardCodedTypes,
      ...metadataTypes,
      ...metadataInstancesElements,
      ...settingsTypes,
    ]
    progressReporter.reportProgress({
      message: 'Running filters for additional information',
    })
    const fetchFiltersRunner = this.createFiltersRunner({
      fetchProfile,
      contextOverrides: { lastChangeDateOfTypesWithNestedInstances },
    })
    const onFetchFilterResult = (await fetchFiltersRunner.onFetch(elements)) as FilterResult
    const configChangeSuggestions = [
      ...metadataInstancesConfigInstances,
      ...(onFetchFilterResult.configSuggestions ?? []),
    ]
    const updatedConfig = getConfigFromConfigChanges(configChangeSuggestions, this.userConfig)
    const getPartialFetchData = async (): Promise<PartialFetchData | undefined> => {
      if (!fetchProfile.metadataQuery.isPartialFetch()) {
        return undefined
      }
      const deletedElemIds = await this.getDeletedElemIdsForPartialFetch({
        fetchProfile,
        fetchElements: elements,
      })
      if (deletedElemIds.length > 0) {
        log.debug(
          'The following elemIDs were deleted in partial fetch: %s',
          safeJsonStringify(deletedElemIds.map(e => e.getFullName())),
        )
      }
      return { isPartial: true, deletedElements: deletedElemIds }
    }

    if (withChangesDetection) {
      const relevantFetchedElementIds = elements
        .filter(element => isCustomObjectSync(element) || isInstanceElement(element))
        .map(element => element.elemID.getFullName())
      ;(relevantFetchedElementIds.length > 100 ? log.trace : log.debug)(
        'Fetched the following elements in quick fetch: %s',
        safeJsonStringify(relevantFetchedElementIds),
      )
    }
    metadataQuery.logData()
    await this.client.awaitCompletionOfAllListRequests()
    PROFILE_RELATED_METADATA_TYPES.forEach(type => {
      const fullNames = this.client.listedInstancesByType.getOrUndefined(type)
      if (fullNames) {
        log.trace('list result for type %s: %s', type, Array.from(fullNames).join(','))
      }
    })
    return {
      elements,
      errors: onFetchFilterResult.errors ?? [],
      updatedConfig,
      partialFetchData: await getPartialFetchData(),
    }
  }

  private async deployOrValidate(
    { changeGroup, progressReporter }: SalesforceAdapterDeployOptions,
    checkOnly: boolean,
  ): Promise<DeployResult> {
    const fetchParams = this.userConfig.fetch ?? {}
    const fetchProfile = buildFetchProfile({
      fetchParams,
      customReferencesSettings: this.userConfig[CUSTOM_REFS_CONFIG],
    })
    log.debug(
      `about to ${checkOnly ? 'validate' : 'deploy'} group ${changeGroup.groupID} with scope (first 100): ${safeJsonStringify(
        changeGroup.changes
          .slice(0, 100)
          .map(getChangeData)
          .map(e => e.elemID.getFullName()),
      )}`,
    )
    const isDataDeployGroup = await isCustomObjectInstanceChanges(changeGroup.changes)
    const getLookupNameFunc = isDataDeployGroup
      ? getLookupNameForDataInstances(fetchProfile)
      : getLookUpName(fetchProfile)
    const resolvedChanges = await resolveSalesforceChanges(changeGroup.changes, getLookupNameFunc)

    await awu(resolvedChanges).filter(isAdditionChange).map(getChangeData).forEach(addDefaults)
    const filtersRunner = this.createFiltersRunner({ fetchProfile })
    await filtersRunner.preDeploy(resolvedChanges)
    log.debug(`preDeploy of group ${changeGroup.groupID} finished`)

    let deployResult: DeployResult
    if (isDataDeployGroup) {
      if (checkOnly) {
        const message = 'Cannot deploy CustomObject Records as part of check-only deployment'
        return {
          appliedChanges: [],
          errors: [
            {
              message,
              detailedMessage: message,
              severity: 'Error',
            },
          ],
        }
      }
      deployResult = await deployCustomObjectInstancesGroup(
        resolvedChanges as Change<InstanceElement>[],
        this.client,
        changeGroup.groupID,
        fetchProfile.dataManagement,
      )
      progressReporter.reportDataProgress(deployResult.appliedChanges.length)
    } else {
      deployResult = await deployMetadata(
        resolvedChanges,
        this.client,
        this.nestedMetadataTypes,
        progressReporter,
        fetchProfile,
        this.userConfig.client?.deploy?.deleteBeforeUpdate,
        checkOnly,
        this.userConfig.client?.deploy?.quickDeployParams,
      )
    }
    log.debug(`received deployResult for group ${changeGroup.groupID}`)
    // onDeploy can change the change list in place, so we need to give it a list it can modify
    const appliedChangesBeforeRestore = [...deployResult.appliedChanges]
    await filtersRunner.onDeploy(appliedChangesBeforeRestore)
    log.debug(`onDeploy of group ${changeGroup.groupID} finished`)

    const sourceChanges = _.keyBy(changeGroup.changes, change => getChangeData(change).elemID.getFullName())

    const appliedChanges = await awu(appliedChangesBeforeRestore)
      .map(change => restoreChangeElement(change, sourceChanges, getLookupNameFunc))
      .toArray()
    return {
      appliedChanges,
      errors: deployResult.errors,
      extraProperties: deployResult.extraProperties,
    }
  }

  async deploy(deployOptions: SalesforceAdapterDeployOptions): Promise<DeployResult> {
    // Check old configuration flag for backwards compatibility (SALTO-2700)
    const checkOnly = this.userConfig?.client?.deploy?.checkOnly ?? false
    const result = await this.deployOrValidate(deployOptions, checkOnly)
    // If we got here with checkOnly we must not return any applied changes
    // to maintain the old deploy interface (SALTO-2700)
    if (checkOnly) {
      return {
        ...result,
        appliedChanges: [],
      }
    }
    return result
  }

  async validate(deployOptions: SalesforceAdapterDeployOptions): Promise<DeployResult> {
    return this.deployOrValidate(deployOptions, true)
  }

  async cancelServiceAsyncTask(input: CancelServiceAsyncTaskInput): Promise<CancelServiceAsyncTaskResult> {
    return this.client.cancelMetadataValidateOrDeployTask(input)
  }

  private async fetchTypes({
    metadataQuery,
    withChangesDetection,
    metadataTypeInfosPromise,
    hardCodedTypes,
    metadataMetaType,
  }: {
    metadataQuery: MetadataQuery
    withChangesDetection: boolean
    metadataTypeInfosPromise: Promise<MetadataObject[]>
    hardCodedTypes: Map<string, TypeElement>
    metadataMetaType?: ObjectType
  }): Promise<TypeElement[]> {
    if (!withChangesDetection) {
      return this.fetchMetadataTypes(metadataTypeInfosPromise, hardCodedTypes, metadataMetaType)
    }
    const metadataTypes = await metadataTypeInfosPromise
    const includedTypesFromSource = await getIncludedTypesFromElementsSource(this.elementsSource, metadataQuery)
    const includedTypesFromSourceNames = new Set(includedTypesFromSource.map(metadataType => apiNameSync(metadataType)))
    const missingTypes = metadataTypes.filter(type => !includedTypesFromSourceNames.has(type.xmlName))
    if (missingTypes.length === 0) {
      return includedTypesFromSource
    }
    log.debug(
      'Going to fetch the following metadata types in fetchWithChangesDetection: %s',
      inspectValue(missingTypes.map(type => type.xmlName)),
    )
    return includedTypesFromSource.concat(
      await this.fetchMetadataTypes(Promise.resolve(missingTypes), hardCodedTypes, metadataMetaType),
    )
  }

  @logDuration('fetching metadata types')
  private async fetchMetadataTypes(
    typeInfoPromise: Promise<MetadataObject[]>,
    knownTypes: Map<string, TypeElement>,
    metaType?: ObjectType,
  ): Promise<TypeElement[]> {
    const typeInfos = await typeInfoPromise
    const baseTypeNames = new Set(typeInfos.map(type => type.xmlName))
    const childTypeNames = new Set(typeInfos.flatMap(type => type.childXmlNames).filter(values.isDefined))
    return (
      await Promise.all(
        typeInfos.map(typeInfo =>
          fetchMetadataType(this.client, typeInfo, knownTypes, baseTypeNames, childTypeNames, metaType),
        ),
      )
    ).flat()
  }

  @logDuration('fetching instances')
  private async fetchMetadataInstances(
    typeInfoPromise: Promise<MetadataObject[]>,
    types: TypeElement[],
    fetchProfile: FetchProfile,
  ): Promise<FetchElements<InstanceElement[]>> {
    const readInstances = async (metadataTypes: ObjectType[]): Promise<FetchElements<InstanceElement[]>> => {
      const metadataTypesToRead = await awu(metadataTypes)
        .filter(async type => !this.metadataTypesOfInstancesFetchedInFilters.includes(await apiName(type)))
        .toArray()
      const result = await Promise.all(
        metadataTypesToRead.map(type => this.createMetadataInstances(type, fetchProfile)),
      )
      return {
        elements: _.flatten(result.map(r => r.elements)),
        configChanges: _.flatten(result.map(r => r.configChanges)),
      }
    }

    const typeInfos = await typeInfoPromise
    const topLevelTypeNames = typeInfos.map(info => info.xmlName)
    const topLevelTypes = await awu(types)
      .filter(isMetadataObjectType)
      .filter(async t => topLevelTypeNames.includes(await apiName(t)) || t.annotations.folderContentType !== undefined)
      .toArray()

    const [metadataTypesToRetrieve, metadataTypesToRead] = await partition(topLevelTypes, async t =>
      this.metadataToRetrieve.includes(await apiName(t)),
    )

    const retrieveMetadataInstancesFunc = fetchProfile.metadataQuery.isFetchWithChangesDetection()
      ? retrieveMetadataInstanceForFetchWithChangesDetection
      : retrieveMetadataInstances

    const allInstances = await Promise.all([
      retrieveMetadataInstancesFunc({
        client: this.client,
        types: metadataTypesToRetrieve,
        fetchProfile,
        typesToSkip: new Set(this.metadataTypesOfInstancesFetchedInFilters),
      }),
      readInstances(metadataTypesToRead),
    ])
    return {
      elements: _.flatten(allInstances.map(instances => instances.elements)),
      configChanges: _.flatten(allInstances.map(instances => instances.configChanges)),
    }
  }

  @logDuration('fetching Metadata Settings types')
  public async fetchMetadataSettingsTypes({
    instances,
    knownTypes,
    standardSettingsMetaType,
  }: {
    instances: InstanceElement[]
    knownTypes: Map<string, TypeElement>
    standardSettingsMetaType?: ObjectType
  }): Promise<TypeElement[]> {
    const fetchSettingsType = async (settingsTypeName: string): Promise<ObjectType[]> => {
      const typeFields = await this.client.describeMetadataType(settingsTypeName)
      try {
        return await createMetadataTypeElements({
          name: settingsTypeName,
          fields: typeFields.valueTypeFields,
          knownTypes,
          baseTypeNames: new Set([settingsTypeName]),
          childTypeNames: new Set(),
          client: this.client,
          isSettings: true,
          annotations: {
            suffix: 'settings',
            dirName: constants.SETTINGS_DIR_NAME,
          },
          metaType: standardSettingsMetaType,
        })
      } catch (e) {
        log.error('Failed to fetch settings type %s reason: %s', settingsTypeName, inspectValue(e))
        return []
      }
    }

    return (
      await Promise.all(
        instances
          .filter(isInstanceOfTypeSync(constants.SETTINGS_METADATA_TYPE))
          .map(instance => apiNameSync(instance))
          .filter(isDefined)
          .map(typeName => fetchSettingsType(`${typeName}${constants.SETTINGS_METADATA_TYPE}`)),
      )
    ).flat()
  }

  private async createMetadataInstances(
    type: ObjectType,
    fetchProfile: FetchProfile,
  ): Promise<FetchElements<InstanceElement[]>> {
    const typeName = await apiName(type)
    const { elements: fileProps, configChanges } = await listMetadataObjects(this.client, typeName)

    const instances = await fetchMetadataInstances({
      client: this.client,
      fileProps,
      metadataType: type,
      metadataQuery: fetchProfile.metadataQuery,
      maxInstancesPerType: fetchProfile.maxInstancesPerType,
      addNamespacePrefixToFullName: fetchProfile.addNamespacePrefixToFullName,
    })
    return {
      elements: instances.elements,
      configChanges: [...instances.configChanges, ...configChanges],
    }
  }

  private async getMetadataElementsByTypeFromSource(): Promise<Record<string, Element[]>> {
    const metadataElements = (await awu(await this.elementsSource.getAll()).toArray())
      .filter(element => !constants.NON_LISTED_ELEMENT_IDS.includes(element.elemID.getFullName()))
      .filter(element => isMetadataInstanceElementSync(element) || isCustomObjectSync(element))
    return _.groupBy(metadataElements, metadataTypeSync)
  }

  private async getDeletedMetadataForPartialFetch(
    fetchElements: ReadonlyArray<Element>,
    fetchProfile: FetchProfile,
  ): Promise<Required<PartialFetchData>['deletedElements']> {
    const isTargetedFetch = fetchProfile.metadataQuery.isTargetedFetch()
    const createElemId = (type: ObjectType, fullName: string): ElemID => {
      const typeName = apiNameSync(type)
      return typeName === CUSTOM_OBJECT
        ? // CustomObjects are converted to types and do not remain instances
          Types.getElemId(fullName, true)
        : createInstanceElement({ fullName }, type).elemID
    }
    const metadataTypesByName = _.keyBy(
      fetchElements.filter(isMetadataObjectType),
      type => apiNameSync(type) ?? 'unknown',
    )
    const metadataElementsByTypeFromSource = await this.getMetadataElementsByTypeFromSource()
    const deletedElemIds = new Set<ElemID>()
    Object.entries(metadataElementsByTypeFromSource).forEach(([typeName, elementsFromSource]) => {
      if (!fetchProfile.metadataQuery.isTypeMatch(typeName)) {
        // Instances of Type that is not part of the fetch targets should not be handled
        if (!isTargetedFetch) {
          // Type was excluded, we should remove all of its Instances
          elementsFromSource.forEach(elementFromSource => {
            deletedElemIds.add(elementFromSource.elemID)
          })
        }
        return
      }
      const metadataType = metadataTypesByName[typeName]
      if (metadataType === undefined) {
        log.warn('Skipping deletion detections for type %s since the metadata ObjectType was not found', typeName)
        return
      }
      const listedInstancesFullNames = this.client.listedInstancesByType.getOrUndefined(typeName)
      if (listedInstancesFullNames === undefined) {
        log.warn('Skipping deletion detections for type %s since the type was not listed', typeName)
        return
      }
      const listedElemIdsFullNames = new Set(
        Array.from(listedInstancesFullNames)
          // Create the correct elemID that we calculate in fetch
          .map(fullName => createElemId(metadataType, fullName).getFullName()),
      )

      elementsFromSource.forEach(elementFromSource => {
        if (!listedElemIdsFullNames.has(elementFromSource.elemID.getFullName())) {
          deletedElemIds.add(elementFromSource.elemID)
        }
      })
    })
    return Array.from(deletedElemIds)
  }

  private async getDeletedDataRecordsForPartialFetch(
    fetchElements: ReadonlyArray<Element>,
  ): Promise<Required<PartialFetchData>['deletedElements']> {
    const querySalesforceForRecordIdsOfInstances = async (
      instances: ReadonlyArray<InstanceElement>,
    ): Promise<string[]> => {
      const instancesByType = _(instances)
        .filter(isInstanceOfCustomObjectSync)
        .groupBy(instance => apiNameSync(instance.getTypeSync()) ?? '')
        .value()
      _.unset(instancesByType, '')

      const queries = awu(Object.entries(instancesByType)).map(async ([typeName, instancesOfType]) =>
        buildDataRecordsSoqlQueries(
          typeName,
          [instancesOfType[0].getTypeSync().fields[CUSTOM_OBJECT_ID_FIELD]],
          instancesOfType.map(instanceInternalId),
        ),
      )

      return awu(queries)
        .flatMap(async typeQueries => queryClient(this.client, typeQueries))
        .map(record => record[CUSTOM_OBJECT_ID_FIELD])
        .toArray()
    }

    const getCustomObjectInstancesFromElementSource = async (
      elementsSource: ReadOnlyElementsSource,
      instancesToDiscard: ReadonlyArray<Element>,
    ): Promise<InstanceElement[]> => {
      // We implement a small optimization of not querying for IDs we just fetched, because we know these IDs couldn't
      // have been deleted.
      const idsToDiscard = new Set(instancesToDiscard.filter(isInstanceOfCustomObjectSync).map(instanceInternalId))
      return awu(await elementsSource.getAll())
        .filter(isInstanceOfCustomObjectSync)
        .filter(instance => !idsToDiscard.has(instanceInternalId(instance)))
        .toArray()
    }

    const workspaceInstances = await getCustomObjectInstancesFromElementSource(this.elementsSource, fetchElements)

    const instanceIdsInSalesforce = new Set(await querySalesforceForRecordIdsOfInstances(workspaceInstances))

    return workspaceInstances
      .filter(instance => !instanceIdsInSalesforce.has(instanceInternalId(instance)))
      .map(instance => instance.elemID)
  }

  private async getDeletedElemIdsForPartialFetch({
    fetchProfile,
    fetchElements,
  }: {
    fetchElements: ReadonlyArray<Element>
    fetchProfile: FetchProfile
  }): Promise<Required<PartialFetchData>['deletedElements']> {
    const deletedMetadata = await this.getDeletedMetadataForPartialFetch(fetchElements, fetchProfile)
    const deletedDataRecords = await this.getDeletedDataRecordsForPartialFetch(fetchElements)
    return deletedMetadata.concat(deletedDataRecords)
  }

  fixElements: FixElementsFunc = elements => this.fixElementsFunc(elements)
}
