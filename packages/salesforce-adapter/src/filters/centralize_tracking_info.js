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
exports.__esModule = true;
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
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
// Of the types enumerated in https://help.salesforce.com/s/articleView?id=sf.tracking_field_history.htm&type=5, only
// the types mentioned as having an object-level checkbox in
// https://help.salesforce.com/s/articleView?id=sf.tracking_field_history_for_standard_objects.htm&type=5 have an
// object-level enable. For other types, we should assume tracking is supported and enabled.
var TYPES_WITH_NO_OBJECT_LEVEL_ENABLE_HISTORY = [
    'ActiveScratchOrg',
    'Article',
    'Asset',
    'Campaign',
    'Case',
    'ContentVersion',
    'Contract',
    'ContractLineItem',
    'Crisis',
    'Employee',
    'EmployeeCrisisAssessment',
    'Entitlement',
    'Event',
    'Individual',
    'InternalOrganizationUnit',
    'Knowledge',
    'LiveChatTranscript',
    'NamespaceRegistry',
    'Order',
    'OrderItem',
    'PartnerMarketingBudget',
    'PartnerFundAllocation',
    'Pricebook2',
    'PricebookEntry',
    'Product',
    'Product2',
    'Quote',
    'QuoteLineItem',
    'ScratchOrgInfo',
    'ServiceAppointment',
    'ServiceContract',
    'ServiceResource',
    'SignupRequest',
    'Solution',
    'Task',
    'WorkOrder',
    'WorkOrderLineItem',
];
var trackedFieldsDefinitions = [
    {
        objectLevelEnable: constants_1.OBJECT_HISTORY_TRACKING_ENABLED,
        recordTypeEnable: constants_1.RECORD_TYPE_HISTORY_TRACKING_ENABLED,
        fieldLevelEnable: constants_1.FIELD_ANNOTATIONS.TRACK_HISTORY,
        aggregate: constants_1.HISTORY_TRACKED_FIELDS,
        alwaysEnabledObjectTypes: new Set(TYPES_WITH_NO_OBJECT_LEVEL_ENABLE_HISTORY),
    },
    {
        objectLevelEnable: constants_1.OBJECT_FEED_HISTORY_TRACKING_ENABLED,
        recordTypeEnable: constants_1.RECORD_TYPE_FEED_HISTORY_TRACKING_ENABLED,
        fieldLevelEnable: constants_1.FIELD_ANNOTATIONS.TRACK_FEED_HISTORY,
        aggregate: constants_1.FEED_HISTORY_TRACKED_FIELDS,
        alwaysEnabledObjectTypes: new Set(),
    },
];
var isHistoryTrackingEnabled = function (type, trackingDef) { return (type.annotations[trackingDef.objectLevelEnable] === true
    || trackingDef.alwaysEnabledObjectTypes.has(type.elemID.typeName)); };
var trackedFields = function (type, trackingDef) {
    var _a;
    return (Object.keys((_a = type === null || type === void 0 ? void 0 : type.annotations[trackingDef.aggregate]) !== null && _a !== void 0 ? _a : {}));
};
var isHistoryTrackedField = function (field, trackingDef) { return ((field.annotations[trackingDef.fieldLevelEnable] === true)
    || trackedFields(field.parent, trackingDef).includes(field.name)); };
var deleteFieldHistoryTrackingAnnotation = function (field, trackingDef) {
    if (field !== undefined) {
        delete field.annotations[trackingDef.fieldLevelEnable];
    }
};
var centralizeHistoryTrackingAnnotations = function (customObject, trackingDef) {
    var areAnyFieldsTracked = function (obj) { return (Object.values(obj.fields).some(function (field) { return field.annotations[trackingDef.fieldLevelEnable] === true; })); };
    var isTrackingSupported = function (obj) { return (obj.annotations[trackingDef.objectLevelEnable] !== undefined
        && !trackingDef.alwaysEnabledObjectTypes.has(obj.elemID.typeName)); };
    if (isHistoryTrackingEnabled(customObject, trackingDef)) {
        customObject.annotations[trackingDef.aggregate] = lodash_1["default"].mapValues(lodash_1["default"].pickBy(customObject.fields, function (field) { return isHistoryTrackedField(field, trackingDef); }), function (field) { return new adapter_api_1.ReferenceExpression(field.elemID); });
    }
    else {
        // After the resolution of SALTO-4309, the following should not happen. Let's make sure, though...
        if (customObject.annotations[trackingDef.recordTypeEnable] === true) {
            log.debug('In object type %s, %s is %s but %s is true. Treating as tracking disabled.', customObject.elemID.getFullName(), trackingDef.objectLevelEnable, customObject.annotations[trackingDef.objectLevelEnable], trackingDef.recordTypeEnable);
        }
        if (!isTrackingSupported(customObject) && areAnyFieldsTracked(customObject)) {
            log.debug('In object type %s, %s is %s but some fields have tracking enabled', customObject.elemID.getFullName(), trackingDef.objectLevelEnable, customObject.annotations[trackingDef.objectLevelEnable]);
        }
    }
    Object.values(customObject.fields).forEach(function (field) { return deleteFieldHistoryTrackingAnnotation(field, trackingDef); });
};
var fieldHistoryTrackingChanged = function (field, objectTypeChange, trackingDef) {
    var _a, _b;
    var _c = adapter_api_1.getAllChangeData(objectTypeChange), typeBefore = _c[0], typeAfter = _c[1];
    var trackedBefore = Object.keys((_a = typeBefore.annotations[trackingDef.aggregate]) !== null && _a !== void 0 ? _a : {}).includes(field.name);
    var trackedAfter = Object.keys((_b = typeAfter.annotations[trackingDef.aggregate]) !== null && _b !== void 0 ? _b : {}).includes(field.name);
    var existsAfter = field.name in typeAfter.fields;
    return existsAfter && (trackedBefore !== trackedAfter);
};
var createHistoryTrackingFieldChange = function (field, objectTypeChange, trackingDef) {
    var _a, _b;
    var _c = adapter_api_1.getAllChangeData(objectTypeChange), typeBefore = _c[0], typeAfter = _c[1];
    var trackedBefore = Object.keys((_a = typeBefore.annotations[trackingDef.aggregate]) !== null && _a !== void 0 ? _a : {}).includes(field.name);
    var trackedAfter = Object.keys((_b = typeAfter.annotations[trackingDef.aggregate]) !== null && _b !== void 0 ? _b : {}).includes(field.name);
    var fieldBefore = field.clone();
    var fieldAfter = field.clone();
    if (!trackedBefore && trackedAfter) {
        // field was added to the annotations
        fieldBefore.annotations[trackingDef.fieldLevelEnable] = false;
        fieldAfter.annotations[trackingDef.fieldLevelEnable] = true;
    }
    else {
        // field was removed from the annotations
        fieldBefore.annotations[trackingDef.fieldLevelEnable] = true;
        fieldAfter.annotations[trackingDef.fieldLevelEnable] = false;
    }
    return adapter_api_1.toChange({ before: fieldBefore, after: fieldAfter });
};
/**
 * Note: we assume this filter runs *after* custom objects are turned into types (custom_object_to_object_type) but
 * *before* these types are split up into different elements (custom_type_split)
 * */
var filter = function () {
    var fieldsWithSyntheticChanges = new Set();
    return {
        name: 'centralizeTrackingInfo',
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                trackedFieldsDefinitions.forEach(function (trackingDef) { return elements
                    .filter(adapter_api_1.isObjectType)
                    .filter(transformer_1.isCustomObject)
                    .forEach(function (objType) { return centralizeHistoryTrackingAnnotations(objType, trackingDef); }); });
                return [2 /*return*/];
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var distributeTrackingInfo, distributeTrackingInfoInAddedObjectTypes, updateAnnotationsOnChangedFields, distributeTrackingInfoInModifiedObjectTypes, additionalChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        distributeTrackingInfo = function (objType, trackingDef) {
                            if (!isHistoryTrackingEnabled(objType, trackingDef)) {
                                return;
                            }
                            Object.values(objType.fields)
                                .forEach(function (field) {
                                field.annotations[trackingDef.fieldLevelEnable] = isHistoryTrackedField(field, trackingDef);
                            });
                        };
                        distributeTrackingInfoInAddedObjectTypes = function (trackingDef) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, awu(changes)
                                            .filter(adapter_api_1.isAdditionChange)
                                            .filter(adapter_api_1.isObjectTypeChange)
                                            .filter(function (change) { return transformer_1.isCustomObject(adapter_api_1.getChangeData(change)); })
                                            .map(adapter_api_1.getChangeData)
                                            .forEach(function (objType) { return distributeTrackingInfo(objType, trackingDef); })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); };
                        updateAnnotationsOnChangedFields = function (trackingDef) { return __awaiter(void 0, void 0, void 0, function () {
                            var fieldsThatChanged;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, awu(changes)
                                            .filter(adapter_api_1.isAdditionOrModificationChange)
                                            .map(adapter_api_1.getChangeData)
                                            .filter(adapter_api_1.isField)
                                            .filter(transformer_1.isFieldOfCustomObject)
                                            .toArray()];
                                    case 1:
                                        fieldsThatChanged = _a.sent();
                                        fieldsThatChanged.forEach(function (field) {
                                            field.annotations[trackingDef.fieldLevelEnable] = isHistoryTrackedField(field, trackingDef);
                                        });
                                        return [2 /*return*/, fieldsThatChanged.map(function (field) { return field.elemID.getFullName(); })];
                                }
                            });
                        }); };
                        distributeTrackingInfoInModifiedObjectTypes = function (trackingDef, namesOfFieldsThatChanged) { return __awaiter(void 0, void 0, void 0, function () {
                            var modifiedObjectTypes, additionalChanges;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, awu(changes)
                                            .filter(adapter_api_1.isObjectTypeChange)
                                            .filter(adapter_api_1.isModificationChange)
                                            .filter(function (change) { return transformer_1.isCustomObject(adapter_api_1.getChangeData(change)); })
                                            .toArray()
                                        //  - set the annotations on the type and its fields
                                    ];
                                    case 1:
                                        modifiedObjectTypes = _a.sent();
                                        //  - set the annotations on the type and its fields
                                        modifiedObjectTypes
                                            .map(adapter_api_1.getChangeData)
                                            .forEach(function (objType) { return distributeTrackingInfo(objType, trackingDef); });
                                        additionalChanges = modifiedObjectTypes.flatMap(function (change) { return (Object.values(adapter_api_1.getChangeData(change).fields)
                                            .filter(function (field) { return !namesOfFieldsThatChanged.has(field.elemID.getFullName()); })
                                            .filter(function (field) { return fieldHistoryTrackingChanged(field, change, trackingDef); })
                                            .map(function (field) { return createHistoryTrackingFieldChange(field, change, trackingDef); })); });
                                        additionalChanges
                                            .map(adapter_api_1.getChangeData)
                                            .map(function (field) { return field.elemID.getFullName(); })
                                            .forEach(function (name) { return fieldsWithSyntheticChanges.add(name); });
                                        return [2 /*return*/, additionalChanges];
                                }
                            });
                        }); };
                        fieldsWithSyntheticChanges = new Set();
                        additionalChanges = [];
                        return [4 /*yield*/, awu(trackedFieldsDefinitions)
                                .forEach(function (trackingDef) { return __awaiter(void 0, void 0, void 0, function () {
                                var namesOfFieldsThatChanged, _a, fieldChanges;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: 
                                        // Added object types - set the annotations on the type and its fields
                                        return [4 /*yield*/, distributeTrackingInfoInAddedObjectTypes(trackingDef)
                                            // Added or modified fields - set the annotations on the fields
                                        ];
                                        case 1:
                                            // Added object types - set the annotations on the type and its fields
                                            _b.sent();
                                            _a = Set.bind;
                                            return [4 /*yield*/, updateAnnotationsOnChangedFields(trackingDef)];
                                        case 2:
                                            namesOfFieldsThatChanged = new (_a.apply(Set, [void 0, _b.sent()]))();
                                            return [4 /*yield*/, distributeTrackingInfoInModifiedObjectTypes(trackingDef, namesOfFieldsThatChanged)];
                                        case 3:
                                            fieldChanges = _b.sent();
                                            fieldChanges.forEach(function (change) { return additionalChanges.push(change); });
                                            // Finally, remove the aggregate annotation from all object types (either added or changed)
                                            changes
                                                .filter(adapter_api_1.isAdditionOrModificationChange)
                                                .filter(adapter_api_1.isObjectTypeChange)
                                                .map(adapter_api_1.getChangeData)
                                                .filter(transformer_1.isCustomObject)
                                                .forEach(function (objType) {
                                                delete objType.annotations[trackingDef.aggregate];
                                            });
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        additionalChanges.forEach(function (change) { return changes.push(change); });
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var isSyntheticChangeFromPreDeploy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        isSyntheticChangeFromPreDeploy = function (change) { return (adapter_api_1.isFieldChange(change)
                            && adapter_api_1.isModificationChange(change)
                            && fieldsWithSyntheticChanges.has(adapter_api_1.getChangeData(change).elemID.getFullName())); };
                        // We want to make sure we remove the changes we created in preDeploy
                        lodash_1["default"].remove(changes, function (change) { return isSyntheticChangeFromPreDeploy(change); });
                        return [4 /*yield*/, awu(trackedFieldsDefinitions).forEach(function (trackingDef) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, awu(changes)
                                                .filter(adapter_api_1.isAdditionOrModificationChange)
                                                .filter(adapter_api_1.isObjectTypeChange)
                                                .map(adapter_api_1.getChangeData)
                                                .filter(transformer_1.isCustomObject)
                                                .forEach(function (objType) { return centralizeHistoryTrackingAnnotations(objType, trackingDef); })];
                                        case 1:
                                            _a.sent();
                                            return [4 /*yield*/, awu(changes)
                                                    .filter(adapter_api_1.isFieldChange)
                                                    .filter(function (change) { return transformer_1.isFieldOfCustomObject(adapter_api_1.getChangeData(change)); })
                                                    .forEach(function (change) {
                                                    var _a = adapter_api_1.getAllChangeData(change), before = _a[0], after = _a[1];
                                                    deleteFieldHistoryTrackingAnnotation(before, trackingDef);
                                                    deleteFieldHistoryTrackingAnnotation(after, trackingDef);
                                                })];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    };
};
exports["default"] = filter;
