"use strict";
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14;
exports.__esModule = true;
exports.TYPES_WITH_NESTED_INSTANCES_PER_PARENT = exports.TYPES_WITH_NESTED_INSTANCES = exports.configType = exports.OauthAccessTokenCredentials = exports.UsernamePasswordCredentials = exports.isAccessTokenConfig = exports.oauthRequestParameters = exports.accessTokenCredentialsType = exports.usernamePasswordCredentialsType = exports.isRetrieveSizeConfigSuggstion = exports.isMetadataConfigSuggestions = exports.isDataManagementConfigSuggestions = exports.RetryStrategyName = exports.outgoingReferenceBehaviors = exports.INSTANCE_SUFFIXES = exports.ENUM_FIELD_PERMISSIONS = exports.SHOULD_FETCH_ALL_CUSTOM_SETTINGS = exports.INSTANCES_REGEX_SKIPPED_LIST = exports.DATA_MANAGEMENT = exports.METADATA_TYPES_SKIPPED_LIST = exports.DATA_CONFIGURATION = exports.METADATA_SEPARATE_FIELD_LIST = exports.METADATA_EXCLUDE_LIST = exports.METADATA_INCLUDE_LIST = exports.METADATA_CONFIG = exports.DEPLOY_CONFIG = exports.FETCH_CONFIG = exports.CUSTOM_OBJECTS_DEPLOY_RETRY_OPTIONS = exports.MAX_INSTANCES_PER_TYPE = exports.MAX_ITEMS_IN_RETRIEVE_REQUEST = exports.CLIENT_CONFIG = void 0;
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
var adapter_utils_1 = require("@salto-io/adapter-utils");
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_components_1 = require("@salto-io/adapter-components");
var metadata_types_1 = require("./fetch_profile/metadata_types");
var constants = require("./constants");
var constants_1 = require("./constants");
var createUserDeployConfigType = adapter_components_1.config.createUserDeployConfigType;
exports.CLIENT_CONFIG = 'client';
exports.MAX_ITEMS_IN_RETRIEVE_REQUEST = 'maxItemsInRetrieveRequest';
exports.MAX_INSTANCES_PER_TYPE = 'maxInstancesPerType';
exports.CUSTOM_OBJECTS_DEPLOY_RETRY_OPTIONS = 'customObjectsDeployRetryOptions';
exports.FETCH_CONFIG = 'fetch';
exports.DEPLOY_CONFIG = 'deploy';
exports.METADATA_CONFIG = 'metadata';
exports.METADATA_INCLUDE_LIST = 'include';
exports.METADATA_EXCLUDE_LIST = 'exclude';
var METADATA_TYPE = 'metadataType';
var METADATA_NAME = 'name';
var METADATA_NAMESPACE = 'namespace';
exports.METADATA_SEPARATE_FIELD_LIST = 'objectsToSeperateFieldsToFiles';
exports.DATA_CONFIGURATION = 'data';
exports.METADATA_TYPES_SKIPPED_LIST = 'metadataTypesSkippedList';
exports.DATA_MANAGEMENT = 'dataManagement';
exports.INSTANCES_REGEX_SKIPPED_LIST = 'instancesRegexSkippedList';
exports.SHOULD_FETCH_ALL_CUSTOM_SETTINGS = 'fetchAllCustomSettings';
exports.ENUM_FIELD_PERMISSIONS = 'enumFieldPermissions';
// Based on the list in https://salesforce.stackexchange.com/questions/101844/what-are-the-object-and-field-name-suffixes-that-salesforce-uses-such-as-c-an
exports.INSTANCE_SUFFIXES = [
    'c', 'r', 'ka', 'kav', 'Feed', 'ViewStat', 'VoteStat', 'DataCategorySelection', 'x', 'xo', 'mdt', 'Share', 'Tag',
    'History', 'pc', 'pr', 'hd', 'hqr', 'hst', 'b', 'latitude__s', 'longitude__s', 'e', 'p', 'ChangeEvent', 'chn', 'gvs',
];
exports.outgoingReferenceBehaviors = ['ExcludeInstance', 'BrokenReference', 'InternalId'];
var objectIdSettings = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'objectIdSettings'),
    fields: {
        objectsRegex: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_a = {},
                _a[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true,
                _a),
        },
        idFields: {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
            annotations: (_b = {},
                _b[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true,
                _b),
        },
    },
    annotations: (_c = {},
        _c[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _c),
});
var saltoIDSettingsType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'saltoIDSettings'),
    fields: {
        defaultIdFields: {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
            annotations: (_d = {},
                _d[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true,
                _d),
        },
        overrides: {
            refType: new adapter_api_1.ListType(objectIdSettings),
        },
    },
    annotations: (_e = {},
        _e[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _e),
});
var objectAliasSettings = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'objectAliasSettings'),
    fields: {
        objectsRegex: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_f = {},
                _f[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true,
                _f),
        },
        aliasFields: {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
            annotations: (_g = {},
                _g[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true,
                _g),
        },
    },
    annotations: (_h = {},
        _h[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _h),
});
var saltoAliasSettingsType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'saltoAliasSettings'),
    fields: {
        defaultAliasFields: {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
        },
        overrides: {
            refType: new adapter_api_1.ListType(objectAliasSettings),
        },
    },
    annotations: (_j = {},
        _j[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _j),
});
var saltoManagementFieldSettingsType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'saltoManagementFieldSettings'),
    fields: {
        defaultFieldName: {
            refType: adapter_api_1.BuiltinTypes.STRING,
        },
    },
    annotations: (_k = {},
        _k[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _k),
});
var brokenOutgoingReferencesSettingsType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'brokenOutgoingReferencesSettings'),
    fields: {
        defaultBehavior: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_l = {},
                _l[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                    values: exports.outgoingReferenceBehaviors,
                }),
                _l),
        },
        perTargetTypeOverrides: {
            refType: new adapter_api_1.MapType(adapter_api_1.BuiltinTypes.STRING),
        },
    },
    annotations: (_m = {},
        _m[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _m),
});
var warningSettingsType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'saltoWarningSettings'),
    fields: {
        nonQueryableFields: {
            refType: adapter_api_1.BuiltinTypes.BOOLEAN,
        },
    },
});
var RetryStrategyName;
(function (RetryStrategyName) {
    RetryStrategyName[RetryStrategyName["HttpError"] = 0] = "HttpError";
    RetryStrategyName[RetryStrategyName["HTTPOrNetworkError"] = 1] = "HTTPOrNetworkError";
    RetryStrategyName[RetryStrategyName["NetworkError"] = 2] = "NetworkError";
})(RetryStrategyName = exports.RetryStrategyName || (exports.RetryStrategyName = {}));
var isDataManagementConfigSuggestions = function (suggestion) { return suggestion.type === 'dataObjectsExclude'; };
exports.isDataManagementConfigSuggestions = isDataManagementConfigSuggestions;
var isMetadataConfigSuggestions = function (suggestion) { return suggestion.type === 'metadataExclude'; };
exports.isMetadataConfigSuggestions = isMetadataConfigSuggestions;
var isRetrieveSizeConfigSuggstion = function (suggestion) { return suggestion.type === exports.MAX_ITEMS_IN_RETRIEVE_REQUEST; };
exports.isRetrieveSizeConfigSuggstion = isRetrieveSizeConfigSuggstion;
var configID = new adapter_api_1.ElemID('salesforce');
exports.usernamePasswordCredentialsType = new adapter_api_1.ObjectType({
    elemID: configID,
    fields: {
        username: { refType: adapter_api_1.BuiltinTypes.STRING },
        password: { refType: adapter_api_1.BuiltinTypes.STRING },
        token: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: { message: 'Token (empty if your org uses IP whitelisting)' },
        },
        sandbox: {
            refType: adapter_api_1.BuiltinTypes.BOOLEAN,
            annotations: { message: 'Is Sandbox/Scratch Org' },
        },
    },
});
exports.accessTokenCredentialsType = new adapter_api_1.ObjectType({
    elemID: configID,
    fields: {
        accessToken: { refType: adapter_api_1.BuiltinTypes.STRING },
        instanceUrl: { refType: adapter_api_1.BuiltinTypes.STRING },
        sandbox: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
    },
});
exports.oauthRequestParameters = new adapter_api_1.ObjectType({
    elemID: configID,
    fields: {
        consumerKey: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: { message: 'Consumer key for a connected app, whose redirect URI is http://localhost:port' },
        },
        consumerSecret: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: { message: 'Consumer secret for a connected app, whose redirect URI is http://localhost:port' },
        },
        port: {
            refType: adapter_api_1.BuiltinTypes.NUMBER,
            annotations: { message: 'Port provided in the redirect URI' },
        },
        sandbox: {
            refType: adapter_api_1.BuiltinTypes.BOOLEAN,
            annotations: { message: 'Is connection to a sandbox?' },
        },
    },
});
var isAccessTokenConfig = function (config) {
    return config.value.authType === 'oauth';
};
exports.isAccessTokenConfig = isAccessTokenConfig;
var UsernamePasswordCredentials = /** @class */ (function () {
    function UsernamePasswordCredentials(_a) {
        var username = _a.username, password = _a.password, isSandbox = _a.isSandbox, apiToken = _a.apiToken;
        this.username = username;
        this.password = password;
        this.isSandbox = isSandbox;
        this.apiToken = apiToken;
    }
    return UsernamePasswordCredentials;
}());
exports.UsernamePasswordCredentials = UsernamePasswordCredentials;
var OauthAccessTokenCredentials = /** @class */ (function () {
    function OauthAccessTokenCredentials(_a) {
        var instanceUrl = _a.instanceUrl, accessToken = _a.accessToken, refreshToken = _a.refreshToken, isSandbox = _a.isSandbox, clientId = _a.clientId, clientSecret = _a.clientSecret;
        this.instanceUrl = instanceUrl;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.isSandbox = isSandbox;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }
    return OauthAccessTokenCredentials;
}());
exports.OauthAccessTokenCredentials = OauthAccessTokenCredentials;
var dataManagementType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, exports.DATA_CONFIGURATION),
    fields: {
        includeObjects: {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
        },
        excludeObjects: {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
        },
        allowReferenceTo: {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
        },
        saltoIDSettings: {
            refType: saltoIDSettingsType,
            annotations: (_o = {},
                _o[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true,
                _o),
        },
        saltoAliasSettings: {
            refType: saltoAliasSettingsType,
        },
        saltoManagementFieldSettings: {
            refType: saltoManagementFieldSettingsType,
        },
        brokenOutgoingReferencesSettings: {
            refType: brokenOutgoingReferencesSettingsType,
        },
        omittedFields: {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
        },
    },
    annotations: (_p = {},
        _p[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _p),
});
var clientPollingConfigType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'clientPollingConfig'),
    fields: {
        interval: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        deployTimeout: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        fetchTimeout: { refType: adapter_api_1.BuiltinTypes.NUMBER },
    },
    annotations: (_q = {},
        _q[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _q),
});
var QuickDeployParamsType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'quickDeployParams'),
    fields: {
        requestId: { refType: adapter_api_1.BuiltinTypes.STRING },
        hash: { refType: adapter_api_1.BuiltinTypes.STRING },
    },
    annotations: (_r = {},
        _r[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _r),
});
var clientDeployConfigType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'clientDeployConfig'),
    fields: {
        rollbackOnError: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        ignoreWarnings: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        purgeOnDelete: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        checkOnly: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        testLevel: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_s = {},
                _s[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                    values: ['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg'],
                }),
                _s),
        },
        runTests: { refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING) },
        deleteBeforeUpdate: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        quickDeployParams: { refType: QuickDeployParamsType },
    },
    annotations: (_t = {},
        _t[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _t),
});
var clientRateLimitConfigType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'clientRateLimitConfig'),
    fields: {
        total: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        retrieve: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        read: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        list: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        query: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        describe: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        deploy: { refType: adapter_api_1.BuiltinTypes.NUMBER },
    },
    annotations: (_u = {},
        _u[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _u),
});
var clientRetryConfigType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'clientRetryConfig'),
    fields: {
        maxAttempts: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        retryDelay: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        retryStrategy: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_v = {},
                _v[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                    values: Object.keys(RetryStrategyName),
                }),
                _v),
        },
        timeout: { refType: adapter_api_1.BuiltinTypes.NUMBER },
    },
    annotations: (_w = {},
        _w[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _w),
});
var readMetadataChunkSizeConfigType = adapter_utils_1.createMatchingObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'readMetadataChunkSizeConfig'),
    fields: {
        "default": { refType: adapter_api_1.BuiltinTypes.NUMBER },
        overrides: {
            refType: new adapter_api_1.MapType(adapter_api_1.BuiltinTypes.NUMBER),
            annotations: (_x = {}, _x[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({ min: 1, max: 10 }), _x),
        },
    },
    annotations: (_y = {},
        _y[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _y),
});
var clientConfigType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'clientConfig'),
    fields: {
        polling: { refType: clientPollingConfigType },
        deploy: { refType: clientDeployConfigType },
        retry: { refType: clientRetryConfigType },
        maxConcurrentApiRequests: { refType: clientRateLimitConfigType },
        readMetadataChunkSize: { refType: readMetadataChunkSizeConfigType },
    },
    annotations: (_z = {},
        _z[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _z),
});
var metadataQueryType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'metadataQuery'),
    fields: (_0 = {},
        _0[METADATA_TYPE] = { refType: adapter_api_1.BuiltinTypes.STRING },
        _0[METADATA_NAMESPACE] = { refType: adapter_api_1.BuiltinTypes.STRING },
        _0[METADATA_NAME] = { refType: adapter_api_1.BuiltinTypes.STRING },
        _0),
    annotations: (_1 = {},
        _1[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _1),
});
var metadataConfigType = adapter_utils_1.createMatchingObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'metadataConfig'),
    fields: (_2 = {},
        _2[exports.METADATA_INCLUDE_LIST] = { refType: new adapter_api_1.ListType(metadataQueryType) },
        _2[exports.METADATA_EXCLUDE_LIST] = { refType: new adapter_api_1.ListType(metadataQueryType) },
        _2[exports.METADATA_SEPARATE_FIELD_LIST] = {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
            annotations: (_3 = {},
                _3[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                    max_length: constants.MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD,
                }),
                _3),
        },
        _2),
    annotations: (_4 = {},
        _4[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _4),
});
var optionalFeaturesType = adapter_utils_1.createMatchingObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'optionalFeatures'),
    fields: {
        extraDependencies: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        elementsUrls: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        profilePaths: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        addMissingIds: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        authorInformation: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        describeSObjects: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        skipAliases: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        formulaDeps: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        fetchCustomObjectUsingRetrieveApi: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        generateRefsInProfiles: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        fetchProfilesUsingReadApi: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        toolingDepsOfCurrentNamespace: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        useLabelAsAlias: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        fixRetrieveFilePaths: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        organizationWideSharingDefaults: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
    },
    annotations: (_5 = {},
        _5[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _5),
});
var changeValidatorConfigType = adapter_utils_1.createMatchingObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'changeValidatorConfig'),
    fields: {
        managedPackage: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        picklistStandardField: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        customObjectInstances: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        unknownField: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        customFieldType: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        standardFieldLabel: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        mapKeys: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        multipleDefaults: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        picklistPromote: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        cpqValidator: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        recordTypeDeletion: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        flowsValidator: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        fullNameChangedValidator: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        invalidListViewFilterScope: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        caseAssignmentRulesValidator: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        omitData: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        dataChange: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        unknownUser: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        animationRuleRecordType: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        currencyIsoCodes: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        duplicateRulesSortOrder: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        lastLayoutRemoval: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        accountSettings: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        unknownPicklistValues: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        dataCategoryGroup: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        installedPackages: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        standardFieldOrObjectAdditionsOrDeletions: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        deletedNonQueryableFields: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
    },
    annotations: (_6 = {},
        _6[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _6),
});
var fetchConfigType = adapter_utils_1.createMatchingObjectType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'fetchConfig'),
    fields: {
        metadata: { refType: metadataConfigType },
        data: { refType: dataManagementType },
        optionalFeatures: { refType: optionalFeaturesType },
        fetchAllCustomSettings: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        target: {
            refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
            annotations: (_7 = {},
                _7[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                    enforce_value: true,
                    values: metadata_types_1.SUPPORTED_METADATA_TYPES,
                }),
                _7),
        },
        maxInstancesPerType: { refType: adapter_api_1.BuiltinTypes.NUMBER },
        preferActiveFlowVersions: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        addNamespacePrefixToFullName: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        warningSettings: { refType: warningSettingsType },
    },
    annotations: (_8 = {},
        _8[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _8),
});
exports.configType = adapter_utils_1.createMatchingObjectType({
    elemID: configID,
    fields: (_9 = {},
        _9[exports.FETCH_CONFIG] = {
            refType: fetchConfigType,
            annotations: (_10 = {},
                _10[adapter_api_1.CORE_ANNOTATIONS.DEFAULT] = (_11 = {},
                    _11[exports.METADATA_CONFIG] = (_12 = {},
                        _12[exports.METADATA_INCLUDE_LIST] = [
                            {
                                metadataType: '.*',
                                namespace: '',
                                name: '.*',
                            },
                        ],
                        _12[exports.METADATA_EXCLUDE_LIST] = [
                            { metadataType: 'Report' },
                            { metadataType: 'ReportType' },
                            { metadataType: 'ReportFolder' },
                            { metadataType: 'Dashboard' },
                            { metadataType: 'DashboardFolder' },
                            { metadataType: 'Document' },
                            { metadataType: 'DocumentFolder' },
                            { metadataType: 'Profile' },
                            { metadataType: 'PermissionSet' },
                            { metadataType: 'SiteDotCom' },
                            {
                                metadataType: 'EmailTemplate',
                                name: 'MarketoEmailTemplates/.*',
                            },
                            { metadataType: 'ContentAsset' },
                            { metadataType: 'CustomObjectTranslation' },
                            { metadataType: 'AnalyticSnapshot' },
                            { metadataType: 'WaveDashboard' },
                            { metadataType: 'WaveDataflow' },
                            {
                                metadataType: 'StandardValueSet',
                                name: '^(AddressCountryCode)|(AddressStateCode)$',
                                namespace: '',
                            },
                            {
                                metadataType: 'Layout',
                                name: 'CollaborationGroup-Group Layout',
                            },
                            {
                                metadataType: 'Layout',
                                name: 'CaseInteraction-Case Feed Layout',
                            },
                        ],
                        _12),
                    _11[exports.SHOULD_FETCH_ALL_CUSTOM_SETTINGS] = false,
                    _11[exports.MAX_INSTANCES_PER_TYPE] = constants_1.DEFAULT_MAX_INSTANCES_PER_TYPE,
                    _11),
                _10),
        },
        _9[exports.MAX_ITEMS_IN_RETRIEVE_REQUEST] = {
            refType: adapter_api_1.BuiltinTypes.NUMBER,
            annotations: (_13 = {},
                _13[adapter_api_1.CORE_ANNOTATIONS.DEFAULT] = constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
                _13[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                    min: constants.MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST,
                    max: constants.MAXIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST,
                }),
                _13),
        },
        _9[exports.ENUM_FIELD_PERMISSIONS] = {
            refType: adapter_api_1.BuiltinTypes.BOOLEAN,
        },
        _9[exports.CLIENT_CONFIG] = {
            refType: clientConfigType,
        },
        _9[exports.DEPLOY_CONFIG] = {
            refType: createUserDeployConfigType(constants_1.SALESFORCE, changeValidatorConfigType),
        },
        _9),
    annotations: (_14 = {},
        _14[adapter_api_1.CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false,
        _14),
});
exports.TYPES_WITH_NESTED_INSTANCES = [
    constants_1.CUSTOM_LABELS_METADATA_TYPE,
];
exports.TYPES_WITH_NESTED_INSTANCES_PER_PARENT = [
    constants_1.CUSTOM_OBJECT,
    constants_1.ASSIGNMENT_RULES_METADATA_TYPE,
    constants_1.AUTO_RESPONSE_RULES_METADATA_TYPE,
    constants_1.SHARING_RULES_TYPE,
    constants_1.ESCALATION_RULES_TYPE,
    constants_1.WORKFLOW_METADATA_TYPE,
];
