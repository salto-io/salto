"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.validateMetadataParams = exports.buildMetadataQuery = void 0;
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
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var constants_1 = require("../constants");
var config_validation_1 = require("../config_validation");
var types_1 = require("../types");
var isDefined = lowerdash_1.values.isDefined;
// According to Salesforce Metadata API docs, folder names can only contain alphanumeric characters and underscores.
var VALID_FOLDER_PATH_RE = /^[a-zA-Z\d_/]+$/;
var PERMANENT_SKIP_LIST = [
    // We have special treatment for this type
    { metadataType: 'CustomField' },
    { metadataType: constants_1.SETTINGS_METADATA_TYPE },
    // readMetadata and retrieve fail on this type when fetching by name
    { metadataType: 'CustomIndex' },
    // readMetadata fails on those and pass on the parents
    // (AssignmentRules and EscalationRules)
    { metadataType: 'AssignmentRule' },
    { metadataType: 'EscalationRule' },
    // May conflict with the MetadataType ForecastingCategoryMapping
    { metadataType: 'CustomObject', name: 'ForecastingCategoryMapping' },
];
// Instances of these types will match all namespaces
// and not just standard if '' (aka default) is provided in the namespace filter
var DEFAULT_NAMESPACE_MATCH_ALL_TYPE_LIST = [
    'InstalledPackage',
];
var getDefaultNamespace = function (metadataType) {
    return (DEFAULT_NAMESPACE_MATCH_ALL_TYPE_LIST.includes(metadataType)
        ? '.*'
        : constants_1.DEFAULT_NAMESPACE);
};
var getPaths = function (regexString) { return (regexString
    .replace(/[()^$]/g, '')
    .split('|')
    .filter(function (path) { return VALID_FOLDER_PATH_RE.test(path); })); };
// Since fullPaths are provided for nested Folder names, a special handling is required
var isFolderMetadataTypeNameMatch = function (_a, name) {
    var instanceName = _a.name;
    return (getPaths(name)
        .some(function (path) { return path.endsWith(instanceName); })
        || lowerdash_1.regex.isFullRegexMatch(instanceName, name));
};
var buildMetadataQuery = function (_a, target) {
    var _b = _a.include, include = _b === void 0 ? [{}] : _b, _c = _a.exclude, exclude = _c === void 0 ? [] : _c;
    var fullExcludeList = __spreadArrays(exclude, PERMANENT_SKIP_LIST);
    var isInstanceMatchQueryParams = function (instance, _a) {
        var _b = _a.metadataType, metadataType = _b === void 0 ? '.*' : _b, _c = _a.namespace, namespace = _c === void 0 ? '.*' : _c, _d = _a.name, name = _d === void 0 ? '.*' : _d;
        var realNamespace = namespace === ''
            ? getDefaultNamespace(instance.metadataType)
            : namespace;
        if (!lowerdash_1.regex.isFullRegexMatch(instance.metadataType, metadataType)
            || !lowerdash_1.regex.isFullRegexMatch(instance.namespace, realNamespace)) {
            return false;
        }
        return instance.isFolderType
            ? isFolderMetadataTypeNameMatch(instance, name)
            : lowerdash_1.regex.isFullRegexMatch(instance.name, name);
    };
    var isIncludedInPartialFetch = function (type) {
        if (target === undefined) {
            return true;
        }
        if (target.includes(type)) {
            return true;
        }
        if (type === constants_1.TOPICS_FOR_OBJECTS_METADATA_TYPE && target.includes(constants_1.CUSTOM_OBJECT)) {
            return true;
        }
        // We should really do this only when config.preferActiveFlowVersions is true
        // if you have another use-case to pass the config here also handle this please
        if (type === constants_1.FLOW_DEFINITION_METADATA_TYPE && target.includes(constants_1.FLOW_METADATA_TYPE)) {
            return true;
        }
        return false;
    };
    var isTypeIncluded = function (type) { return (include.some(function (_a) {
        var _b = _a.metadataType, metadataType = _b === void 0 ? '.*' : _b;
        return new RegExp("^" + metadataType + "$").test(type);
    })
        && isIncludedInPartialFetch(type)); };
    var isTypeExcluded = function (type) { return (fullExcludeList.some(function (_a) {
        var _b = _a.metadataType, metadataType = _b === void 0 ? '.*' : _b, _c = _a.namespace, namespace = _c === void 0 ? '.*' : _c, _d = _a.name, name = _d === void 0 ? '.*' : _d;
        return (namespace === '.*' && name === '.*' && new RegExp("^" + metadataType + "$").test(type));
    })); };
    return {
        isTypeMatch: function (type) { return isTypeIncluded(type) && !isTypeExcluded(type); },
        isInstanceMatch: function (instance) { return (include.some(function (params) { return isInstanceMatchQueryParams(instance, params); })
            && !fullExcludeList.some(function (params) { return isInstanceMatchQueryParams(instance, params); })); },
        isPartialFetch: function () { return target !== undefined; },
        getFolderPathsByName: function (folderType) {
            var folderPaths = include
                .filter(function (params) { return params.metadataType === folderType; })
                .flatMap(function (params) {
                var nameRegex = params.name;
                return isDefined(nameRegex)
                    ? getPaths(nameRegex)
                    : [];
            });
            return lodash_1["default"].keyBy(folderPaths, function (path) { var _a; return (_a = lodash_1["default"].last(path.split('/'))) !== null && _a !== void 0 ? _a : path; });
        },
    };
};
exports.buildMetadataQuery = buildMetadataQuery;
var validateMetadataQueryParams = function (params, fieldPath) {
    params.forEach(function (queryParams) { return Object.entries(queryParams)
        .forEach(function (_a) {
        var queryField = _a[0], pattern = _a[1];
        if (pattern === undefined) {
            return;
        }
        config_validation_1.validateRegularExpressions([pattern], __spreadArrays(fieldPath, [queryField]));
    }); });
};
var validateMetadataParams = function (params, fieldPath) {
    var _a, _b;
    validateMetadataQueryParams((_a = params.include) !== null && _a !== void 0 ? _a : [], __spreadArrays(fieldPath, [types_1.METADATA_INCLUDE_LIST]));
    validateMetadataQueryParams((_b = params.exclude) !== null && _b !== void 0 ? _b : [], __spreadArrays(fieldPath, [types_1.METADATA_EXCLUDE_LIST]));
    if (params.objectsToSeperateFieldsToFiles !== undefined
        && params.objectsToSeperateFieldsToFiles.length > constants_1.MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD) {
        throw new config_validation_1.ConfigValidationError(__spreadArrays(fieldPath, [types_1.METADATA_SEPARATE_FIELD_LIST]), types_1.METADATA_SEPARATE_FIELD_LIST + " should not be larger than " + constants_1.MAX_TYPES_TO_SEPARATE_TO_FILE_PER_FIELD + ". current length is " + params.objectsToSeperateFieldsToFiles.length);
    }
};
exports.validateMetadataParams = validateMetadataParams;
