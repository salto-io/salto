"use strict";
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
var lodash_1 = require("lodash");
var lowerdash_1 = require("@salto-io/lowerdash");
var config_validation_1 = require("../config_validation");
var types_1 = require("../types");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var makeArray = lowerdash_1.collections.array.makeArray;
var DEFAULT_ALIAS_FIELDS = [constants_1.DETECTS_PARENTS_INDICATOR, 'Name'];
var ALIAS_FIELDS_BY_TYPE = {
    SBQQ__ProductFeature__c: [
        constants_1.DETECTS_PARENTS_INDICATOR,
        'SBQQ__ConfiguredSKU__c',
        'Name',
    ],
    SBQQ__LineColumn__c: [
        constants_1.DETECTS_PARENTS_INDICATOR,
        'SBQQ__FieldName__c',
        'Name',
    ],
    SBQQ__LookupQuery__c: [
        constants_1.DETECTS_PARENTS_INDICATOR,
        'SBQQ__PriceRule2__c',
        'Name',
    ],
    SBQQ__Dimension__c: [
        constants_1.DETECTS_PARENTS_INDICATOR,
        'SBQQ__Product__c',
        'Name',
    ],
    PricebookEntry: [
        'Pricebook2Id',
        'Name',
    ],
    Product2: [
        'ProductCode',
        'Family',
        'Name',
    ],
    sbaa__ApprovalCondition__c: [
        'sbaa__ApprovalRule__c',
        'sbaa__Index__c',
    ],
};
var DEFAULT_BROKEN_REFS_BEHAVIOR = 'ExcludeInstance';
var DEFAULT_PER_TYPE_BROKEN_REFS_BEHAVIOR = {
    User: 'InternalId',
};
var buildDataManagement = function (params) {
    var isReferenceAllowed = function (name) {
        var _a, _b;
        return ((_b = (_a = params.allowReferenceTo) === null || _a === void 0 ? void 0 : _a.some(function (re) { return new RegExp("^" + re + "$").test(name); })) !== null && _b !== void 0 ? _b : false);
    };
    var omittedFieldsByType = lodash_1["default"].groupBy(params.omittedFields, function (fieldApiName) { return fieldApiName.split('.')[0]; });
    return {
        shouldFetchObjectType: function (objectType) { return __awaiter(void 0, void 0, void 0, function () {
            var managedBySaltoFieldName, typeName, hasManagedBySaltoField, refsAllowed, excluded, included;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        managedBySaltoFieldName = (_a = params.saltoManagementFieldSettings) === null || _a === void 0 ? void 0 : _a.defaultFieldName;
                        return [4 /*yield*/, transformer_1.apiName(objectType)];
                    case 1:
                        typeName = _f.sent();
                        hasManagedBySaltoField = managedBySaltoFieldName !== undefined
                            && objectType.fields[managedBySaltoFieldName] !== undefined;
                        refsAllowed = isReferenceAllowed(typeName);
                        excluded = (_c = (_b = params.excludeObjects) === null || _b === void 0 ? void 0 : _b.some(function (re) { return new RegExp("^" + re + "$").test(typeName); })) !== null && _c !== void 0 ? _c : false;
                        included = (_e = (_d = params.includeObjects) === null || _d === void 0 ? void 0 : _d.some(function (re) { return new RegExp("^" + re + "$").test(typeName); })) !== null && _e !== void 0 ? _e : false;
                        if (refsAllowed) {
                            // we have to check all the 'refsAllowed' cases here because `refsAllowed` should take precedence over
                            // `excluded`
                            if (hasManagedBySaltoField || included) {
                                return [2 /*return*/, 'Always'];
                            }
                            return [2 /*return*/, 'IfReferenced'];
                        }
                        if (excluded) {
                            return [2 /*return*/, 'Never'];
                        }
                        if (included) {
                            return [2 /*return*/, 'Always'];
                        }
                        return [2 /*return*/, 'Never'];
                }
            });
        }); },
        brokenReferenceBehaviorForTargetType: function (typeName) {
            var _a, _b, _c, _d;
            if (typeName === undefined) {
                return DEFAULT_BROKEN_REFS_BEHAVIOR;
            }
            var typeOverrides = (_b = (_a = params.brokenOutgoingReferencesSettings) === null || _a === void 0 ? void 0 : _a.perTargetTypeOverrides) !== null && _b !== void 0 ? _b : DEFAULT_PER_TYPE_BROKEN_REFS_BEHAVIOR;
            var perTypeBehavior = typeOverrides[typeName];
            if (perTypeBehavior !== undefined) {
                return perTypeBehavior;
            }
            return (_d = (_c = params.brokenOutgoingReferencesSettings) === null || _c === void 0 ? void 0 : _c.defaultBehavior) !== null && _d !== void 0 ? _d : DEFAULT_BROKEN_REFS_BEHAVIOR;
        },
        managedBySaltoFieldForType: function (objType) {
            var _a;
            if (((_a = params.saltoManagementFieldSettings) === null || _a === void 0 ? void 0 : _a.defaultFieldName) === undefined) {
                return undefined;
            }
            if (objType.fields[params.saltoManagementFieldSettings.defaultFieldName] === undefined) {
                return undefined;
            }
            return params.saltoManagementFieldSettings.defaultFieldName;
        },
        isReferenceAllowed: isReferenceAllowed,
        getObjectIdsFields: function (name) {
            var _a, _b;
            var matchedOverride = (_a = params.saltoIDSettings.overrides) === null || _a === void 0 ? void 0 : _a.find(function (override) { return new RegExp("^" + override.objectsRegex + "$").test(name); });
            return (_b = matchedOverride === null || matchedOverride === void 0 ? void 0 : matchedOverride.idFields) !== null && _b !== void 0 ? _b : params.saltoIDSettings.defaultIdFields;
        },
        getObjectAliasFields: function (name) {
            var _a, _b, _c, _d, _e;
            var defaultFields = (_b = (_a = params.saltoAliasSettings) === null || _a === void 0 ? void 0 : _a.defaultAliasFields) !== null && _b !== void 0 ? _b : DEFAULT_ALIAS_FIELDS;
            var matchedOverride = (_d = (_c = params.saltoAliasSettings) === null || _c === void 0 ? void 0 : _c.overrides) === null || _d === void 0 ? void 0 : _d.find(function (override) { return new RegExp("^" + override.objectsRegex + "$").test(name); });
            return matchedOverride !== undefined && lowerdash_1.types.isNonEmptyArray(matchedOverride.aliasFields)
                ? matchedOverride.aliasFields
                : (_e = ALIAS_FIELDS_BY_TYPE[name]) !== null && _e !== void 0 ? _e : defaultFields;
        },
        showReadOnlyValues: params.showReadOnlyValues,
        omittedFieldsForType: function (name) { return (name === undefined ? [] : makeArray(omittedFieldsByType[name])); },
    };
};
exports.buildDataManagement = buildDataManagement;
var validateDataManagementConfig = function (dataManagementConfig, fieldPath) {
    var _a, _b;
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
    var saltoAliasOverrides = (_a = dataManagementConfig.saltoAliasSettings) === null || _a === void 0 ? void 0 : _a.overrides;
    if (saltoAliasOverrides !== undefined) {
        config_validation_1.validateRegularExpressions(saltoAliasOverrides.map(function (override) { return override.objectsRegex; }), __spreadArrays(fieldPath, ['saltoAliasSettings', 'overrides']));
    }
    if (((_b = dataManagementConfig.brokenOutgoingReferencesSettings) === null || _b === void 0 ? void 0 : _b.perTargetTypeOverrides) !== undefined) {
        Object.entries(dataManagementConfig.brokenOutgoingReferencesSettings.perTargetTypeOverrides).forEach(function (_a) {
            var type = _a[0], outgoingRefBehavior = _a[1];
            if (!types_1.outgoingReferenceBehaviors.includes(outgoingRefBehavior)) {
                throw new config_validation_1.ConfigValidationError(__spreadArrays(fieldPath, ['brokenOutgoingReferencesSettings', 'perTargetTypeOverrides', type]), "Per-target broken reference behavior must be one of " + types_1.outgoingReferenceBehaviors.join(','));
            }
        });
    }
    var invalidOmittedFieldNames = makeArray(dataManagementConfig.omittedFields)
        .filter(function (omittedFieldName) { return omittedFieldName.split('.').length < 2; });
    if (invalidOmittedFieldNames.length > 0) {
        throw new config_validation_1.ConfigValidationError(__spreadArrays(fieldPath, ['omittedFields']), "The following omitted fields API names are invalid: " + invalidOmittedFieldNames.join(','));
    }
};
exports.validateDataManagementConfig = validateDataManagementConfig;
