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
exports.WARNING_MESSAGE = void 0;
var lodash_1 = require("lodash");
var adapter_api_1 = require("@salto-io/adapter-api");
var logging_1 = require("@salto-io/logging");
var utils_1 = require("./utils");
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var log = logging_1.logger(module);
var ORGANIZATION_SETTINGS_INSTANCE_NAME = 'OrganizationSettings';
/*
* These fields are not multienv friendly
* */
var FIELDS_TO_IGNORE = [
    'DailyWebToCaseCount',
    'DailyWebToLeadCount',
    'InstanceName',
    'IsSandbox',
    'LastWebToCaseDate',
    'LastWebToLeadDate',
    'MonthlyPageViewsEntitlement',
    'MonthlyPageViewsUsed',
    'OrganizationType',
    'SelfServiceCaseSubmitRecordTypeId',
    'SelfServiceEmailUserOnCaseCreation‍TemplateId',
    'SelfServiceNewCommentTemplateId',
    'SelfServiceNewPassTemplateId',
    'SelfServiceNewUserTemplateId',
    'SelfServiceSolutionCategoryStartNodeId',
    'TrialExpirationDate',
    'WebToCaseAssignedEmailTemplateId',
    'WebToCaseCreatedEmailTemplateId',
    'WebToCaseDefaultCreatorId',
];
var enrichTypeWithFields = function (client, type, fieldsToIgnore) { return __awaiter(void 0, void 0, void 0, function () {
    var typeApiName, describeSObjectsResult, typeDescription, _a, topLevelFields, nestedFields, objCompoundFieldNames, fields;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, transformer_1.apiName(type)];
            case 1:
                typeApiName = _b.sent();
                return [4 /*yield*/, client.describeSObjects([typeApiName])];
            case 2:
                describeSObjectsResult = _b.sent();
                if (describeSObjectsResult.errors.length !== 0 || describeSObjectsResult.result.length !== 1) {
                    log.warn('describeSObject on %o failed with errors: %o and %o results', typeApiName, describeSObjectsResult.errors, describeSObjectsResult.result.length);
                    return [2 /*return*/];
                }
                typeDescription = describeSObjectsResult.result[0];
                _a = lodash_1["default"].partition(typeDescription.fields, function (field) { return lodash_1["default"].isNil(field.compoundFieldName); }), topLevelFields = _a[0], nestedFields = _a[1];
                objCompoundFieldNames = lodash_1["default"].mapValues(lodash_1["default"].groupBy(nestedFields, function (field) { return field.compoundFieldName; }), function (_nestedFields, compoundName) { return compoundName; });
                fields = topLevelFields
                    .map(function (field) {
                    var _a;
                    return transformer_1.getSObjectFieldElement(type, field, (_a = {}, _a[constants_1.API_NAME] = typeApiName, _a), objCompoundFieldNames);
                });
                type.fields = __assign(__assign({}, type.fields), lodash_1["default"](fields)
                    .filter(function (field) { return !fieldsToIgnore.has(field.name); })
                    .keyBy(function (field) { return field.name; })
                    .value());
                return [2 /*return*/];
        }
    });
}); };
var createOrganizationType = function () {
    var _a;
    return (new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.ORGANIZATION_SETTINGS),
        fields: {},
        annotations: (_a = {},
            _a[adapter_api_1.CORE_ANNOTATIONS.UPDATABLE] = false,
            _a[adapter_api_1.CORE_ANNOTATIONS.CREATABLE] = false,
            _a[adapter_api_1.CORE_ANNOTATIONS.DELETABLE] = false,
            _a[constants_1.API_NAME] = constants_1.ORGANIZATION_SETTINGS,
            _a),
        isSettings: true,
        path: transformer_1.getTypePath(constants_1.ORGANIZATION_SETTINGS),
    }));
};
var createOrganizationInstance = function (objectType, fieldValues) { return (new adapter_api_1.InstanceElement(adapter_api_1.ElemID.CONFIG_NAME, objectType, lodash_1["default"].pick(fieldValues, Object.keys(objectType.fields)), [constants_1.SALESFORCE, constants_1.RECORDS_PATH, constants_1.SETTINGS_PATH, ORGANIZATION_SETTINGS_INSTANCE_NAME])); };
var FILTER_NAME = 'organizationWideSharingDefaults';
exports.WARNING_MESSAGE = 'Failed to fetch OrganizationSettings.';
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        name: FILTER_NAME,
        remote: true,
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: exports.WARNING_MESSAGE,
            config: config,
            filterName: FILTER_NAME,
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var objectType, fieldsToIgnore, queryResult, organizationInstance;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            // SALTO-4821
                            if (config.fetchProfile.metadataQuery.isFetchWithChangesDetection()) {
                                return [2 /*return*/];
                            }
                            objectType = createOrganizationType();
                            fieldsToIgnore = new Set(FIELDS_TO_IGNORE.concat((_a = config.systemFields) !== null && _a !== void 0 ? _a : []));
                            return [4 /*yield*/, enrichTypeWithFields(client, objectType, fieldsToIgnore)];
                        case 1:
                            _b.sent();
                            return [4 /*yield*/, utils_1.queryClient(client, ['SELECT FIELDS(ALL) FROM Organization LIMIT 200'])];
                        case 2:
                            queryResult = _b.sent();
                            if (queryResult.length !== 1) {
                                log.error("Expected Organization object to be a singleton. Got " + queryResult.length + " elements");
                                return [2 /*return*/];
                            }
                            organizationInstance = createOrganizationInstance(objectType, queryResult[0]);
                            elements.push(objectType, organizationInstance);
                            return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filterCreator;
