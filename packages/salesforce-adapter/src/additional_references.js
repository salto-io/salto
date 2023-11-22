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
exports.getAdditionalReferences = void 0;
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
var lodash_1 = require("lodash");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var transformer_1 = require("./transformers/transformer");
var utils_1 = require("./filters/utils");
var constants_1 = require("./constants");
var awu = lowerdash_1.collections.asynciterable.awu;
var isDefined = lowerdash_1.values.isDefined;
var CUSTOM_APP_SECTION = 'applicationVisibilities';
var APEX_CLASS_SECTION = 'classAccesses';
var FLOW_SECTION = 'flowAccesses';
var LAYOUTS_SECTION = 'layoutAssignments';
var OBJECT_SECTION = 'objectPermissions';
var APEX_PAGE_SECTION = 'pageAccesses';
var RECORD_TYPE_SECTION = 'recordTypeVisibilities';
var createReferenceMapping = function (source, target, sectionEntryKey, profileSection) {
    var _a;
    var _b = source.data, beforeSource = _b.before, afterSource = _b.after;
    var sourceId = (_a = afterSource.elemID).createNestedID.apply(_a, __spreadArrays([profileSection], sectionEntryKey.split(constants_1.API_NAME_SEPARATOR)));
    var sourceDetailedChanges = adapter_utils_1.getValuesChanges({
        id: sourceId,
        after: adapter_utils_1.resolvePath(afterSource, sourceId),
        before: adapter_utils_1.resolvePath(beforeSource, sourceId),
        beforeId: sourceId,
        afterId: sourceId,
    });
    var targetDetailedChanges = adapter_utils_1.getDetailedChanges(target);
    return targetDetailedChanges.flatMap(function (targetChange) { return sourceDetailedChanges.map(function (sourceChange) { return ({
        source: sourceChange.id,
        target: targetChange.id,
    }); }); });
};
var newFieldWithNoAccess = function (profileOrPermissionSetChange, fieldApiName) {
    var _a = adapter_api_1.getAllChangeData(profileOrPermissionSetChange), before = _a[0], after = _a[1];
    var sectionEntryBefore = lodash_1["default"].get(before.value[constants_1.FIELD_PERMISSIONS], fieldApiName);
    var sectionEntryAfter = lodash_1["default"].get(after.value[constants_1.FIELD_PERMISSIONS], fieldApiName);
    return sectionEntryBefore === undefined
        && sectionEntryAfter === 'NoAccess';
};
var fieldRefsFromProfileOrPermissionSet = function (profilesAndPermissionSetsChanges, potentialTarget) { return __awaiter(void 0, void 0, void 0, function () {
    var apiName;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, utils_1.safeApiName(adapter_api_1.getChangeData(potentialTarget))];
            case 1:
                apiName = _a.sent();
                if (apiName === undefined) {
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, profilesAndPermissionSetsChanges
                        .filter(function (profileOrPermissionSet) { return lodash_1["default"].get(adapter_api_1.getChangeData(profileOrPermissionSet).value[constants_1.FIELD_PERMISSIONS], apiName); })
                        .filter(function (change) { return !newFieldWithNoAccess(change, apiName); })
                        .flatMap(function (profileOrPermissionSet) { return createReferenceMapping(profileOrPermissionSet, potentialTarget, apiName, constants_1.FIELD_PERMISSIONS); })];
        }
    });
}); };
var refNameFromField = function (typeName, fieldName) { return (function (element) { return ([{ typeName: typeName, refName: element[fieldName] }]); }); };
var instanceRefsFromProfileOrPermissionSet = function (profileAndPermissionSetChanges, profileSection, instanceNameGetter, shouldCreateReference, instanceApiNameIndex, instanceElemIdIndex) { return __awaiter(void 0, void 0, void 0, function () {
    var extractRefFromSectionEntry;
    return __generator(this, function (_a) {
        extractRefFromSectionEntry = function (profileOrPermissionSetChange, sectionEntryKey, sectionEntryContents) { return __awaiter(void 0, void 0, void 0, function () {
            var refNames;
            return __generator(this, function (_a) {
                refNames = instanceNameGetter(sectionEntryContents, sectionEntryKey);
                return [2 /*return*/, refNames
                        .map(function (_a) {
                        var typeName = _a.typeName, refName = _a.refName;
                        return (adapter_api_1.isReferenceExpression(refName)
                            ? instanceElemIdIndex.get(typeName, refName.elemID.getFullName())
                            : instanceApiNameIndex.get(typeName, refName));
                    })
                        .filter(isDefined)
                        .flatMap(function (refTarget) { return createReferenceMapping(profileOrPermissionSetChange, refTarget, sectionEntryKey, profileSection); })];
            });
        }); };
        return [2 /*return*/, awu(profileAndPermissionSetChanges)
                .filter(function (change) { return profileSection in adapter_api_1.getChangeData(change).value; })
                .flatMap(function (change) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, (awu(Object.entries(adapter_api_1.getChangeData(change).value[profileSection]))
                            .filter(function (_a) {
                            var entryKey = _a[0], entryContents = _a[1];
                            return shouldCreateReference(lodash_1["default"].get(change.data.before.value[profileSection], entryKey), entryContents);
                        })
                            .flatMap(function (_a) {
                            var sectionEntryKey = _a[0], sectionEntryContents = _a[1];
                            return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_b) {
                                    return [2 /*return*/, extractRefFromSectionEntry(change, sectionEntryKey, sectionEntryContents)];
                                });
                            });
                        })
                            .filter(isDefined)
                            .toArray())];
                });
            }); })
                .toArray()];
    });
}); };
var getAllRefNamesFromSection = function (rootElemId, section, fieldName) {
    var recordTypeRefNames = [];
    adapter_utils_1.walkOnValue({
        elemId: rootElemId,
        value: section,
        func: function (_a) {
            var value = _a.value;
            if (typeof value === 'object' && fieldName in value) {
                recordTypeRefNames.push(value[fieldName]);
                return adapter_utils_1.WALK_NEXT_STEP.SKIP;
            }
            return adapter_utils_1.WALK_NEXT_STEP.RECURSE;
        },
    });
    return recordTypeRefNames;
};
var createRecordTypeRef = function (profileOrPermSet, instancesIndex, sectionName, sourceSectionEntry, targetRefName) { return (createReferenceMapping(profileOrPermSet, instancesIndex.get(constants_1.RECORD_TYPE_METADATA_TYPE, targetRefName), sourceSectionEntry.join(constants_1.API_NAME_SEPARATOR), sectionName)); };
var createRefIfExistingOrDefaultOrVisible = function (valueBefore, valueAfter) { return (valueBefore !== undefined || valueAfter["default"] || valueAfter.visible); };
var createRefIfExistingOrEnabled = function (valueBefore, valueAfter) { return (valueBefore !== undefined || valueAfter.enabled); };
var createRefIfExistingOrAnyAccess = function (valueBefore, valueAfter) { return (valueBefore !== undefined
    || valueAfter.allowCreate
    || valueAfter.allowDelete
    || valueAfter.allowEdit
    || valueAfter.allowRead
    || valueAfter.modifyAllRecords
    || valueAfter.viewAllRecords); };
var createRefIfFieldsExistingOrAnyAccess = function (valueBefore, valueAfter) { return (valueBefore !== undefined
    || (lodash_1["default"].isPlainObject(valueAfter) && Object.values(valueAfter).some(function (val) { return val !== 'NoAccess'; }))); };
var alwaysCreateRefs = function () { return true; };
var getAdditionalReferences = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var relevantFieldChanges, customObjectChanges, instanceChanges, profilesAndPermSetsChanges, instancesIndex, customAppsRefs, apexClassRefs, flowRefs, getRefsFromLayoutAssignment, layoutRefs, apexPageRefs, objectRefs, objectFieldRefs, fieldPermissionsRefs, recordTypeRefs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(changes)
                    .filter(adapter_api_1.isFieldChange)
                    .filter(adapter_api_1.isAdditionOrModificationChange)
                    .filter(function (change) { return transformer_1.isFieldOfCustomObject(adapter_api_1.getChangeData(change)); })
                    .toArray()];
            case 1:
                relevantFieldChanges = _a.sent();
                customObjectChanges = awu(changes)
                    .filter(adapter_api_1.isAdditionOrModificationChange)
                    .filter(function (change) { return transformer_1.isCustomObject(adapter_api_1.getChangeData(change)); });
                instanceChanges = changes
                    .filter(adapter_api_1.isInstanceChange)
                    .filter(adapter_api_1.isAdditionOrModificationChange);
                return [4 /*yield*/, awu(changes)
                        .filter(adapter_api_1.isModificationChange)
                        .filter(adapter_api_1.isInstanceChange)
                        .filter(function (change) { return utils_1.isInstanceOfType(constants_1.PROFILE_METADATA_TYPE, constants_1.PERMISSION_SET_METADATA_TYPE)(adapter_api_1.getChangeData(change)); })
                        .toArray()];
            case 2:
                profilesAndPermSetsChanges = _a.sent();
                return [4 /*yield*/, lowerdash_1.multiIndex.buildMultiIndex()
                        .addIndex({
                        name: 'byTypeAndApiName',
                        key: function (change) { return __awaiter(void 0, void 0, void 0, function () { var _a; var _b; return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _a = [adapter_api_1.getChangeData(change).elemID.typeName];
                                    return [4 /*yield*/, utils_1.safeApiName(adapter_api_1.getChangeData(change))];
                                case 1: return [2 /*return*/, _a.concat([(_b = _c.sent()) !== null && _b !== void 0 ? _b : ''])];
                            }
                        }); }); },
                    })
                        .addIndex({
                        name: 'byTypeAndElemId',
                        key: function (change) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, [adapter_api_1.getChangeData(change).elemID.typeName, adapter_api_1.getChangeData(change).elemID.getFullName()]];
                        }); }); },
                    })
                        .process(awu(instanceChanges).concat(customObjectChanges))];
            case 3:
                instancesIndex = _a.sent();
                return [4 /*yield*/, instanceRefsFromProfileOrPermissionSet(profilesAndPermSetsChanges, CUSTOM_APP_SECTION, refNameFromField(constants_1.CUSTOM_APPLICATION_METADATA_TYPE, 'application'), createRefIfExistingOrDefaultOrVisible, instancesIndex.byTypeAndApiName, instancesIndex.byTypeAndElemId)];
            case 4:
                customAppsRefs = _a.sent();
                return [4 /*yield*/, instanceRefsFromProfileOrPermissionSet(profilesAndPermSetsChanges, APEX_CLASS_SECTION, refNameFromField(constants_1.APEX_CLASS_METADATA_TYPE, 'apexClass'), createRefIfExistingOrEnabled, instancesIndex.byTypeAndApiName, instancesIndex.byTypeAndElemId)];
            case 5:
                apexClassRefs = _a.sent();
                return [4 /*yield*/, instanceRefsFromProfileOrPermissionSet(profilesAndPermSetsChanges, FLOW_SECTION, refNameFromField(constants_1.FLOW_METADATA_TYPE, 'flow'), createRefIfExistingOrEnabled, instancesIndex.byTypeAndApiName, instancesIndex.byTypeAndElemId)];
            case 6:
                flowRefs = _a.sent();
                getRefsFromLayoutAssignment = function (layoutAssignment) {
                    var _a;
                    return (__spreadArrays([
                        { typeName: constants_1.LAYOUT_TYPE_ID_METADATA_TYPE, refName: (_a = layoutAssignment[0]) === null || _a === void 0 ? void 0 : _a.layout }
                    ], layoutAssignment
                        .map(function (layoutAssignmentEntry) { return layoutAssignmentEntry.recordType; })
                        .filter(isDefined)
                        .map(function (recordTypeName) { return ({ typeName: constants_1.RECORD_TYPE_METADATA_TYPE, refName: recordTypeName }); })));
                };
                return [4 /*yield*/, instanceRefsFromProfileOrPermissionSet(profilesAndPermSetsChanges, LAYOUTS_SECTION, getRefsFromLayoutAssignment, alwaysCreateRefs, instancesIndex.byTypeAndApiName, instancesIndex.byTypeAndElemId)];
            case 7:
                layoutRefs = _a.sent();
                return [4 /*yield*/, instanceRefsFromProfileOrPermissionSet(profilesAndPermSetsChanges, APEX_PAGE_SECTION, refNameFromField(constants_1.APEX_PAGE_METADATA_TYPE, 'apexPage'), createRefIfExistingOrEnabled, instancesIndex.byTypeAndApiName, instancesIndex.byTypeAndElemId)];
            case 8:
                apexPageRefs = _a.sent();
                return [4 /*yield*/, instanceRefsFromProfileOrPermissionSet(profilesAndPermSetsChanges, OBJECT_SECTION, function (object, key) { return ([{ typeName: key, refName: object.object }]); }, createRefIfExistingOrAnyAccess, instancesIndex.byTypeAndApiName, instancesIndex.byTypeAndElemId)];
            case 9:
                objectRefs = _a.sent();
                return [4 /*yield*/, instanceRefsFromProfileOrPermissionSet(profilesAndPermSetsChanges, constants_1.FIELD_PERMISSIONS, function (_object, key) { return ([{ typeName: key, refName: key }]); }, createRefIfFieldsExistingOrAnyAccess, instancesIndex.byTypeAndApiName, instancesIndex.byTypeAndElemId)];
            case 10:
                objectFieldRefs = _a.sent();
                fieldPermissionsRefs = awu(relevantFieldChanges)
                    .flatMap(function (field) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, fieldRefsFromProfileOrPermissionSet(profilesAndPermSetsChanges, field)];
                }); }); });
                recordTypeRefs = profilesAndPermSetsChanges
                    .flatMap(function (change) {
                    var recordTypeRefNames = getAllRefNamesFromSection(adapter_api_1.getChangeData(change).elemID, adapter_api_1.getChangeData(change).value[RECORD_TYPE_SECTION], 'recordType');
                    return recordTypeRefNames
                        .filter(function (refName) { return instancesIndex.byTypeAndApiName.get(constants_1.RECORD_TYPE_METADATA_TYPE, refName); })
                        .filter(function (refName) { return createRefIfExistingOrDefaultOrVisible(lodash_1["default"].get(change.data.before.value[RECORD_TYPE_SECTION], refName), lodash_1["default"].get(change.data.after.value[RECORD_TYPE_SECTION], refName)); })
                        .flatMap(function (refName) { return createRecordTypeRef(change, instancesIndex.byTypeAndApiName, RECORD_TYPE_SECTION, refName.split(constants_1.API_NAME_SEPARATOR), refName); });
                });
                return [2 /*return*/, fieldPermissionsRefs
                        .concat(customAppsRefs)
                        .concat(apexClassRefs)
                        .concat(flowRefs)
                        .concat(layoutRefs)
                        .concat(objectRefs)
                        .concat(objectFieldRefs)
                        .concat(apexPageRefs)
                        .concat(recordTypeRefs)
                        .toArray()];
        }
    });
}); };
exports.getAdditionalReferences = getAdditionalReferences;
