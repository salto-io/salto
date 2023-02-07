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
exports.addReferences = void 0;
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
var adapter_components_1 = require("@salto-io/adapter-components");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../transformers/transformer");
var reference_mapping_1 = require("../transformers/reference_mapping");
var constants_1 = require("../constants");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
var flatMapAsync = lowerdash_1.collections.asynciterable.flatMapAsync;
var neighborContextGetter = adapter_components_1.references.neighborContextGetter, replaceReferenceValues = adapter_components_1.references.replaceReferenceValues;
var workflowActionMapper = function (val) {
    var typeMapping = {
        Alert: constants_1.WORKFLOW_ACTION_ALERT_METADATA_TYPE,
        FieldUpdate: constants_1.WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
        FlowAction: constants_1.WORKFLOW_FLOW_ACTION_METADATA_TYPE,
        OutboundMessage: constants_1.WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE,
        Task: constants_1.WORKFLOW_TASK_METADATA_TYPE,
    };
    return typeMapping[val];
};
var flowActionCallMapper = function (val) {
    var typeMapping = {
        apex: 'ApexClass',
        emailAlert: constants_1.WORKFLOW_ACTION_ALERT_METADATA_TYPE,
        quickAction: constants_1.QUICK_ACTION_METADATA_TYPE,
        flow: constants_1.FLOW_METADATA_TYPE,
    };
    return typeMapping[val];
};
var shareToMapper = function (val) {
    var typeMapping = {
        Role: constants_1.ROLE_METADATA_TYPE,
        Group: constants_1.GROUP_METADATA_TYPE,
        RoleAndSubordinates: constants_1.ROLE_METADATA_TYPE,
    };
    return typeMapping[val];
};
var neighborContextFunc = function (args) { return neighborContextGetter(__assign(__assign({}, args), { getLookUpName: reference_mapping_1.getLookUpName })); };
var contextStrategyLookup = {
    instanceParent: function (_a) {
        var instance = _a.instance, elemByElemID = _a.elemByElemID;
        return __awaiter(void 0, void 0, void 0, function () {
            var parentRef, parent;
            return __generator(this, function (_b) {
                parentRef = adapter_utils_1.getParents(instance)[0];
                parent = adapter_api_1.isReferenceExpression(parentRef)
                    ? elemByElemID.get(parentRef.elemID.getFullName())
                    : undefined;
                return [2 /*return*/, parent !== undefined ? transformer_1.apiName(parent) : undefined];
            });
        });
    },
    neighborTypeLookup: neighborContextFunc({ contextFieldName: 'type' }),
    neighborTypeWorkflow: neighborContextFunc({ contextFieldName: 'type', contextValueMapper: workflowActionMapper }),
    neighborActionTypeFlowLookup: neighborContextFunc({ contextFieldName: 'actionType', contextValueMapper: flowActionCallMapper }),
    neighborActionTypeLookup: neighborContextFunc({ contextFieldName: 'actionType' }),
    neighborCPQLookup: neighborContextFunc({ contextFieldName: constants_1.CPQ_LOOKUP_OBJECT_NAME }),
    neighborCPQRuleLookup: neighborContextFunc({ contextFieldName: constants_1.CPQ_RULE_LOOKUP_OBJECT_FIELD }),
    neighborLookupValueTypeLookup: neighborContextFunc({ contextFieldName: 'lookupValueType' }),
    neighborObjectLookup: neighborContextFunc({ contextFieldName: 'object' }),
    parentObjectLookup: neighborContextFunc({ contextFieldName: 'object', levelsUp: 1 }),
    parentInputObjectLookup: neighborContextFunc({ contextFieldName: 'inputObject', levelsUp: 1 }),
    parentOutputObjectLookup: neighborContextFunc({ contextFieldName: 'outputObject', levelsUp: 1 }),
    neighborPicklistObjectLookup: neighborContextFunc({ contextFieldName: 'picklistObject' }),
    neighborSharedToTypeLookup: neighborContextFunc({ contextFieldName: 'sharedToType', contextValueMapper: shareToMapper }),
    neighborTableLookup: neighborContextFunc({ contextFieldName: 'table' }),
    neighborCaseOwnerTypeLookup: neighborContextFunc({ contextFieldName: 'caseOwnerType' }),
    neighborAssignedToTypeLookup: neighborContextFunc({ contextFieldName: 'assignedToType' }),
    neighborRelatedEntityTypeLookup: neighborContextFunc({ contextFieldName: 'relatedEntityType' }),
};
var addReferences = function (elements, referenceElements, defs) { return __awaiter(void 0, void 0, void 0, function () {
    var resolverFinder, elementsWithFields, _a, _b, elemLookup, elemByElemID, fieldsWithResolvedReferences;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                resolverFinder = reference_mapping_1.generateReferenceResolverFinder(defs);
                _a = flatMapAsync;
                return [4 /*yield*/, referenceElements.getAll()];
            case 1:
                elementsWithFields = _a.apply(void 0, [_c.sent(), utils_1.extractFlatCustomObjectFields]);
                return [4 /*yield*/, lowerdash_1.multiIndex.buildMultiIndex()
                        .addIndex({
                        name: 'elemLookup',
                        filter: utils_1.hasApiName,
                        key: function (elem) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, transformer_1.metadataType(elem)];
                                case 1:
                                    _a = [_b.sent()];
                                    return [4 /*yield*/, transformer_1.apiName(elem)];
                                case 2: return [2 /*return*/, _a.concat([_b.sent()])];
                            }
                        }); }); },
                    })
                        .addIndex({
                        name: 'elemByElemID',
                        filter: function (elem) { return !adapter_api_1.isField(elem); },
                        key: function (elem) { return [elem.elemID.getFullName()]; },
                    })
                        .process(elementsWithFields)];
            case 2:
                _b = _c.sent(), elemLookup = _b.elemLookup, elemByElemID = _b.elemByElemID;
                fieldsWithResolvedReferences = new Set();
                return [4 /*yield*/, awu(elements)
                        .filter(adapter_api_1.isInstanceElement)
                        .forEach(function (instance) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _a = instance;
                                    return [4 /*yield*/, replaceReferenceValues({
                                            instance: instance,
                                            resolverFinder: resolverFinder,
                                            elemLookupMaps: { elemLookup: elemLookup },
                                            fieldsWithResolvedReferences: fieldsWithResolvedReferences,
                                            elemByElemID: elemByElemID,
                                            contextStrategyLookup: contextStrategyLookup,
                                        })];
                                case 1:
                                    _a.value = _b.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 3:
                _c.sent();
                log.debug('added references in the following fields: %s', __spreadArrays(fieldsWithResolvedReferences));
                return [2 /*return*/];
        }
    });
}); };
exports.addReferences = addReferences;
/**
 * Convert field values into references, based on predefined rules.
 *
 */
var filter = function (_a) {
    var config = _a.config;
    return ({
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var refDef;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        refDef = config.enumFieldPermissions
                            ? reference_mapping_1.defaultFieldNameToTypeMappingDefs
                            : reference_mapping_1.fieldNameToTypeMappingDefs;
                        return [4 /*yield*/, exports.addReferences(elements, utils_1.buildElementsSourceForFetch(elements, config), refDef)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    });
};
exports["default"] = filter;
