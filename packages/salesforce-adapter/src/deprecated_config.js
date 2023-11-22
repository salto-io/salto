"use strict";
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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.updateDeprecatedConfiguration = exports.PACKAGES_INSTANCES_REGEX = exports.DEPRECATED_OPTIONS_MESSAGE = void 0;
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var config_validation_1 = require("./config_validation");
var data_management_1 = require("./fetch_profile/data_management");
var types_1 = require("./types");
exports.DEPRECATED_OPTIONS_MESSAGE = 'The configuration options "metadataTypesSkippedList", "instancesRegexSkippedList" and "dataManagement" are deprecated.'
    + ' The following changes will update the deprecated options to the "fetch" configuration option.';
var makeArray = lowerdash_1.collections.array.makeArray;
var log = logging_1.logger(module);
exports.PACKAGES_INSTANCES_REGEX = "^.+\\.(?!standard_)[^_]+__(?!(" + types_1.INSTANCE_SUFFIXES.join('|') + ")([^a-zA-Z\\d_]+|$)).+$";
var DEPRECATED_FIELDS = [
    types_1.INSTANCES_REGEX_SKIPPED_LIST,
    types_1.METADATA_TYPES_SKIPPED_LIST,
    types_1.DATA_MANAGEMENT,
];
var validateDeprecatedParameters = function (config) {
    var _a, _b;
    if (config.value[types_1.METADATA_TYPES_SKIPPED_LIST] !== undefined) {
        log.warn(types_1.METADATA_TYPES_SKIPPED_LIST + " configuration option is deprecated. " + types_1.FETCH_CONFIG + "." + types_1.METADATA_CONFIG + " should be used instead");
    }
    if (config.value[types_1.INSTANCES_REGEX_SKIPPED_LIST] !== undefined) {
        log.warn(types_1.INSTANCES_REGEX_SKIPPED_LIST + " configuration option is deprecated. " + types_1.FETCH_CONFIG + "." + types_1.METADATA_CONFIG + " should be used instead");
        config_validation_1.validateRegularExpressions((_a = config === null || config === void 0 ? void 0 : config.value) === null || _a === void 0 ? void 0 : _a[types_1.INSTANCES_REGEX_SKIPPED_LIST], [types_1.INSTANCES_REGEX_SKIPPED_LIST]);
    }
    if (config.value[types_1.DATA_MANAGEMENT] !== undefined) {
        if (((_b = config.value[types_1.FETCH_CONFIG]) === null || _b === void 0 ? void 0 : _b[types_1.DATA_CONFIGURATION]) !== undefined) {
            throw new config_validation_1.ConfigValidationError([types_1.DATA_MANAGEMENT], types_1.FETCH_CONFIG + "." + types_1.DATA_CONFIGURATION + " configuration option cannot be used with " + types_1.DATA_MANAGEMENT + " option. The configuration of " + types_1.DATA_MANAGEMENT + " should be moved to " + types_1.FETCH_CONFIG + "." + types_1.DATA_CONFIGURATION);
        }
        log.warn(types_1.DATA_MANAGEMENT + " configuration option is deprecated. " + types_1.FETCH_CONFIG + "." + types_1.DATA_CONFIGURATION + " should be used instead");
        data_management_1.validateDataManagementConfig(config.value[types_1.DATA_MANAGEMENT], [types_1.DATA_MANAGEMENT]);
    }
};
var convertDeprecatedRegex = function (filePathRegex) {
    var newPathRegex = filePathRegex;
    newPathRegex = filePathRegex.startsWith('^')
        ? newPathRegex.substring(1)
        : newPathRegex;
    newPathRegex = !filePathRegex.startsWith('.*') && !filePathRegex.startsWith('^')
        ? ".*" + newPathRegex
        : newPathRegex;
    newPathRegex = filePathRegex.endsWith('$')
        ? newPathRegex.substring(0, newPathRegex.length - 1)
        : newPathRegex;
    newPathRegex = !filePathRegex.endsWith('$') && (!filePathRegex.endsWith('.*') || filePathRegex.endsWith('\\.*'))
        ? newPathRegex + ".*"
        : newPathRegex;
    return newPathRegex;
};
var convertDeprecatedMetadataParams = function (currentParams, deprecatedParams) {
    var _a, _b;
    var excludes = __spreadArrays(makeArray(deprecatedParams.instancesRegexSkippedList)
        .filter(function (re) { return re !== exports.PACKAGES_INSTANCES_REGEX; })
        .map(function (re) {
        var regexParts = re.split('.');
        if (regexParts.length < 2) {
            return { name: convertDeprecatedRegex(re) };
        }
        return { metadataType: convertDeprecatedRegex(regexParts[0] + "$"), name: convertDeprecatedRegex("^" + regexParts.slice(1).join('.')) };
    }), makeArray(deprecatedParams.metadataTypesSkippedList).map(function (type) { return ({ metadataType: type }); }));
    var includes = makeArray(deprecatedParams.instancesRegexSkippedList)
        .includes(exports.PACKAGES_INSTANCES_REGEX)
        ? [{ namespace: '', name: '.*', metadataType: '.*' }]
        : [];
    return lodash_1["default"].pickBy({
        include: __spreadArrays(((_a = currentParams.include) !== null && _a !== void 0 ? _a : []), includes),
        exclude: __spreadArrays(((_b = currentParams.exclude) !== null && _b !== void 0 ? _b : []), excludes),
    }, function (value) { return value.length !== 0; });
};
var convertDeprecatedDataConf = function (conf) {
    var _a, _b, _c;
    return (__assign(__assign({}, lodash_1["default"].pickBy(__assign(__assign({}, conf), { excludeObjects: (_a = conf === null || conf === void 0 ? void 0 : conf.excludeObjects) === null || _a === void 0 ? void 0 : _a.map(convertDeprecatedRegex), allowReferenceTo: (_b = conf === null || conf === void 0 ? void 0 : conf.allowReferenceTo) === null || _b === void 0 ? void 0 : _b.map(convertDeprecatedRegex) }), lowerdash_1.values.isDefined)), { includeObjects: conf.includeObjects.map(convertDeprecatedRegex), saltoIDSettings: __assign(__assign({}, lodash_1["default"].pickBy(__assign(__assign({}, conf.saltoIDSettings), { overrides: (_c = conf.saltoIDSettings.overrides) === null || _c === void 0 ? void 0 : _c.map(function (override) { return (__assign(__assign({}, override), { objectsRegex: convertDeprecatedRegex(override.objectsRegex) })); }) }), lowerdash_1.values.isDefined)), { defaultIdFields: conf.saltoIDSettings.defaultIdFields }) }));
};
var convertDeprecatedFetchParameters = function (fetchParameters, deprecatedFetchParameters) {
    var _a;
    var metadata = (deprecatedFetchParameters === null || deprecatedFetchParameters === void 0 ? void 0 : deprecatedFetchParameters.instancesRegexSkippedList) !== undefined
        || (deprecatedFetchParameters === null || deprecatedFetchParameters === void 0 ? void 0 : deprecatedFetchParameters.metadataTypesSkippedList) !== undefined
        ? convertDeprecatedMetadataParams((_a = fetchParameters === null || fetchParameters === void 0 ? void 0 : fetchParameters.metadata) !== null && _a !== void 0 ? _a : {}, deprecatedFetchParameters)
        : fetchParameters === null || fetchParameters === void 0 ? void 0 : fetchParameters.metadata;
    var data = deprecatedFetchParameters.dataManagement !== undefined
        ? convertDeprecatedDataConf(deprecatedFetchParameters.dataManagement)
        : fetchParameters === null || fetchParameters === void 0 ? void 0 : fetchParameters.data;
    var updatedFetchParameters = lodash_1["default"].pickBy(__assign(__assign({}, (fetchParameters !== null && fetchParameters !== void 0 ? fetchParameters : {})), { metadata: metadata,
        data: data }), lowerdash_1.values.isDefined);
    return lodash_1["default"].isEmpty(updatedFetchParameters) ? undefined : updatedFetchParameters;
};
var updateDeprecatedConfiguration = function (configuration) {
    var _a;
    if (configuration === undefined
        || DEPRECATED_FIELDS.every(function (field) { return configuration.value[field] === undefined; })) {
        return undefined;
    }
    validateDeprecatedParameters(configuration);
    var updatedConf = configuration.clone();
    updatedConf.value = __assign(__assign({}, lodash_1["default"].omit(updatedConf.value, DEPRECATED_FIELDS)), (_a = {}, _a[types_1.FETCH_CONFIG] = convertDeprecatedFetchParameters(updatedConf.value[types_1.FETCH_CONFIG], updatedConf.value), _a));
    return { config: updatedConf, message: exports.DEPRECATED_OPTIONS_MESSAGE };
};
exports.updateDeprecatedConfiguration = updateDeprecatedConfiguration;
