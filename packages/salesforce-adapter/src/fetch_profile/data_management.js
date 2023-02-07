"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.validateDataManagementConfig = exports.buildDataManagement = void 0;
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
var config_validation_1 = require("../config_validation");
var makeArray = lowerdash_1.collections.array.makeArray;
var defaultIgnoreReferenceTo = ['User'];
var buildDataManagement = function (params) { return ({
    isObjectMatch: function (name) {
        var _a;
        return params.includeObjects.some(function (re) { return new RegExp("^" + re + "$").test(name); })
            && !((_a = params.excludeObjects) === null || _a === void 0 ? void 0 : _a.some(function (re) { return new RegExp("^" + re + "$").test(name); }));
    },
    isReferenceAllowed: function (name) { var _a, _b; return (_b = (_a = params.allowReferenceTo) === null || _a === void 0 ? void 0 : _a.some(function (re) { return new RegExp("^" + re + "$").test(name); })) !== null && _b !== void 0 ? _b : false; },
    shouldIgnoreReference: function (name) { var _a; return ((_a = params.ignoreReferenceTo) !== null && _a !== void 0 ? _a : defaultIgnoreReferenceTo).includes(name); },
    getObjectIdsFields: function (name) {
        var _a, _b;
        var matchedOverride = (_a = params.saltoIDSettings.overrides) === null || _a === void 0 ? void 0 : _a.find(function (override) { return new RegExp("^" + override.objectsRegex + "$").test(name); });
        return (_b = matchedOverride === null || matchedOverride === void 0 ? void 0 : matchedOverride.idFields) !== null && _b !== void 0 ? _b : params.saltoIDSettings.defaultIdFields;
    },
    showReadOnlyValues: params.showReadOnlyValues,
}); };
exports.buildDataManagement = buildDataManagement;
var validateDataManagementConfig = function (dataManagementConfig, fieldPath) {
    if (dataManagementConfig.includeObjects === undefined) {
        throw new config_validation_1.ConfigValidationError(__spreadArrays(fieldPath, ['includeObjects']), 'includeObjects is required when dataManagement is configured');
    }
    if (dataManagementConfig.saltoIDSettings === undefined) {
        throw new config_validation_1.ConfigValidationError(__spreadArrays(fieldPath, ['saltoIDSettings']), 'saltoIDSettings is required when dataManagement is configured');
    }
    if (dataManagementConfig.saltoIDSettings.defaultIdFields === undefined) {
        throw new config_validation_1.ConfigValidationError(__spreadArrays(fieldPath, ['saltoIDSettings', 'defaultIdFields']), 'saltoIDSettings.defaultIdFields is required when dataManagement is configured');
    }
    config_validation_1.validateRegularExpressions(makeArray(dataManagementConfig.includeObjects), __spreadArrays(fieldPath, ['includeObjects']));
    config_validation_1.validateRegularExpressions(makeArray(dataManagementConfig.excludeObjects), __spreadArrays(fieldPath, ['excludeObjects']));
    config_validation_1.validateRegularExpressions(makeArray(dataManagementConfig.allowReferenceTo), __spreadArrays(fieldPath, ['allowReferenceTo']));
    if (dataManagementConfig.saltoIDSettings.overrides !== undefined) {
        var overridesObjectRegexs = dataManagementConfig.saltoIDSettings.overrides
            .map(function (override) { return override.objectsRegex; });
        config_validation_1.validateRegularExpressions(overridesObjectRegexs, __spreadArrays(fieldPath, ['saltoIDSettings', 'overrides']));
    }
};
exports.validateDataManagementConfig = validateDataManagementConfig;
