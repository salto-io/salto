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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var _a;
exports.__esModule = true;
exports.getConfigFromConfigChanges = exports.createRetrieveConfigChange = exports.createListMetadataObjectsConfigChange = exports.createSkippedListConfigChangeFromError = exports.HANDLED_ERROR_PREDICATES = exports.createNonTransientSalesforceErrorConfigSuggestion = exports.createInvalidCrossReferenceKeyConfigSuggestion = exports.createSocketTimeoutConfigSuggestion = exports.NON_TRANSIENT_SALESFORCE_ERRORS = exports.createSkippedListConfigChange = exports.createUnresolvedRefIdFieldConfigChange = exports.createInvlidIdFieldConfigChange = exports.createManyInstancesExcludeConfigChange = exports.getConfigChangeMessage = void 0;
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
var lodash_1 = require("lodash");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var types_1 = require("./types");
var constants = require("./constants");
var constants_1 = require("./constants");
var isDefined = lowerdash_1.values.isDefined;
var makeArray = lowerdash_1.collections.array.makeArray;
var MESSAGE_INTRO = 'Salto failed to fetch some items from salesforce. ';
var MESSAGE_REASONS_INTRO = 'Due to the following issues: ';
var MESSAGE_SUMMARY = 'In order to complete the fetch operation, '
    + 'Salto needs to stop managing these items by applying the following configuration change:';
var formatReason = function (reason) {
    return "    * " + reason;
};
var getConfigChangeMessage = function (configChanges) {
    var reasons = configChanges.map(function (configChange) { return configChange.reason; }).filter(isDefined);
    if (lodash_1["default"].isEmpty(reasons)) {
        return [MESSAGE_INTRO, '', MESSAGE_SUMMARY].join('\n');
    }
    return __spreadArrays([MESSAGE_INTRO, '', MESSAGE_REASONS_INTRO], reasons.map(formatReason), ['', MESSAGE_SUMMARY]).join('\n');
};
exports.getConfigChangeMessage = getConfigChangeMessage;
var createManyInstancesExcludeConfigChange = function (_a) {
    var typeName = _a.typeName, instancesCount = _a.instancesCount, maxInstancesPerType = _a.maxInstancesPerType;
    // Return a config suggestion to exclude that type from the dataObjects
    var reason = "'" + typeName + "' has " + instancesCount + " instances so it was skipped and would be excluded from future fetch operations, as " + types_1.MAX_INSTANCES_PER_TYPE + " is set to " + maxInstancesPerType + ".\n      If you wish to fetch it anyway, remove it from your app configuration exclude block and increase maxInstancePerType to the desired value (" + constants_1.UNLIMITED_INSTANCES_VALUE + " for unlimited).";
    return {
        type: 'dataObjectsExclude',
        value: typeName,
        reason: reason,
    };
};
exports.createManyInstancesExcludeConfigChange = createManyInstancesExcludeConfigChange;
var createInvlidIdFieldConfigChange = function (typeName, invalidFields) {
    return ({
        type: 'dataObjectsExclude',
        value: typeName,
        reason: invalidFields + " defined as idFields but are not queryable or do not exist on type " + typeName,
    });
};
exports.createInvlidIdFieldConfigChange = createInvlidIdFieldConfigChange;
var createUnresolvedRefIdFieldConfigChange = function (typeName, unresolvedRefIdFields) {
    return ({
        type: 'dataObjectsExclude',
        value: typeName,
        reason: typeName + " has " + unresolvedRefIdFields + " (reference) configured as idField. Failed to resolve some of the references.",
    });
};
exports.createUnresolvedRefIdFieldConfigChange = createUnresolvedRefIdFieldConfigChange;
var createSkippedListConfigChange = function (_a) {
    var type = _a.type, instance = _a.instance, reason = _a.reason;
    if (lodash_1["default"].isUndefined(instance)) {
        return {
            type: 'metadataExclude',
            value: { metadataType: type },
            reason: reason,
        };
    }
    return {
        type: 'metadataExclude',
        value: { metadataType: type, name: instance },
        reason: reason,
    };
};
exports.createSkippedListConfigChange = createSkippedListConfigChange;
var isSocketTimeoutError = function (e) { return (e.message === constants_1.SOCKET_TIMEOUT); };
var isInvalidCrossReferenceKeyError = function (e) {
    var errorCode = lodash_1["default"].get(e, 'errorCode');
    return lodash_1["default"].isString(errorCode) && errorCode === constants_1.INVALID_CROSS_REFERENCE_KEY;
};
exports.NON_TRANSIENT_SALESFORCE_ERRORS = [
    constants_1.DUPLICATE_VALUE,
    constants_1.INVALID_ID_FIELD,
    constants_1.INVALID_FIELD,
    constants_1.INVALID_TYPE,
    constants_1.UNKNOWN_EXCEPTION,
];
var isNonTransientSalesforceError = function (e) { return (exports.NON_TRANSIENT_SALESFORCE_ERRORS.includes(e.name)); };
var createSocketTimeoutConfigSuggestion = function (input) { return ({
    type: 'metadataExclude',
    value: input,
    reason: input.metadataType + " with name " + input.name + " exceeded fetch timeout",
}); };
exports.createSocketTimeoutConfigSuggestion = createSocketTimeoutConfigSuggestion;
var createInvalidCrossReferenceKeyConfigSuggestion = function (input) { return ({
    type: 'metadataExclude',
    value: input,
    reason: input.metadataType + " with name " + input.name + " failed due to INVALID_CROSS_REFERENCE_KEY",
}); };
exports.createInvalidCrossReferenceKeyConfigSuggestion = createInvalidCrossReferenceKeyConfigSuggestion;
var createNonTransientSalesforceErrorConfigSuggestion = function (input) { return ({
    type: 'metadataExclude',
    value: input,
    reason: input.metadataType + " with name " + input.name + " failed with non transient error",
}); };
exports.createNonTransientSalesforceErrorConfigSuggestion = createNonTransientSalesforceErrorConfigSuggestion;
var NON_TRANSIENT_SALESFORCE_ERROR = 'NON_TRANSIENT_SALESFORCE_ERROR';
var CONFIG_SUGGESTION_CREATOR_NAMES = [
    constants_1.SOCKET_TIMEOUT,
    constants_1.INVALID_CROSS_REFERENCE_KEY,
    NON_TRANSIENT_SALESFORCE_ERROR,
];
var CONFIG_SUGGESTION_CREATORS = (_a = {},
    _a[constants_1.SOCKET_TIMEOUT] = {
        predicate: isSocketTimeoutError,
        create: exports.createSocketTimeoutConfigSuggestion,
    },
    _a[constants_1.INVALID_CROSS_REFERENCE_KEY] = {
        predicate: isInvalidCrossReferenceKeyError,
        create: exports.createInvalidCrossReferenceKeyConfigSuggestion,
    },
    _a[NON_TRANSIENT_SALESFORCE_ERROR] = {
        predicate: isNonTransientSalesforceError,
        create: exports.createNonTransientSalesforceErrorConfigSuggestion,
    },
    _a);
exports.HANDLED_ERROR_PREDICATES = Object.values(CONFIG_SUGGESTION_CREATORS)
    .map(function (creator) { return creator.predicate; });
var createSkippedListConfigChangeFromError = function (_a) {
    var _b, _c;
    var creatorInput = _a.creatorInput, error = _a.error;
    return ((_c = (_b = Object.values(CONFIG_SUGGESTION_CREATORS)
        .find(function (creator) { return creator.predicate(error); })) === null || _b === void 0 ? void 0 : _b.create(creatorInput)) !== null && _c !== void 0 ? _c : exports.createSkippedListConfigChange({ type: creatorInput.metadataType, instance: creatorInput.name }));
};
exports.createSkippedListConfigChangeFromError = createSkippedListConfigChangeFromError;
var createListMetadataObjectsConfigChange = function (res) { return exports.createSkippedListConfigChange({ type: res.type, instance: res.folder }); };
exports.createListMetadataObjectsConfigChange = createListMetadataObjectsConfigChange;
var createRetrieveConfigChange = function (result) {
    return makeArray(result.messages)
        .map(function (msg) { var _a; return constants.RETRIEVE_LOAD_OF_METADATA_ERROR_REGEX.exec((_a = msg.problem) !== null && _a !== void 0 ? _a : ''); })
        .filter(function (regexRes) { return !lodash_1["default"].isUndefined(regexRes === null || regexRes === void 0 ? void 0 : regexRes.groups); })
        .map(function (regexRes) {
        var _a, _b;
        return exports.createSkippedListConfigChange({
            type: (_a = regexRes === null || regexRes === void 0 ? void 0 : regexRes.groups) === null || _a === void 0 ? void 0 : _a.type,
            instance: (_b = regexRes === null || regexRes === void 0 ? void 0 : regexRes.groups) === null || _b === void 0 ? void 0 : _b.instance,
        });
    });
};
exports.createRetrieveConfigChange = createRetrieveConfigChange;
var getConfigFromConfigChanges = function (configChanges, currentConfig) {
    var _a, _b, _c, _d, _e;
    var currentMetadataExclude = makeArray((_b = (_a = currentConfig.fetch) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.exclude);
    var newMetadataExclude = makeArray(configChanges)
        .filter(types_1.isMetadataConfigSuggestions)
        .map(function (e) { return e.value; })
        .filter(function (e) { return !currentMetadataExclude.includes(e); });
    var dataObjectsToExclude = makeArray(configChanges)
        .filter(types_1.isDataManagementConfigSuggestions)
        .map(function (config) { return config.value; });
    var retrieveSize = configChanges
        .filter(types_1.isRetrieveSizeConfigSuggstion)
        .map(function (config) { return config.value; })
        .map(function (value) { return Math.max(value, constants.MINIMUM_MAX_ITEMS_IN_RETRIEVE_REQUEST); })
        .sort(function (a, b) { return a - b; })[0];
    if ([newMetadataExclude, dataObjectsToExclude].every(lodash_1["default"].isEmpty) && retrieveSize === undefined) {
        return undefined;
    }
    var currentDataManagement = (_c = currentConfig.fetch) === null || _c === void 0 ? void 0 : _c.data;
    var dataManagementOverrides = {
        excludeObjects: makeArray(currentDataManagement === null || currentDataManagement === void 0 ? void 0 : currentDataManagement.excludeObjects)
            .concat(dataObjectsToExclude),
    };
    if (Array.isArray(currentDataManagement === null || currentDataManagement === void 0 ? void 0 : currentDataManagement.allowReferenceTo)) {
        Object.assign(dataManagementOverrides, {
            allowReferenceTo: currentDataManagement === null || currentDataManagement === void 0 ? void 0 : currentDataManagement.allowReferenceTo.filter(function (objectName) { return !dataObjectsToExclude.includes(objectName); }),
        });
    }
    var data = currentDataManagement === undefined ? undefined : lodash_1["default"].pickBy(__assign(__assign({}, currentDataManagement), dataManagementOverrides), isDefined);
    var maxItemsInRetrieveRequest = retrieveSize !== null && retrieveSize !== void 0 ? retrieveSize : currentConfig.maxItemsInRetrieveRequest;
    return {
        config: [new adapter_api_1.InstanceElement(adapter_api_1.ElemID.CONFIG_NAME, types_1.configType, lodash_1["default"].pickBy({
                fetch: lodash_1["default"].pickBy(__assign(__assign({}, ((_d = currentConfig.fetch) !== null && _d !== void 0 ? _d : {})), { metadata: __assign(__assign({}, (_e = currentConfig.fetch) === null || _e === void 0 ? void 0 : _e.metadata), { exclude: __spreadArrays(currentMetadataExclude, newMetadataExclude) }), data: data === undefined ? undefined : __assign(__assign({}, data), { saltoIDSettings: lodash_1["default"].pickBy(data.saltoIDSettings, isDefined) }) }), isDefined),
                maxItemsInRetrieveRequest: maxItemsInRetrieveRequest,
                client: currentConfig.client,
            }, isDefined))],
        message: exports.getConfigChangeMessage(configChanges),
    };
};
exports.getConfigFromConfigChanges = getConfigFromConfigChanges;
