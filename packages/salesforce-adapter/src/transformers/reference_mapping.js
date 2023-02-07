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
exports.getLookUpName = exports.generateReferenceResolverFinder = exports.FieldReferenceResolver = exports.fieldNameToTypeMappingDefs = exports.defaultFieldNameToTypeMappingDefs = void 0;
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
var lodash_1 = require("lodash");
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("./transformer");
var constants_1 = require("../constants");
var log = logging_1.logger(module);
var awu = lowerdash_1.collections.asynciterable.awu;
var safeApiName = function (_a) {
    var ref = _a.ref, path = _a.path, relative = _a.relative;
    var value = ref.value;
    if (!adapter_api_1.isElement(value)) {
        log.warn('Unexpected non-element value for ref id %s in path %s', ref.elemID.getFullName(), path === null || path === void 0 ? void 0 : path.getFullName());
        return value;
    }
    return transformer_1.apiName(value, relative);
};
var ReferenceSerializationStrategyLookup = {
    absoluteApiName: {
        serialize: function (_a) {
            var ref = _a.ref, path = _a.path;
            return safeApiName({ ref: ref, path: path, relative: false });
        },
        lookup: function (val) { return val; },
    },
    relativeApiName: {
        serialize: function (_a) {
            var ref = _a.ref, path = _a.path;
            return safeApiName({ ref: ref, path: path, relative: true });
        },
        lookup: function (val, context) { return (context !== undefined
            ? [context, val].join(constants_1.API_NAME_SEPARATOR)
            : val); },
    },
    configurationAttributeMapping: {
        serialize: function (_a) {
            var ref = _a.ref, path = _a.path;
            return __awaiter(void 0, void 0, void 0, function () {
                var _b;
                var _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _b = lodash_1["default"].invert(constants_1.DEFAULT_OBJECT_TO_API_MAPPING);
                            return [4 /*yield*/, safeApiName({ ref: ref, path: path })];
                        case 1: return [2 /*return*/, ((_c = _b[_d.sent()]) !== null && _c !== void 0 ? _c : safeApiName({ ref: ref, path: path }))];
                    }
                });
            });
        },
        lookup: function (val) { var _a; return (lodash_1["default"].isString(val) ? ((_a = constants_1.DEFAULT_OBJECT_TO_API_MAPPING[val]) !== null && _a !== void 0 ? _a : val) : val); },
    },
    lookupQueryMapping: {
        serialize: function (_a) {
            var ref = _a.ref, path = _a.path;
            return __awaiter(void 0, void 0, void 0, function () {
                var _b;
                var _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _b = lodash_1["default"].invert(constants_1.TEST_OBJECT_TO_API_MAPPING);
                            return [4 /*yield*/, safeApiName({ ref: ref, path: path })];
                        case 1: return [2 /*return*/, ((_c = _b[_d.sent()]) !== null && _c !== void 0 ? _c : safeApiName({ ref: ref, path: path }))];
                    }
                });
            });
        },
        lookup: function (val) { var _a; return (lodash_1["default"].isString(val) ? ((_a = constants_1.TEST_OBJECT_TO_API_MAPPING[val]) !== null && _a !== void 0 ? _a : val) : val); },
    },
    scheduleConstraintFieldMapping: {
        serialize: function (_a) {
            var ref = _a.ref, path = _a.path;
            return __awaiter(void 0, void 0, void 0, function () {
                var relativeApiName;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, safeApiName({ ref: ref, path: path, relative: true })];
                        case 1:
                            relativeApiName = _c.sent();
                            return [2 /*return*/, ((_b = lodash_1["default"].invert(constants_1.SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING)[relativeApiName]) !== null && _b !== void 0 ? _b : relativeApiName)];
                    }
                });
            });
        },
        lookup: function (val, context) {
            var mappedValue = constants_1.SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING[val];
            return (context !== undefined
                ? [context, mappedValue].join(constants_1.API_NAME_SEPARATOR)
                : mappedValue);
        },
    },
    mapKey: {
        serialize: function (_a) {
            var ref = _a.ref;
            return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_b) {
                return [2 /*return*/, ref.elemID.name];
            }); });
        },
        lookup: function (val) { return val; },
    },
    customLabel: {
        serialize: function (_a) {
            var ref = _a.ref, path = _a.path;
            return __awaiter(void 0, void 0, void 0, function () { var _b; return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _b = "$Label" + constants_1.API_NAME_SEPARATOR;
                        return [4 /*yield*/, safeApiName({ ref: ref, path: path })];
                    case 1: return [2 /*return*/, _b + (_c.sent())];
                }
            }); });
        },
        lookup: function (val) {
            if (val.includes('$Label')) {
                return val.split(constants_1.API_NAME_SEPARATOR)[1];
            }
            return val;
        },
    },
};
exports.defaultFieldNameToTypeMappingDefs = __spreadArrays([
    {
        src: { field: 'field', parentTypes: [constants_1.WORKFLOW_FIELD_UPDATE_METADATA_TYPE, constants_1.LAYOUT_ITEM_METADATA_TYPE, constants_1.SUMMARY_LAYOUT_ITEM_METADATA_TYPE, 'WorkflowEmailRecipient', 'QuickActionLayoutItem', 'FieldSetItem'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'flowName', parentTypes: ['FlowSubflow'] },
        target: { type: 'Flow' },
    },
    {
        src: { field: 'letterhead', parentTypes: ['EmailTemplate'] },
        target: { type: 'Letterhead' },
    },
    {
        src: { field: 'fields', parentTypes: ['WorkflowOutboundMessage'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', type: constants_1.CUSTOM_FIELD },
    },
    // note: not all field values under ReportColumn match this rule - but it's ok because
    // only the ones that match are currently extracted (SALTO-1758)
    {
        src: {
            field: 'field',
            parentTypes: ['ReportColumn', 'PermissionSetFieldPermissions'],
        },
        target: { type: constants_1.CUSTOM_FIELD },
    },
    {
        src: {
            field: 'field',
            parentTypes: ['FilterItem'],
            // match everything except SharingRules (which uses a different serialization strategy)
            instanceTypes: [/^(?!SharingRules$).*/],
        },
        target: { type: constants_1.CUSTOM_FIELD },
    },
    {
        src: {
            field: 'field',
            parentTypes: ['FilterItem'],
            instanceTypes: ['SharingRules'],
        },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'offsetFromField', parentTypes: ['WorkflowTask', 'WorkflowTimeTrigger'] },
        target: { type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'customLink', parentTypes: [constants_1.LAYOUT_ITEM_METADATA_TYPE, constants_1.SUMMARY_LAYOUT_ITEM_METADATA_TYPE] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', type: constants_1.WEBLINK_METADATA_TYPE },
    }
], ([constants_1.CUSTOM_FIELD, 'FieldSet', 'RecordType', 'SharingReason', constants_1.WEBLINK_METADATA_TYPE, 'WorkflowTask', constants_1.VALIDATION_RULES_METADATA_TYPE, 'QuickAction'].map(function (targetType) { return ({
    src: { field: 'name', parentTypes: [targetType + "Translation"] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'instanceParent', type: targetType },
}); })), [
    {
        src: { field: 'name', parentTypes: [constants_1.WORKFLOW_ACTION_REFERENCE_METADATA_TYPE] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', typeContext: 'neighborTypeWorkflow' },
    },
    {
        src: { field: 'name', parentTypes: ['GlobalQuickActionTranslation'] },
        target: { type: 'QuickAction' },
    },
    {
        src: { field: 'businessHours', parentTypes: ['EntitlementProcess', 'EntitlementProcessMilestoneItem'] },
        target: { type: 'BusinessHoursEntry' },
        serializationStrategy: 'mapKey',
    },
    {
        src: { field: 'businessProcess', parentTypes: [constants_1.RECORD_TYPE_METADATA_TYPE] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', type: constants_1.BUSINESS_PROCESS_METADATA_TYPE },
    },
    {
        // includes authorizationRequiredPage, bandwidthExceededPage, fileNotFoundPage, ...
        src: { field: /Page$/, parentTypes: ['CustomSite'] },
        target: { type: 'ApexPage' },
    },
    {
        src: { field: 'apexClass', parentTypes: ['FlowApexPluginCall', 'FlowVariable', 'ProfileApexClassAccess', 'TransactionSecurityPolicy'] },
        target: { type: 'ApexClass' },
    },
    {
        src: { field: 'recipient', parentTypes: ['WorkflowEmailRecipient'] },
        target: { type: 'Role' },
    },
    {
        src: { field: 'application', parentTypes: ['ProfileApplicationVisibility'] },
        target: { type: 'CustomApplication' },
    },
    {
        src: { field: 'permissionSets', parentTypes: ['PermissionSetGroup', 'DelegateGroup'] },
        target: { type: 'PermissionSet' },
    },
    {
        src: { field: 'layout', parentTypes: ['ProfileLayoutAssignment'] },
        target: { type: 'Layout' },
    },
    {
        src: { field: 'recordType', parentTypes: ['ProfileLayoutAssignment'] },
        target: { type: 'RecordType' },
    },
    {
        src: { field: 'flow', parentTypes: ['ProfileFlowAccess'] },
        target: { type: 'Flow' },
    },
    {
        src: { field: 'recordType', parentTypes: ['ProfileRecordTypeVisibility'] },
        target: { type: 'RecordType' },
    },
    {
        src: { field: 'tabs', parentTypes: ['CustomApplication'] },
        target: { type: 'CustomTab' },
    },
    {
        src: { field: 'tab', parentTypes: ['WorkspaceMapping'] },
        target: { type: 'CustomTab' },
    },
    {
        src: { field: 'actionName', parentTypes: ['FlowActionCall'] },
        target: { typeContext: 'neighborActionTypeFlowLookup' },
    },
    {
        src: { field: 'actionName', parentTypes: ['PlatformActionListItem'] },
        // will only resolve for actionType = QuickAction
        target: { typeContext: 'neighborActionTypeLookup' },
    },
    {
        src: { field: 'quickActionName', parentTypes: ['QuickActionListItem'] },
        target: { type: 'QuickAction' },
    },
    {
        src: { field: 'name', parentTypes: ['AppMenuItem'] },
        target: { typeContext: 'neighborTypeLookup' },
    },
    {
        src: { field: 'objectType', parentTypes: ['FlowVariable'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'object', parentTypes: ['ProfileObjectPermissions', 'FlowDynamicChoiceSet', 'FlowRecordLookup', 'FlowRecordUpdate', 'FlowRecordCreate', 'FlowRecordDelete', 'FlowStart', 'PermissionSetObjectPermissions'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'picklistObject', parentTypes: ['FlowDynamicChoiceSet'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'targetObject', parentTypes: ['QuickAction', 'AnalyticSnapshot'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'inputObject', parentTypes: ['ObjectMapping'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'outputObject', parentTypes: ['ObjectMapping'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'matchRuleSObjectType', parentTypes: ['DuplicateRuleMatchRule'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'typeValue', parentTypes: ['FlowDataTypeMapping'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'targetObject', parentTypes: ['WorkflowFieldUpdate'] },
        target: { parentContext: 'instanceParent', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'targetField', parentTypes: ['AnalyticSnapshot'] },
        target: { type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'name', parentTypes: ['ObjectSearchSetting'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'report', parentTypes: ['DashboardComponent'] },
        target: { type: 'Report' },
    },
    {
        src: { field: 'reportType', parentTypes: ['Report'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'entryStartDateField', parentTypes: ['EntitlementProcess'] },
        target: { type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'SObjectType', parentTypes: ['EntitlementProcess'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: constants_1.CPQ_LOOKUP_OBJECT_NAME, parentTypes: [constants_1.CPQ_PRICE_RULE, constants_1.CPQ_PRODUCT_RULE] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: constants_1.CPQ_RULE_LOOKUP_OBJECT_FIELD, parentTypes: [constants_1.CPQ_LOOKUP_QUERY, constants_1.CPQ_PRICE_ACTION] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: constants_1.CPQ_DEFAULT_OBJECT_FIELD, parentTypes: [constants_1.CPQ_CONFIGURATION_ATTRIBUTE] },
        serializationStrategy: 'configurationAttributeMapping',
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: constants_1.CPQ_TESTED_OBJECT, parentTypes: [constants_1.CPQ_LOOKUP_QUERY] },
        serializationStrategy: 'lookupQueryMapping',
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: constants_1.CPQ_OBJECT_NAME, parentTypes: [constants_1.CPQ_FIELD_METADATA] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'relatedList', parentTypes: ['RelatedListItem'] },
        target: { type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'value', parentTypes: ['FilterItem'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', type: constants_1.RECORD_TYPE_METADATA_TYPE },
    },
    {
        src: { field: 'sharedTo', parentTypes: ['FolderShare'] },
        target: { typeContext: 'neighborSharedToTypeLookup' },
    },
    {
        src: { field: 'role', parentTypes: ['SharedTo'] },
        target: { type: 'Role' },
    },
    {
        src: { field: 'roleAndSubordinates', parentTypes: ['SharedTo'] },
        target: { type: 'Role' },
    },
    {
        src: { field: 'group', parentTypes: ['SharedTo'] },
        target: { type: 'Group' },
    },
    {
        src: { field: 'compactLayoutAssignment', parentTypes: [constants_1.RECORD_TYPE_METADATA_TYPE] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', type: 'CompactLayout' },
    },
    {
        src: { field: 'template', parentTypes: ['RuleEntry'] },
        target: { type: 'EmailTemplate' },
    },
    {
        src: { field: 'field', parentTypes: ['ReportGrouping'] },
        target: { parentContext: 'instanceParent', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'field', parentTypes: ['ReportTypeColumn'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'neighborTableLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'publicGroup', parentTypes: ['PublicGroups'] },
        target: { type: 'Group' },
    },
    {
        src: { field: 'role', parentTypes: ['Roles'] },
        target: { type: 'Role' },
    },
    {
        // sometimes has a value that is not a reference - should only convert to reference
        // if lookupValueType exists
        src: { field: 'lookupValue', parentTypes: ['WorkflowFieldUpdate'] },
        target: { typeContext: 'neighborLookupValueTypeLookup' },
    }
], (['displayField', 'sortField', 'valueField'].map(function (fieldName) { return ({
    src: { field: fieldName, parentTypes: ['FlowDynamicChoiceSet'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborObjectLookup', type: constants_1.CUSTOM_FIELD },
}); })), (['queriedFields', 'sortField'].map(function (fieldName) { return ({
    src: { field: fieldName, parentTypes: ['FlowRecordLookup'] },
    serializationStrategy: 'relativeApiName',
    target: { parentContext: 'neighborObjectLookup', type: constants_1.CUSTOM_FIELD },
}); })), [
    {
        src: { field: 'field', parentTypes: ['FlowRecordFilter', 'FlowInputFieldAssignment', 'FlowOutputFieldAssignment'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'parentObjectLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'inputField', parentTypes: ['ObjectMappingField'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'parentInputObjectLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'outputField', parentTypes: ['ObjectMappingField'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'parentOutputObjectLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'picklistField', parentTypes: ['FlowDynamicChoiceSet'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'neighborPicklistObjectLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_LOOKUP_FIELD, parentTypes: [constants_1.CPQ_LOOKUP_QUERY] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'neighborCPQRuleLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_SOURCE_LOOKUP_FIELD, parentTypes: [constants_1.CPQ_PRICE_ACTION] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'neighborCPQRuleLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'errorDisplayField', parentTypes: ['ValidationRule'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'picklist', parentTypes: ['RecordTypePicklistValue'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'instanceParent', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'page', parentTypes: ['WebLink'] },
        target: { type: 'ApexPage' },
    },
    {
        src: { field: constants_1.CPQ_LOOKUP_PRODUCT_FIELD, parentTypes: [constants_1.CPQ_PRODUCT_RULE, constants_1.CPQ_PRICE_RULE] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'neighborCPQLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_LOOKUP_MESSAGE_FIELD, parentTypes: [constants_1.CPQ_PRODUCT_RULE, constants_1.CPQ_PRICE_RULE] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'neighborCPQLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_LOOKUP_REQUIRED_FIELD, parentTypes: [constants_1.CPQ_PRODUCT_RULE, constants_1.CPQ_PRICE_RULE] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'neighborCPQLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_LOOKUP_TYPE_FIELD, parentTypes: [constants_1.CPQ_PRODUCT_RULE, constants_1.CPQ_PRICE_RULE] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'neighborCPQLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_CONSUMPTION_RATE_FIELDS, parentTypes: [constants_1.CPQ_CUSTOM_SCRIPT] },
        serializationStrategy: 'relativeApiName',
        target: { parent: 'ConsumptionRate', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_CONSUMPTION_SCHEDULE_FIELDS, parentTypes: [constants_1.CPQ_CUSTOM_SCRIPT] },
        serializationStrategy: 'relativeApiName',
        target: { parent: 'ConsumptionSchedule', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_GROUP_FIELDS, parentTypes: [constants_1.CPQ_CUSTOM_SCRIPT] },
        serializationStrategy: 'relativeApiName',
        target: { parent: 'SBQQ__QuoteLineGroup__c', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_QUOTE_FIELDS, parentTypes: [constants_1.CPQ_CUSTOM_SCRIPT] },
        serializationStrategy: 'relativeApiName',
        target: { parent: 'SBQQ__Quote__c', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_QUOTE_LINE_FIELDS, parentTypes: [constants_1.CPQ_CUSTOM_SCRIPT] },
        serializationStrategy: 'relativeApiName',
        target: { parent: 'SBQQ__QuoteLine__c', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'SBQQ__FieldName__c', parentTypes: ['SBQQ__LineColumn__c'] },
        serializationStrategy: 'relativeApiName',
        target: { parent: 'SBQQ__QuoteLine__c', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'SBQQ__FieldName__c', parentTypes: [constants_1.CPQ_FIELD_METADATA] },
        serializationStrategy: 'relativeApiName',
        target: { parent: constants_1.CPQ_OBJECT_NAME, type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: constants_1.CPQ_CONSTRAINT_FIELD, parentTypes: [constants_1.CPQ_PRICE_SCHEDULE, constants_1.CPQ_DISCOUNT_SCHEDULE] },
        serializationStrategy: 'scheduleConstraintFieldMapping',
        target: { parent: constants_1.CPQ_QUOTE, type: constants_1.CUSTOM_FIELD },
    },
    // note: not all column and xColumn values match this rule - but it's ok because
    // only the ones that match are currently extracted (SALTO-1758)
    {
        src: { field: 'groupingColumn', parentTypes: ['Report'] },
        target: { type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'secondaryGroupingColumn', parentTypes: ['Report'] },
        target: { type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'column', parentTypes: ['ReportFilterItem', 'DashboardFilterColumn', 'DashboardTableColumn'] },
        target: { type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'recipient', parentTypes: ['WorkflowEmailRecipient'] },
        target: { type: 'Group' },
    },
    {
        src: { field: 'queue', parentTypes: ['ListView'] },
        target: { type: 'Queue' },
    },
    {
        src: { field: 'caseOwner', parentTypes: ['EmailToCaseRoutingAddress'] },
        target: { typeContext: 'neighborCaseOwnerTypeLookup' },
    },
    {
        src: { field: 'assignedTo', parentTypes: ['RuleEntry', 'EscalationAction'] },
        target: { typeContext: 'neighborAssignedToTypeLookup' },
    },
    {
        src: { field: 'assignedToTemplate', parentTypes: ['EscalationAction'] },
        target: { type: 'EmailTemplate' },
    },
    {
        src: { field: 'caseAssignNotificationTemplate', parentTypes: ['CaseSettings'] },
        target: { type: 'EmailTemplate' },
    },
    {
        src: { field: 'caseCloseNotificationTemplate', parentTypes: ['CaseSettings'] },
        target: { type: 'EmailTemplate' },
    },
    {
        src: { field: 'caseCommentNotificationTemplate', parentTypes: ['CaseSettings'] },
        target: { type: 'EmailTemplate' },
    },
    {
        src: { field: 'caseCreateNotificationTemplate', parentTypes: ['CaseSettings'] },
        target: { type: 'EmailTemplate' },
    },
    {
        src: { field: 'relatedEntityType', parentTypes: ['ServiceChannel'] },
        target: { type: constants_1.CUSTOM_OBJECT },
    },
    {
        src: { field: 'secondaryRoutingPriorityField', parentTypes: ['ServiceChannel'] },
        serializationStrategy: 'relativeApiName',
        target: { parentContext: 'neighborRelatedEntityTypeLookup', type: constants_1.CUSTOM_FIELD },
    },
    {
        src: { field: 'entitlementProcess', parentTypes: ['EntitlementTemplate'] },
        target: { type: 'EntitlementProcess' },
        sourceTransformation: 'asCaseInsensitiveString',
    },
    {
        src: { field: 'elementReference', parentTypes: ['FlowElementReferenceOrValue'] },
        serializationStrategy: 'customLabel',
        target: { type: constants_1.CUSTOM_LABEL_METADATA_TYPE },
    },
]);
// Optional reference that should not be used if enumFieldPermissions config is on
var fieldPermissionEnumDisabledExtraMappingDefs = [
    {
        src: { field: 'field', parentTypes: ['ProfileFieldLevelSecurity'] },
        target: { type: constants_1.CUSTOM_FIELD },
    },
];
/**
 * The rules for finding and resolving values into (and back from) reference expressions.
 * Overlaps between rules are allowed, and the first successful conversion wins.
 * Current order (defined by generateReferenceResolverFinder):
 *  1. Exact field names take precedence over regexp
 *  2. Order within each group is currently *not* guaranteed (groupBy is not stable)
 *
 * A value will be converted into a reference expression if:
 * 1. An element matching the rule is found.
 * 2. Resolving the resulting reference expression back returns the original value.
 */
exports.fieldNameToTypeMappingDefs = __spreadArrays(exports.defaultFieldNameToTypeMappingDefs, fieldPermissionEnumDisabledExtraMappingDefs);
var matchName = function (name, matcher) { return (lodash_1["default"].isString(matcher)
    ? matcher === name
    : matcher.test(name)); };
var matchApiName = function (elem, types) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _b = (_a = types).includes;
                return [4 /*yield*/, transformer_1.apiName(elem)];
            case 1: return [2 /*return*/, (_b.apply(_a, [_c.sent()]))];
        }
    });
}); };
var matchInstanceType = function (inst, matchers) { return __awaiter(void 0, void 0, void 0, function () {
    var typeName, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = transformer_1.apiName;
                return [4 /*yield*/, inst.getType()];
            case 1: return [4 /*yield*/, _a.apply(void 0, [_b.sent()])];
            case 2:
                typeName = _b.sent();
                return [2 /*return*/, matchers.some(function (matcher) { return matchName(typeName, matcher); })];
        }
    });
}); };
var FieldReferenceResolver = /** @class */ (function () {
    function FieldReferenceResolver(def) {
        var _a, _b;
        this.src = def.src;
        this.serializationStrategy = ReferenceSerializationStrategyLookup[(_a = def.serializationStrategy) !== null && _a !== void 0 ? _a : 'absoluteApiName'];
        this.sourceTransformation = adapter_components_1.references.ReferenceSourceTransformationLookup[(_b = def.sourceTransformation) !== null && _b !== void 0 ? _b : 'asString'];
        this.target = def.target
            ? __assign(__assign({}, def.target), { lookup: this.serializationStrategy.lookup }) : undefined;
    }
    FieldReferenceResolver.create = function (def) {
        return new FieldReferenceResolver(def);
    };
    FieldReferenceResolver.prototype.match = function (field, element) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = matchName(field.name, this.src.field);
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, matchApiName(field.parent, this.src.parentTypes)];
                    case 1:
                        _a = (_b.sent());
                        _b.label = 2;
                    case 2: return [2 /*return*/, (_a && (this.src.instanceTypes === undefined
                            || (adapter_api_1.isInstanceElement(element) && matchInstanceType(element, this.src.instanceTypes))))];
                }
            });
        });
    };
    return FieldReferenceResolver;
}());
exports.FieldReferenceResolver = FieldReferenceResolver;
/**
 * Generates a function that filters the relevant resolvers for a given field.
 */
var generateReferenceResolverFinder = function (defs) {
    if (defs === void 0) { defs = exports.fieldNameToTypeMappingDefs; }
    var referenceDefinitions = defs.map(function (def) { return FieldReferenceResolver.create(def); });
    var matchersByFieldName = lodash_1["default"](referenceDefinitions)
        .filter(function (def) { return lodash_1["default"].isString(def.src.field); })
        .groupBy(function (def) { return def.src.field; })
        .value();
    var regexFieldMatchersByParent = lodash_1["default"](referenceDefinitions)
        .filter(function (def) { return lodash_1["default"].isRegExp(def.src.field); })
        .flatMap(function (def) { return def.src.parentTypes.map(function (parentType) { return ({ parentType: parentType, def: def }); }); })
        .groupBy(function (_a) {
        var parentType = _a.parentType;
        return parentType;
    })
        .mapValues(function (items) { return items.map(function (item) { return item.def; }); })
        .value();
    return (function (field, element) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _a = awu;
                    _b = [((_d = matchersByFieldName[field.name]) !== null && _d !== void 0 ? _d : [])];
                    _c = regexFieldMatchersByParent;
                    return [4 /*yield*/, transformer_1.apiName(field.parent)];
                case 1: return [2 /*return*/, _a.apply(void 0, [__spreadArrays.apply(void 0, _b.concat([(_c[_e.sent()] || [])]))]).filter(function (resolver) { return resolver.match(field, element); }).toArray()];
            }
        });
    }); });
};
exports.generateReferenceResolverFinder = generateReferenceResolverFinder;
var getLookUpNameImpl = function (defs) {
    if (defs === void 0) { defs = exports.fieldNameToTypeMappingDefs; }
    var resolverFinder = exports.generateReferenceResolverFinder(defs);
    var determineLookupStrategy = function (args) { return __awaiter(void 0, void 0, void 0, function () {
        var strategies;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (args.field === undefined) {
                        log.debug('could not determine field for path %s', (_a = args.path) === null || _a === void 0 ? void 0 : _a.getFullName());
                        return [2 /*return*/, undefined];
                    }
                    return [4 /*yield*/, resolverFinder(args.field, args.element)];
                case 1:
                    strategies = (_b.sent())
                        .map(function (def) { return def.serializationStrategy; });
                    if (strategies.length === 0) {
                        log.debug('could not find matching strategy for field %s', args.field.elemID.getFullName());
                        return [2 /*return*/, undefined];
                    }
                    if (strategies.length > 1) {
                        log.debug('found %d matching strategies for field %s - using the first one', strategies.length, args.field.elemID.getFullName());
                    }
                    return [2 /*return*/, strategies[0]];
            }
        });
    }); };
    return function (_a) {
        var ref = _a.ref, path = _a.path, field = _a.field, element = _a.element;
        return __awaiter(void 0, void 0, void 0, function () {
            var isInstanceAnnotation, strategy, defaultStrategy;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        isInstanceAnnotation = (path === null || path === void 0 ? void 0 : path.idType) === 'instance' && path.isAttrID();
                        if (!!isInstanceAnnotation) return [3 /*break*/, 2];
                        return [4 /*yield*/, determineLookupStrategy({ ref: ref, path: path, field: field, element: element })];
                    case 1:
                        strategy = _b.sent();
                        if (strategy !== undefined) {
                            return [2 /*return*/, strategy.serialize({ ref: ref, field: field, element: element })];
                        }
                        if (adapter_api_1.isElement(ref.value)) {
                            defaultStrategy = ReferenceSerializationStrategyLookup.absoluteApiName;
                            return [2 /*return*/, defaultStrategy.serialize({ ref: ref, element: element })];
                        }
                        _b.label = 2;
                    case 2: return [2 /*return*/, ref.value];
                }
            });
        });
    };
};
/**
 * Translate a reference expression back to its original value before deploy.
 */
exports.getLookUpName = getLookUpNameImpl();
