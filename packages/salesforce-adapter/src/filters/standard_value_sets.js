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
exports.makeFilter = exports.STANDARD_VALUE = exports.STANDARD_VALUE_SET = void 0;
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
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var fetch_1 = require("../fetch");
var mapValuesAsync = lowerdash_1.promises.object.mapValuesAsync;
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, keyByAsync = _a.keyByAsync;
var makeArray = lowerdash_1.collections.array.makeArray;
var isDefined = lowerdash_1.values.isDefined;
exports.STANDARD_VALUE_SET = 'StandardValueSet';
exports.STANDARD_VALUE = 'standardValue';
/*
 * Standard values sets and references are specified in this API apendix:
 * https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/standardvalueset_names.htm
 */
var STANDARD_VALUE_SETS = new Set([
    'AccountContactMultiRoles',
    'AccountContactRole',
    'AccountOwnership',
    'AccountRating',
    'AccountType',
    'AddressCountryCode',
    'AddressStateCode',
    'AssetStatus',
    'CampaignMemberStatus',
    'CampaignStatus',
    'CampaignType',
    'CaseContactRole',
    'CaseOrigin',
    'CasePriority',
    'CaseReason',
    'CaseStatus',
    'CaseType',
    'ContactRole',
    'ContractContactRole',
    'ContractStatus',
    'EntitlementType',
    'EventSubject',
    'EventType',
    'FiscalYearPeriodName',
    'FiscalYearPeriodPrefix',
    'FiscalYearQuarterName',
    'FiscalYearQuarterPrefix',
    'IdeaCategory',
    'IdeaMultiCategory',
    'IdeaStatus',
    'IdeaThemeStatus',
    'Industry',
    'InvoiceStatus',
    'LeadSource',
    'LeadStatus',
    'OpportunityCompetitor',
    'OpportunityStage',
    'OpportunityType',
    'OrderStatus',
    'OrderType',
    'PartnerRole',
    'Product2Family',
    'QuestionOrigin',
    'QuickTextCategory',
    'QuickTextChannel',
    'QuoteStatus',
    'SalesTeamRole',
    'Salutation',
    'ServiceContractApprovalStatus',
    'SocialPostClassification',
    'SocialPostEngagementLevel',
    'SocialPostReviewedStatus',
    'SolutionStatus',
    'TaskPriority',
    'TaskStatus',
    'TaskSubject',
    'TaskType',
    'WorkOrderLineItemStatus',
    'WorkOrderPriority',
    'WorkOrderStatus',
]);
var encodeValues = function (values) {
    return values.sort().join(';');
};
var svsValuesToRef = function (svsInstances) { return lodash_1["default"].fromPairs(svsInstances
    .filter(function (i) { return i.value[exports.STANDARD_VALUE]; })
    .map(function (i) {
    var standardValue = makeArray(i.value[exports.STANDARD_VALUE]);
    return [
        encodeValues(utils_1.extractFullNamesFromValueList(standardValue)),
        new adapter_api_1.ReferenceExpression(i.elemID),
    ];
})); };
var isStandardPickList = function (f) { return __awaiter(void 0, void 0, void 0, function () {
    var apiNameResult;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, transformer_1.apiName(f)];
            case 1:
                apiNameResult = _a.sent();
                return [2 /*return*/, apiNameResult
                        ? (f.refType.elemID.isEqual(transformer_1.Types.primitiveDataTypes.Picklist.elemID)
                            || f.refType.elemID.isEqual(transformer_1.Types.primitiveDataTypes.MultiselectPicklist.elemID))
                            && !transformer_1.isCustom(apiNameResult)
                        : false];
        }
    });
}); };
var calculatePicklistFieldsToUpdate = function (custObjectFields, svsValuesToName) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, mapValuesAsync(custObjectFields, function (field) { return __awaiter(void 0, void 0, void 0, function () {
                var encodedPlVals, foundStandardValueSet, newField;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, isStandardPickList(field)];
                        case 1:
                            if (!(_a.sent())
                                || lodash_1["default"].isEmpty(field.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET])) {
                                return [2 /*return*/, field];
                            }
                            encodedPlVals = encodeValues(utils_1.extractFullNamesFromValueList(field.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET]));
                            foundStandardValueSet = svsValuesToName[encodedPlVals];
                            if (!foundStandardValueSet) {
                                return [2 /*return*/, field];
                            }
                            newField = field.clone();
                            delete newField.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET];
                            newField.annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME] = foundStandardValueSet;
                            return [2 /*return*/, newField];
                    }
                });
            }); })];
    });
}); };
var findStandardValueSetType = function (elements) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, awu(elements).find(function (element) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, transformer_1.metadataType(element)];
                    case 1: return [2 /*return*/, (_a.sent()) === exports.STANDARD_VALUE_SET];
                }
            }); }); })];
    });
}); };
var updateSVSReferences = function (objects, svsInstances) { return __awaiter(void 0, void 0, void 0, function () {
    var svsValuesToName;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                svsValuesToName = svsValuesToRef(svsInstances);
                return [4 /*yield*/, awu(objects).forEach(function (customObjType) { return __awaiter(void 0, void 0, void 0, function () {
                        var fieldsToUpdate;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, calculatePicklistFieldsToUpdate(customObjType.fields, svsValuesToName)];
                                case 1:
                                    fieldsToUpdate = _a.sent();
                                    lodash_1["default"].assign(customObjType, { fields: fieldsToUpdate });
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var emptyFileProperties = function (fullName) { return ({
    fullName: fullName,
    createdById: '',
    createdByName: '',
    createdDate: '',
    fileName: '',
    id: '',
    lastModifiedById: '',
    lastModifiedByName: '',
    lastModifiedDate: '',
    type: exports.STANDARD_VALUE_SET,
}); };
var toDeployableStandardPicklistFieldChange = function (change) {
    var _a = adapter_api_1.getAllChangeData(change).map(function (field) { return field.clone(); }), deployableBefore = _a[0], deployableAfter = _a[1];
    delete deployableBefore.annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME];
    delete deployableAfter.annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME];
    return {
        data: {
            before: deployableBefore,
            after: deployableAfter,
        },
        action: 'modify',
    };
};
/**
* Declare the StandardValueSets filter that
* adds the fixed collection of standard value sets in SFDC
* and modify reference in fetched elements that uses them.
*/
var makeFilter = function (standardValueSetNames) { return function (_a) {
    var client = _a.client, config = _a.config;
    var originalChanges;
    return {
        /**
         * Upon fetch, retrieve standard value sets and
         * modify references to them in fetched elements
         *
         * @param elements the already fetched elements
         */
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var svsMetadataType, configChanges, fetchedSVSInstances, svsInstances, customObjectTypeElements, svsInstances, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, findStandardValueSetType(elements)];
                    case 1:
                        svsMetadataType = _c.sent();
                        configChanges = [];
                        if (!(svsMetadataType !== undefined)) return [3 /*break*/, 3];
                        return [4 /*yield*/, fetch_1.fetchMetadataInstances({
                                client: client,
                                fileProps: __spreadArrays(standardValueSetNames).map(emptyFileProperties),
                                metadataType: svsMetadataType,
                                metadataQuery: config.fetchProfile.metadataQuery,
                                maxInstancesPerType: config.fetchProfile.maxInstancesPerType,
                            })];
                    case 2:
                        svsInstances = _c.sent();
                        elements.push.apply(elements, svsInstances.elements);
                        configChanges = svsInstances.configChanges;
                        fetchedSVSInstances = svsInstances.elements;
                        _c.label = 3;
                    case 3: return [4 /*yield*/, awu(elements)
                            .filter(adapter_api_1.isObjectType)
                            .filter(transformer_1.isCustomObject)
                            .toArray()];
                    case 4:
                        customObjectTypeElements = _c.sent();
                        if (!(customObjectTypeElements.length > 0)) return [3 /*break*/, 10];
                        if (!(fetchedSVSInstances !== undefined)) return [3 /*break*/, 5];
                        _a = fetchedSVSInstances;
                        return [3 /*break*/, 8];
                    case 5:
                        _b = awu;
                        return [4 /*yield*/, config.elementsSource.getAll()];
                    case 6: return [4 /*yield*/, _b.apply(void 0, [_c.sent()])
                            .filter(adapter_api_1.isInstanceElement)
                            .map(function (inst) { return __awaiter(void 0, void 0, void 0, function () {
                            var clone;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        clone = inst.clone();
                                        return [4 /*yield*/, adapter_utils_1.resolveTypeShallow(clone, config.elementsSource)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/, clone];
                                }
                            });
                        }); })
                            .filter(utils_1.isInstanceOfType(exports.STANDARD_VALUE_SET))
                            .toArray()];
                    case 7:
                        _a = _c.sent();
                        _c.label = 8;
                    case 8:
                        svsInstances = _a;
                        return [4 /*yield*/, updateSVSReferences(customObjectTypeElements, svsInstances)];
                    case 9:
                        _c.sent();
                        _c.label = 10;
                    case 10: return [2 /*return*/, {
                            configSuggestions: configChanges,
                        }];
                }
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var standardPicklistFieldChanges, deployableChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(adapter_api_1.isModificationChange)
                            .filter(adapter_api_1.isFieldChange)
                            .filter(function (change) { return isStandardPickList(adapter_api_1.getChangeData(change)); })
                            .toArray()];
                    case 1:
                        standardPicklistFieldChanges = _a.sent();
                        return [4 /*yield*/, keyByAsync(standardPicklistFieldChanges, function (change) { return transformer_1.apiName(adapter_api_1.getChangeData(change)); })];
                    case 2:
                        originalChanges = _a.sent();
                        deployableChanges = standardPicklistFieldChanges
                            .map(toDeployableStandardPicklistFieldChange);
                        lodash_1["default"].pullAll(changes, standardPicklistFieldChanges);
                        changes.push.apply(changes, deployableChanges);
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var appliedStandardPicklistFieldChanges, appliedApiNames, appliedOriginalChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(adapter_api_1.isModificationChange)
                            .filter(adapter_api_1.isFieldChange)
                            .filter(function (change) { return isStandardPickList(adapter_api_1.getChangeData(change)); })
                            .toArray()];
                    case 1:
                        appliedStandardPicklistFieldChanges = _a.sent();
                        return [4 /*yield*/, awu(changes)
                                .map(function (change) { return transformer_1.apiName(adapter_api_1.getChangeData(change)); })
                                .toArray()];
                    case 2:
                        appliedApiNames = _a.sent();
                        appliedOriginalChanges = appliedApiNames
                            .map(function (name) { return originalChanges[name]; })
                            .filter(isDefined);
                        lodash_1["default"].pullAll(changes, appliedStandardPicklistFieldChanges);
                        appliedOriginalChanges.forEach(function (change) { return changes.push(change); });
                        return [2 /*return*/];
                }
            });
        }); },
    };
}; };
exports.makeFilter = makeFilter;
exports["default"] = exports.makeFilter(STANDARD_VALUE_SETS);
