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
exports.buildFilePropsMetadataQuery = exports.validateMetadataParams = exports.buildMetadataQueryForFetchWithChangesDetection = exports.buildMetadataQuery = void 0;
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
var utils_1 = require("../filters/utils");
var last_change_date_of_types_with_nested_instances_1 = require("../last_change_date_of_types_with_nested_instances");
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
// Instances of this type won't be fetched in fetchWithChangesDetection mode
var UNSUPPORTED_FETCH_WITH_CHANGES_DETECTION_TYPES = [
    constants_1.PROFILE_METADATA_TYPE,
    // Since we don't retrieve the CustomMetadata types (CustomObjects), we shouldn't retrieve the Records
    constants_1.CUSTOM_METADATA,
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
var buildMetadataQuery = function (_a) {
    var fetchParams = _a.fetchParams;
    var _b = fetchParams.metadata, metadata = _b === void 0 ? {} : _b, target = fetchParams.target;
    var _c = metadata.include, include = _c === void 0 ? [{}] : _c, _d = metadata.exclude, exclude = _d === void 0 ? [] : _d;
    var fullExcludeList = __spreadArrays(exclude, PERMANENT_SKIP_LIST);
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
    var isInstanceIncluded = function (instance) { return (include.some(function (params) { return isInstanceMatchQueryParams(instance, params); })
        && !fullExcludeList.some(function (params) { return isInstanceMatchQueryParams(instance, params); })); };
    var isTargetedFetch = function () { return target !== undefined; };
    return {
        isTypeMatch: function (type) { return isTypeIncluded(type) && !isTypeExcluded(type); },
        isTargetedFetch: isTargetedFetch,
        isInstanceIncluded: isInstanceIncluded,
        isInstanceMatch: isInstanceIncluded,
        isFetchWithChangesDetection: function () { return false; },
        isPartialFetch: isTargetedFetch,
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
var isValidDateString = function (dateString) { return (dateString !== undefined && dateString !== ''); };
var buildMetadataQueryForFetchWithChangesDetection = function (params) { return __awaiter(void 0, void 0, void 0, function () {
    var elementsSource, lastChangeDateOfTypesWithNestedInstances, changedAtSingleton, singletonValues, lastChangeDateOfTypesWithNestedInstancesFromSingleton, metadataQuery, isInstanceWithNestedInstancesIncluded, isInstanceWithNestedInstancesPerParentIncluded, isIncludedInFetchWithChangesDetection;
    var _a, _b, _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                elementsSource = params.elementsSource, lastChangeDateOfTypesWithNestedInstances = params.lastChangeDateOfTypesWithNestedInstances;
                return [4 /*yield*/, utils_1.getChangedAtSingletonInstance(elementsSource)];
            case 1:
                changedAtSingleton = _g.sent();
                if (changedAtSingleton === undefined) {
                    throw new Error('First fetch does not support changes detection');
                }
                singletonValues = changedAtSingleton.value;
                lastChangeDateOfTypesWithNestedInstancesFromSingleton = {
                    AssignmentRules: (_a = singletonValues.AssignmentRules) !== null && _a !== void 0 ? _a : {},
                    AutoResponseRules: (_b = singletonValues.AutoResponseRules) !== null && _b !== void 0 ? _b : {},
                    CustomObject: (_c = singletonValues.CustomObject) !== null && _c !== void 0 ? _c : {},
                    EscalationRules: (_d = singletonValues.EscalationRules) !== null && _d !== void 0 ? _d : {},
                    SharingRules: (_e = singletonValues.SharingRules) !== null && _e !== void 0 ? _e : {},
                    Workflow: (_f = singletonValues.Workflow) !== null && _f !== void 0 ? _f : {},
                    CustomLabels: singletonValues.CustomLabels,
                };
                metadataQuery = exports.buildMetadataQuery(params);
                isInstanceWithNestedInstancesIncluded = function (type) {
                    var dateFromSingleton = lastChangeDateOfTypesWithNestedInstancesFromSingleton[type];
                    var lastChangeDate = lastChangeDateOfTypesWithNestedInstances[type];
                    return isValidDateString(dateFromSingleton) && isValidDateString(lastChangeDate)
                        ? new Date(dateFromSingleton).getTime() < new Date(lastChangeDate).getTime()
                        : true;
                };
                isInstanceWithNestedInstancesPerParentIncluded = function (type, instanceName) {
                    var parentName = instanceName.split('.')[0];
                    var dateFromSingleton = lastChangeDateOfTypesWithNestedInstancesFromSingleton[type][parentName];
                    var lastChangeDate = lastChangeDateOfTypesWithNestedInstances[type][parentName];
                    return isValidDateString(dateFromSingleton) && isValidDateString(lastChangeDate)
                        ? new Date(dateFromSingleton).getTime() < new Date(lastChangeDate).getTime()
                        : true;
                };
                isIncludedInFetchWithChangesDetection = function (instance) {
                    var dateFromSingleton = lodash_1["default"].get(singletonValues, [instance.metadataType, instance.name]);
                    return isValidDateString(dateFromSingleton) && isValidDateString(instance.changedAt)
                        ? new Date(dateFromSingleton).getTime() < new Date(instance.changedAt).getTime()
                        : true;
                };
                return [2 /*return*/, __assign(__assign({}, metadataQuery), { isTypeMatch: function (type) { return (metadataQuery.isTypeMatch(type)
                            && !UNSUPPORTED_FETCH_WITH_CHANGES_DETECTION_TYPES.includes(type)); }, isPartialFetch: function () { return true; }, isFetchWithChangesDetection: function () { return true; }, isInstanceMatch: function (instance) {
                            if (!metadataQuery.isInstanceIncluded(instance)) {
                                return false;
                            }
                            var metadataType = instance.metadataType, name = instance.name;
                            if (last_change_date_of_types_with_nested_instances_1.isTypeWithNestedInstances(metadataType)) {
                                return isInstanceWithNestedInstancesIncluded(metadataType);
                            }
                            if (last_change_date_of_types_with_nested_instances_1.isTypeWithNestedInstancesPerParent(metadataType)) {
                                return isInstanceWithNestedInstancesPerParentIncluded(metadataType, name);
                            }
                            return isIncludedInFetchWithChangesDetection(instance);
                        } })];
        }
    });
}); };
exports.buildMetadataQueryForFetchWithChangesDetection = buildMetadataQueryForFetchWithChangesDetection;
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
var buildFilePropsMetadataQuery = function (metadataQuery) {
    var filePropsToMetadataInstance = function (_a) {
        var namespacePrefix = _a.namespacePrefix, metadataType = _a.type, name = _a.fullName, changedAt = _a.lastModifiedDate;
        return ({
            namespace: namespacePrefix === undefined || namespacePrefix === '' ? constants_1.DEFAULT_NAMESPACE : namespacePrefix,
            metadataType: metadataType,
            name: name,
            changedAt: changedAt,
            isFolderType: false,
        });
    };
    return __assign(__assign({}, metadataQuery), { isInstanceIncluded: function (instance) { return metadataQuery.isInstanceIncluded(filePropsToMetadataInstance(instance)); }, isInstanceMatch: function (instance) { return metadataQuery.isInstanceMatch(filePropsToMetadataInstance(instance)); } });
};
exports.buildFilePropsMetadataQuery = buildFilePropsMetadataQuery;
