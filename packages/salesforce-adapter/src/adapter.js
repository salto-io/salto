"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.UNSUPPORTED_SYSTEM_FIELDS = exports.SYSTEM_FIELDS = exports.allFilters = void 0;
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
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lodash_1 = require("lodash");
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants = require("./constants");
var transformer_1 = require("./transformers/transformer");
var layouts_1 = require("./filters/layouts");
var custom_objects_from_soap_describe_1 = require("./filters/custom_objects_from_soap_describe");
var custom_objects_to_object_type_1 = require("./filters/custom_objects_to_object_type");
var custom_settings_filter_1 = require("./filters/custom_settings_filter");
var custom_type_split_1 = require("./filters/custom_type_split");
var custom_objects_1 = require("./filters/author_information/custom_objects");
var data_instances_1 = require("./filters/author_information/data_instances");
var sharing_rules_1 = require("./filters/author_information/sharing_rules");
var validation_rules_1 = require("./filters/author_information/validation_rules");
var profile_instance_split_1 = require("./filters/profile_instance_split");
var custom_objects_instances_1 = require("./filters/custom_objects_instances");
var profile_permissions_1 = require("./filters/profile_permissions");
var email_template_static_files_1 = require("./filters/email_template_static_files");
var minify_deploy_1 = require("./filters/minify_deploy");
var convert_lists_1 = require("./filters/convert_lists");
var convert_types_1 = require("./filters/convert_types");
var remove_fields_and_values_1 = require("./filters/remove_fields_and_values");
var remove_restriction_annotations_1 = require("./filters/remove_restriction_annotations");
var standard_value_sets_1 = require("./filters/standard_value_sets");
var flow_1 = require("./filters/flow");
var add_missing_ids_1 = require("./filters/add_missing_ids");
var animation_rules_1 = require("./filters/animation_rules");
var saml_initiation_method_1 = require("./filters/saml_initiation_method");
var settings_type_1 = require("./filters/settings_type");
var workflow_1 = require("./filters/workflow");
var topics_for_objects_1 = require("./filters/topics_for_objects");
var global_value_sets_1 = require("./filters/global_value_sets");
var reference_annotations_1 = require("./filters/reference_annotations");
var field_references_1 = require("./filters/field_references");
var custom_object_instances_references_1 = require("./filters/custom_object_instances_references");
var foreign_key_references_1 = require("./filters/foreign_key_references");
var value_set_1 = require("./filters/value_set");
var lookup_fields_1 = require("./filters/cpq/lookup_fields");
var custom_script_1 = require("./filters/cpq/custom_script");
var referencable_field_references_1 = require("./filters/cpq/referencable_field_references");
var hide_read_only_values_1 = require("./filters/cpq/hide_read_only_values");
var extra_dependencies_1 = require("./filters/extra_dependencies");
var static_resource_file_ext_1 = require("./filters/static_resource_file_ext");
var xml_attributes_1 = require("./filters/xml_attributes");
var profile_paths_1 = require("./filters/profile_paths");
var replace_instance_field_values_1 = require("./filters/replace_instance_field_values");
var value_to_static_file_1 = require("./filters/value_to_static_file");
var convert_maps_1 = require("./filters/convert_maps");
var elements_url_1 = require("./filters/elements_url");
var territory_1 = require("./filters/territory");
var custom_metadata_1 = require("./filters/custom_metadata");
var currency_iso_code_1 = require("./filters/currency_iso_code");
var field_permissions_enum_1 = require("./filters/field_permissions_enum");
var split_custom_labels_1 = require("./filters/split_custom_labels");
var fetch_flows_1 = require("./filters/fetch_flows");
var custom_metadata_to_object_type_1 = require("./filters/custom_metadata_to_object_type");
var add_default_activate_rss_1 = require("./filters/add_default_activate_rss");
var config_change_1 = require("./config_change");
var utils_1 = require("./filters/utils");
var fetch_1 = require("./fetch");
var custom_object_instances_deploy_1 = require("./custom_object_instances_deploy");
var reference_mapping_1 = require("./transformers/reference_mapping");
var metadata_deploy_1 = require("./metadata_deploy");
var fetch_profile_1 = require("./fetch_profile/fetch_profile");
var constants_1 = require("./constants");
var awu = lowerdash_1.collections.asynciterable.awu;
var partition = lowerdash_1.promises.array.partition;
var concatObjects = lowerdash_1.objects.concatObjects;
var log = logging_1.logger(module);
exports.allFilters = [
    { creator: add_default_activate_rss_1["default"] },
    { creator: settings_type_1["default"], addsNewInformation: true },
    // should run before customObjectsFilter
    { creator: workflow_1["default"] },
    // fetchFlowsFilter should run before flowFilter
    { creator: fetch_flows_1["default"], addsNewInformation: true },
    // customMetadataToObjectTypeFilter should run before customObjectsFromDescribeFilter
    { creator: custom_metadata_to_object_type_1["default"] },
    // customObjectsFilter depends on missingFieldsFilter and settingsFilter
    { creator: custom_objects_from_soap_describe_1["default"], addsNewInformation: true },
    // customSettingsFilter depends on customObjectsFilter
    { creator: custom_settings_filter_1["default"], addsNewInformation: true },
    { creator: custom_objects_to_object_type_1["default"] },
    // customObjectsInstancesFilter depends on customObjectsToObjectTypeFilter
    { creator: custom_objects_instances_1["default"], addsNewInformation: true },
    { creator: remove_fields_and_values_1["default"] },
    { creator: remove_restriction_annotations_1["default"] },
    // addMissingIdsFilter should run after customObjectsFilter
    { creator: add_missing_ids_1["default"], addsNewInformation: true },
    { creator: custom_metadata_1["default"] },
    { creator: layouts_1["default"] },
    // profilePermissionsFilter depends on layoutFilter because layoutFilter
    // changes ElemIDs that the profile references
    { creator: profile_permissions_1["default"] },
    // emailTemplateFilter should run before convertMapsFilter
    { creator: email_template_static_files_1["default"] },
    // convertMapsFilter should run before profile fieldReferencesFilter
    { creator: convert_maps_1["default"] },
    { creator: standard_value_sets_1["default"], addsNewInformation: true },
    { creator: flow_1["default"] },
    { creator: custom_object_instances_references_1["default"], addsNewInformation: true },
    { creator: referencable_field_references_1["default"] },
    { creator: custom_script_1["default"] },
    { creator: lookup_fields_1["default"] },
    { creator: animation_rules_1["default"] },
    { creator: saml_initiation_method_1["default"] },
    { creator: topics_for_objects_1["default"] },
    { creator: value_set_1["default"] },
    { creator: global_value_sets_1["default"] },
    { creator: static_resource_file_ext_1["default"] },
    { creator: profile_paths_1["default"], addsNewInformation: true },
    { creator: territory_1["default"] },
    { creator: elements_url_1["default"], addsNewInformation: true },
    { creator: custom_objects_1["default"], addsNewInformation: true },
    { creator: data_instances_1["default"], addsNewInformation: true },
    { creator: sharing_rules_1["default"], addsNewInformation: true },
    { creator: validation_rules_1["default"], addsNewInformation: true },
    { creator: hide_read_only_values_1["default"] },
    { creator: currency_iso_code_1["default"] },
    { creator: split_custom_labels_1["default"] },
    { creator: xml_attributes_1["default"] },
    { creator: minify_deploy_1["default"] },
    // The following filters should remain last in order to make sure they fix all elements
    { creator: convert_lists_1["default"] },
    { creator: convert_types_1["default"] },
    // should be after convertTypeFilter & convertMapsFilter and before profileInstanceSplitFilter
    { creator: field_permissions_enum_1["default"] },
    // should run after convertListsFilter
    { creator: replace_instance_field_values_1["default"] },
    { creator: value_to_static_file_1["default"] },
    { creator: field_references_1["default"] },
    // should run after customObjectsInstancesFilter for now
    { creator: reference_annotations_1["default"] },
    // foreignLeyReferences should come after referenceAnnotationsFilter
    { creator: foreign_key_references_1["default"] },
    // extraDependenciesFilter should run after addMissingIdsFilter
    { creator: extra_dependencies_1["default"], addsNewInformation: true },
    { creator: custom_type_split_1["default"] },
    { creator: profile_instance_split_1["default"] },
];
// By default we run all filters and provide a client
var defaultFilters = exports.allFilters.map(function (_a) {
    var creator = _a.creator;
    return creator;
});
var METADATA_TO_RETRIEVE = [
    // Metadata with content - we use retrieve to get the StaticFiles properly
    'ApexClass',
    'ApexComponent',
    'ApexPage',
    'ApexTrigger',
    'AssignmentRules',
    'AuraDefinitionBundle',
    'Certificate',
    'ContentAsset',
    'CustomMetadata',
    'Dashboard',
    'DashboardFolder',
    'Document',
    'DocumentFolder',
    'EclairGeoData',
    'EmailFolder',
    'EmailTemplate',
    'LightningComponentBundle',
    'NetworkBranding',
    'Report',
    'ReportFolder',
    'ReportType',
    'Scontrol',
    'SiteDotCom',
    'StaticResource',
    // Other types that need retrieve / deploy to work
    'InstalledPackage',
    'Territory2',
    'Territory2Model',
    'Territory2Rule',
    'Territory2Type',
    'Layout',
];
// See: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_custom_object__c.htm
exports.SYSTEM_FIELDS = [
    'ConnectionReceivedId',
    'ConnectionSentId',
    'CreatedById',
    'CreatedDate',
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
];
exports.UNSUPPORTED_SYSTEM_FIELDS = [
    'LastReferencedDate',
    'LastViewedDate',
];
var SalesforceAdapter = /** @class */ (function () {
    function SalesforceAdapter(_a) {
        var _b = _a.metadataTypesOfInstancesFetchedInFilters, metadataTypesOfInstancesFetchedInFilters = _b === void 0 ? [constants_1.FLOW_METADATA_TYPE, constants_1.FLOW_DEFINITION_METADATA_TYPE] : _b, _c = _a.maxItemsInRetrieveRequest, maxItemsInRetrieveRequest = _c === void 0 ? constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST : _c, _d = _a.metadataToRetrieve, metadataToRetrieve = _d === void 0 ? METADATA_TO_RETRIEVE : _d, _e = _a.nestedMetadataTypes, nestedMetadataTypes = _e === void 0 ? {
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
                nestedInstanceFields: Object.keys(workflow_1.WORKFLOW_FIELD_TO_TYPE),
                isNestedApiNameRelative: true,
            },
            CustomObject: {
                nestedInstanceFields: __spreadArrays(Object.keys(custom_objects_to_object_type_1.NESTED_INSTANCE_VALUE_TO_TYPE_NAME), [
                    'fields',
                ]),
                isNestedApiNameRelative: true,
            },
        } : _e, _f = _a.filterCreators, filterCreators = _f === void 0 ? defaultFilters : _f, client = _a.client, getElemIdFunc = _a.getElemIdFunc, elementsSource = _a.elementsSource, _g = _a.systemFields, systemFields = _g === void 0 ? exports.SYSTEM_FIELDS : _g, _h = _a.unsupportedSystemFields, unsupportedSystemFields = _h === void 0 ? exports.UNSUPPORTED_SYSTEM_FIELDS : _h, config = _a.config;
        var _j, _k;
        this.maxItemsInRetrieveRequest = (_j = config.maxItemsInRetrieveRequest) !== null && _j !== void 0 ? _j : maxItemsInRetrieveRequest;
        this.metadataToRetrieve = metadataToRetrieve;
        this.userConfig = config;
        this.metadataTypesOfInstancesFetchedInFilters = metadataTypesOfInstancesFetchedInFilters;
        this.nestedMetadataTypes = nestedMetadataTypes;
        this.client = client;
        var fetchProfile = fetch_profile_1.buildFetchProfile((_k = config.fetch) !== null && _k !== void 0 ? _k : {});
        this.fetchProfile = fetchProfile;
        this.createFiltersRunner = function () {
            var _a, _b, _c;
            return adapter_utils_1.filter.filtersRunner({
                client: client,
                config: {
                    unsupportedSystemFields: unsupportedSystemFields,
                    systemFields: systemFields,
                    enumFieldPermissions: (_a = config.enumFieldPermissions) !== null && _a !== void 0 ? _a : constants.DEFAULT_ENUM_FIELD_PERMISSIONS,
                    fetchProfile: fetchProfile,
                    elementsSource: elementsSource,
                    separateFieldToFiles: (_c = (_b = config.fetch) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.objectsToSeperateFieldsToFiles,
                },
            }, filterCreators, concatObjects);
        };
        if (getElemIdFunc) {
            transformer_1.Types.setElemIdGetter(getElemIdFunc);
        }
    }
    /**
     * Fetch configuration elements (types and instances in the given salesforce account)
     * Account credentials were given in the constructor.
     */
    SalesforceAdapter.prototype.fetch = function (_a) {
        var _b, _c, _d;
        var progressReporter = _a.progressReporter;
        return __awaiter(this, void 0, void 0, function () {
            var fieldTypes, hardCodedTypes, metadataTypeInfosPromise, metadataTypesPromise, metadataInstancesPromise, metadataTypes, _e, metadataInstancesElements, metadataInstancesConfigInstances, elements, onFetchFilterResult, configChangeSuggestions, updatedConfig;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        log.debug('going to fetch salesforce account configuration..');
                        fieldTypes = transformer_1.Types.getAllFieldTypes();
                        hardCodedTypes = __spreadArrays(transformer_1.Types.getAllMissingTypes(), transformer_1.Types.getAnnotationTypes());
                        metadataTypeInfosPromise = this.listMetadataTypes();
                        metadataTypesPromise = this.fetchMetadataTypes(metadataTypeInfosPromise, hardCodedTypes);
                        metadataInstancesPromise = this.fetchMetadataInstances(metadataTypeInfosPromise, metadataTypesPromise);
                        progressReporter.reportProgress({ message: 'Fetching types' });
                        return [4 /*yield*/, metadataTypesPromise];
                    case 1:
                        metadataTypes = _f.sent();
                        progressReporter.reportProgress({ message: 'Fetching instances' });
                        return [4 /*yield*/, metadataInstancesPromise];
                    case 2:
                        _e = _f.sent(), metadataInstancesElements = _e.elements, metadataInstancesConfigInstances = _e.configChanges;
                        elements = __spreadArrays(fieldTypes, hardCodedTypes, metadataTypes, metadataInstancesElements);
                        progressReporter.reportProgress({ message: 'Running filters for additional information' });
                        return [4 /*yield*/, this.createFiltersRunner().onFetch(elements)];
                    case 3:
                        onFetchFilterResult = (_f.sent());
                        configChangeSuggestions = __spreadArrays(metadataInstancesConfigInstances, ((_b = onFetchFilterResult.configSuggestions) !== null && _b !== void 0 ? _b : []));
                        updatedConfig = config_change_1.getConfigFromConfigChanges(configChangeSuggestions, this.userConfig);
                        return [2 /*return*/, {
                                elements: elements,
                                errors: (_c = onFetchFilterResult.errors) !== null && _c !== void 0 ? _c : [],
                                updatedConfig: updatedConfig,
                                isPartial: ((_d = this.userConfig.fetch) === null || _d === void 0 ? void 0 : _d.target) !== undefined,
                            }];
                }
            });
        });
    };
    SalesforceAdapter.prototype.deployOrValidate = function (_a, checkOnly) {
        var _b, _c, _d, _e, _f, _g;
        var changeGroup = _a.changeGroup;
        return __awaiter(this, void 0, void 0, function () {
            var resolvedChanges, filtersRunner, deployResult, appliedChangesBeforeRestore, sourceChanges, appliedChanges;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0: return [4 /*yield*/, awu(changeGroup.changes)
                            .map(function (change) { return adapter_utils_1.resolveChangeElement(change, reference_mapping_1.getLookUpName); })
                            .toArray()];
                    case 1:
                        resolvedChanges = _h.sent();
                        return [4 /*yield*/, awu(resolvedChanges).filter(adapter_api_1.isAdditionChange).map(adapter_api_1.getChangeData).forEach(utils_1.addDefaults)];
                    case 2:
                        _h.sent();
                        filtersRunner = this.createFiltersRunner();
                        return [4 /*yield*/, filtersRunner.preDeploy(resolvedChanges)];
                    case 3:
                        _h.sent();
                        return [4 /*yield*/, custom_object_instances_deploy_1.isCustomObjectInstanceChanges(resolvedChanges)];
                    case 4:
                        if (!_h.sent()) return [3 /*break*/, 6];
                        if (checkOnly) {
                            return [2 /*return*/, {
                                    appliedChanges: [],
                                    errors: [new Error('Cannot deploy CustomObject Records as part of check-only deployment')],
                                }];
                        }
                        return [4 /*yield*/, custom_object_instances_deploy_1.deployCustomObjectInstancesGroup(resolvedChanges, this.client, changeGroup.groupID, this.fetchProfile.dataManagement)];
                    case 5:
                        deployResult = _h.sent();
                        return [3 /*break*/, 10];
                    case 6:
                        if (!(((_c = (_b = this.userConfig.client) === null || _b === void 0 ? void 0 : _b.deploy) === null || _c === void 0 ? void 0 : _c.quickDeployParams) !== undefined)) return [3 /*break*/, 8];
                        return [4 /*yield*/, metadata_deploy_1.quickDeploy(resolvedChanges, this.client, changeGroup.groupID, (_e = (_d = this.userConfig.client) === null || _d === void 0 ? void 0 : _d.deploy) === null || _e === void 0 ? void 0 : _e.quickDeployParams)];
                    case 7:
                        deployResult = _h.sent();
                        return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, metadata_deploy_1.deployMetadata(resolvedChanges, this.client, changeGroup.groupID, this.nestedMetadataTypes, (_g = (_f = this.userConfig.client) === null || _f === void 0 ? void 0 : _f.deploy) === null || _g === void 0 ? void 0 : _g.deleteBeforeUpdate, checkOnly)];
                    case 9:
                        deployResult = _h.sent();
                        _h.label = 10;
                    case 10:
                        appliedChangesBeforeRestore = __spreadArrays(deployResult.appliedChanges);
                        return [4 /*yield*/, filtersRunner.onDeploy(appliedChangesBeforeRestore)];
                    case 11:
                        _h.sent();
                        sourceChanges = lodash_1["default"].keyBy(changeGroup.changes, function (change) { return adapter_api_1.getChangeData(change).elemID.getFullName(); });
                        return [4 /*yield*/, awu(appliedChangesBeforeRestore)
                                .map(function (change) { return adapter_utils_1.restoreChangeElement(change, sourceChanges, reference_mapping_1.getLookUpName); })
                                .toArray()];
                    case 12:
                        appliedChanges = _h.sent();
                        return [2 /*return*/, {
                                appliedChanges: appliedChanges,
                                errors: deployResult.errors,
                                extraProperties: deployResult.extraProperties,
                            }];
                }
            });
        });
    };
    SalesforceAdapter.prototype.deploy = function (deployOptions) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var checkOnly, result;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        checkOnly = (_d = (_c = (_b = (_a = this.userConfig) === null || _a === void 0 ? void 0 : _a.client) === null || _b === void 0 ? void 0 : _b.deploy) === null || _c === void 0 ? void 0 : _c.checkOnly) !== null && _d !== void 0 ? _d : false;
                        return [4 /*yield*/, this.deployOrValidate(deployOptions, checkOnly)
                            // If we got here with checkOnly we must not return any applied changes
                            // to maintain the old deploy interface (SALTO-2700)
                        ];
                    case 1:
                        result = _e.sent();
                        // If we got here with checkOnly we must not return any applied changes
                        // to maintain the old deploy interface (SALTO-2700)
                        if (checkOnly) {
                            return [2 /*return*/, __assign(__assign({}, result), { appliedChanges: [] })];
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    SalesforceAdapter.prototype.validate = function (deployOptions) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.deployOrValidate(deployOptions, true)];
            });
        });
    };
    SalesforceAdapter.prototype.listMetadataTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.listMetadataTypes()];
                    case 1: return [2 /*return*/, (_a.sent())
                            .filter(function (info) { return _this.fetchProfile.metadataQuery.isTypeMatch(info.xmlName); })];
                }
            });
        });
    };
    SalesforceAdapter.prototype.fetchMetadataTypes = function (typeInfoPromise, knownMetadataTypes) {
        return __awaiter(this, void 0, void 0, function () {
            var typeInfos, knownTypes, _a, baseTypeNames, childTypeNames;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, typeInfoPromise];
                    case 1:
                        typeInfos = _b.sent();
                        _a = Map.bind;
                        return [4 /*yield*/, awu(knownMetadataTypes).map(function (mdType) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, transformer_1.apiName(mdType)];
                                    case 1: return [2 /*return*/, [_a.sent(), mdType]];
                                }
                            }); }); }).toArray()];
                    case 2:
                        knownTypes = new (_a.apply(Map, [void 0, _b.sent()]))();
                        baseTypeNames = new Set(typeInfos.map(function (type) { return type.xmlName; }));
                        childTypeNames = new Set(typeInfos.flatMap(function (type) { return type.childXmlNames; }).filter(lowerdash_1.values.isDefined));
                        return [4 /*yield*/, Promise.all(typeInfos.map(function (typeInfo) { return fetch_1.fetchMetadataType(_this.client, typeInfo, knownTypes, baseTypeNames, childTypeNames); }))];
                    case 3: return [2 /*return*/, (_b.sent()).flat()];
                }
            });
        });
    };
    SalesforceAdapter.prototype.fetchMetadataInstances = function (typeInfoPromise, types) {
        return __awaiter(this, void 0, void 0, function () {
            var readInstances, typeInfos, topLevelTypeNames, topLevelTypes, _a, _b, metadataTypesToRetrieve, metadataTypesToRead, allInstances;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        readInstances = function (metadataTypes) { return __awaiter(_this, void 0, void 0, function () {
                            var metadataTypesToRead, result;
                            var _this = this;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, awu(metadataTypes)
                                            .filter(function (type) { return __awaiter(_this, void 0, void 0, function () {
                                            var _a, _b;
                                            return __generator(this, function (_c) {
                                                switch (_c.label) {
                                                    case 0:
                                                        _b = (_a = this.metadataTypesOfInstancesFetchedInFilters)
                                                            .includes;
                                                        return [4 /*yield*/, transformer_1.apiName(type)];
                                                    case 1: return [2 /*return*/, !_b.apply(_a, [_c.sent()])];
                                                }
                                            });
                                        }); }).toArray()];
                                    case 1:
                                        metadataTypesToRead = _a.sent();
                                        return [4 /*yield*/, Promise.all(metadataTypesToRead
                                                .map(function (type) { return _this.createMetadataInstances(type); }))];
                                    case 2:
                                        result = _a.sent();
                                        return [2 /*return*/, {
                                                elements: lodash_1["default"].flatten(result.map(function (r) { return r.elements; })),
                                                configChanges: lodash_1["default"].flatten(result.map(function (r) { return r.configChanges; })),
                                            }];
                                }
                            });
                        }); };
                        return [4 /*yield*/, typeInfoPromise];
                    case 1:
                        typeInfos = _c.sent();
                        topLevelTypeNames = typeInfos.map(function (info) { return info.xmlName; });
                        _a = awu;
                        return [4 /*yield*/, types];
                    case 2: return [4 /*yield*/, _a.apply(void 0, [_c.sent()])
                            .filter(transformer_1.isMetadataObjectType)
                            .filter(function (t) { return __awaiter(_this, void 0, void 0, function () {
                            var _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _b = (_a = topLevelTypeNames).includes;
                                        return [4 /*yield*/, transformer_1.apiName(t)];
                                    case 1: return [2 /*return*/, (_b.apply(_a, [_c.sent()])
                                            || t.annotations.folderContentType !== undefined)];
                                }
                            });
                        }); })
                            .toArray()];
                    case 3:
                        topLevelTypes = _c.sent();
                        return [4 /*yield*/, partition(topLevelTypes, function (t) { return __awaiter(_this, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _b = (_a = this.metadataToRetrieve).includes;
                                        return [4 /*yield*/, transformer_1.apiName(t)];
                                    case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                                }
                            }); }); })];
                    case 4:
                        _b = _c.sent(), metadataTypesToRetrieve = _b[0], metadataTypesToRead = _b[1];
                        return [4 /*yield*/, Promise.all([
                                fetch_1.retrieveMetadataInstances({
                                    client: this.client,
                                    types: metadataTypesToRetrieve,
                                    metadataQuery: this.fetchProfile.metadataQuery,
                                    maxItemsInRetrieveRequest: this.maxItemsInRetrieveRequest,
                                }),
                                readInstances(metadataTypesToRead),
                            ])];
                    case 5:
                        allInstances = _c.sent();
                        return [2 /*return*/, {
                                elements: lodash_1["default"].flatten(allInstances.map(function (instances) { return instances.elements; })),
                                configChanges: lodash_1["default"].flatten(allInstances.map(function (instances) { return instances.configChanges; })),
                            }];
                }
            });
        });
    };
    /**
     * Create all the instances of specific metadataType
     * @param type the metadata type
     */
    SalesforceAdapter.prototype.createMetadataInstances = function (type) {
        return __awaiter(this, void 0, void 0, function () {
            var typeName, _a, fileProps, configChanges, instances;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, transformer_1.apiName(type)];
                    case 1:
                        typeName = _b.sent();
                        return [4 /*yield*/, fetch_1.listMetadataObjects(this.client, typeName)];
                    case 2:
                        _a = _b.sent(), fileProps = _a.elements, configChanges = _a.configChanges;
                        return [4 /*yield*/, fetch_1.fetchMetadataInstances({
                                client: this.client,
                                fileProps: fileProps,
                                metadataType: type,
                                metadataQuery: this.fetchProfile.metadataQuery,
                                maxInstancesPerType: this.fetchProfile.maxInstancesPerType,
                            })];
                    case 3:
                        instances = _b.sent();
                        return [2 /*return*/, {
                                elements: instances.elements,
                                configChanges: __spreadArrays(instances.configChanges, configChanges),
                            }];
                }
            });
        });
    };
    __decorate([
        adapter_utils_1.logDuration('fetching account configuration')
    ], SalesforceAdapter.prototype, "fetch");
    __decorate([
        adapter_utils_1.logDuration('fetching metadata types')
    ], SalesforceAdapter.prototype, "fetchMetadataTypes");
    __decorate([
        adapter_utils_1.logDuration('fetching instances')
    ], SalesforceAdapter.prototype, "fetchMetadataInstances");
    return SalesforceAdapter;
}());
exports["default"] = SalesforceAdapter;
