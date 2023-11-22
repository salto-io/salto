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
exports.__esModule = true;
exports.mockJsforce = exports.mockSObjectDescribe = exports.mockSObjectDescribeGlobal = exports.mockSObjectField = exports.mockQueryResult = exports.mockDeployResult = exports.mockDeployResultComplete = exports.mockRunTestResult = exports.mockRunTestFailure = exports.mockDeployMessage = exports.mockRetrieveLocator = exports.mockRetrieveResult = exports.mockFileProperties = exports.mockDescribeValueResult = exports.mockValueTypeField = exports.mockDescribeResult = exports.MOCK_INSTANCE_URL = void 0;
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
var test_utils_1 = require("@salto-io/test-utils");
var utils_1 = require("./utils");
exports.MOCK_INSTANCE_URL = 'https://url.com/';
var mockDescribeResult = function (objects, organizationNamespace) {
    if (organizationNamespace === void 0) { organizationNamespace = ''; }
    return ({
        metadataObjects: objects.map(function (props) { return (__assign({ childXmlNames: [], directoryName: lodash_1["default"].lowerCase(props.xmlName), inFolder: false, metaFile: false, suffix: '.file' }, props)); }),
        organizationNamespace: organizationNamespace,
        testRequired: false,
        partialSaveAllowed: true,
    });
};
exports.mockDescribeResult = mockDescribeResult;
var mockValueTypeField = function (props) {
    var _a, _b;
    return (__assign(__assign({ foreignKeyDomain: (_a = props.foreignKeyDomain) !== null && _a !== void 0 ? _a : '', isForeignKey: (_b = props.isForeignKey) !== null && _b !== void 0 ? _b : false, isNameField: false, minOccurs: 0, picklistValues: [], valueRequired: false }, props), { fields: props.fields === undefined ? [] : props.fields.map(exports.mockValueTypeField) }));
};
exports.mockValueTypeField = mockValueTypeField;
var mockDescribeValueResult = function (props) { return (__assign(__assign({ apiCreatable: true, apiDeletable: true, apiReadable: true, apiUpdatable: true }, props), { parentField: props.parentField === undefined
        ? undefined // The type says this is required but it isn't really
        : exports.mockValueTypeField(props.parentField), valueTypeFields: props.valueTypeFields.map(exports.mockValueTypeField) })); };
exports.mockDescribeValueResult = mockDescribeValueResult;
var mockFileProperties = function (props) { return (__assign({ createdById: '0054J000002KGspQAG', createdByName: 'test', createdDate: '2020-05-01T14:31:36.000Z', fileName: lodash_1["default"].camelCase(props.type) + "/" + props.fullName + "." + lodash_1["default"].snakeCase(props.type), id: lodash_1["default"].uniqueId(), lastModifiedById: '0054J000002KGspQAG', lastModifiedByName: 'test', lastModifiedDate: '2020-05-01T14:41:36.000Z', manageableState: 'unmanaged' }, props)); };
exports.mockFileProperties = mockFileProperties;
var mockRetrieveResult = function (props) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = { fileProperties: [], id: lodash_1["default"].uniqueId(), messages: [] };
                return [4 /*yield*/, utils_1.createEncodedZipContent((_b = props.zipFiles) !== null && _b !== void 0 ? _b : [])];
            case 1: return [2 /*return*/, (__assign.apply(void 0, [(_a.zipFile = _c.sent(), _a), props]))];
        }
    });
}); };
exports.mockRetrieveResult = mockRetrieveResult;
var mockRetrieveLocator = function (props) { return ({
    complete: function () { return (props instanceof Promise ? props : exports.mockRetrieveResult(props)); },
}); };
exports.mockRetrieveLocator = mockRetrieveLocator;
var mockDeployMessage = function (params) { return (__assign({ changed: false, columnNumber: 0, componentType: '', created: false, createdDate: '', deleted: false, fileName: '', fullName: '', id: '', lineNumber: 0, problem: '', problemType: '', success: false }, params)); };
exports.mockDeployMessage = mockDeployMessage;
var mockRunTestFailure = function (params) { return (__assign({ id: lodash_1["default"].uniqueId(), message: 'message', methodName: 'methodName', name: 'name', stackTrace: 'stackTrace', time: 1 }, params)); };
exports.mockRunTestFailure = mockRunTestFailure;
var mockRunTestResult = function (params) { return (params === undefined ? undefined : __assign(__assign({ numFailures: lowerdash_1.collections.array.makeArray(params.failures).length, numTestsRun: lowerdash_1.collections.array.makeArray(params.failures).length, totalTime: 10 }, params), { failures: lowerdash_1.collections.array.makeArray(params.failures).map(exports.mockRunTestFailure) })); };
exports.mockRunTestResult = mockRunTestResult;
var mockDeployResultComplete = function (_a) {
    var _b = _a.id, id = _b === void 0 ? lodash_1["default"].uniqueId() : _b, _c = _a.success, success = _c === void 0 ? true : _c, errorMessage = _a.errorMessage, _d = _a.componentSuccess, componentSuccess = _d === void 0 ? [] : _d, _e = _a.componentFailure, componentFailure = _e === void 0 ? [] : _e, _f = _a.runTestResult, runTestResult = _f === void 0 ? undefined : _f, _g = _a.ignoreWarnings, ignoreWarnings = _g === void 0 ? true : _g, _h = _a.rollbackOnError, rollbackOnError = _h === void 0 ? true : _h, _j = _a.checkOnly, checkOnly = _j === void 0 ? false : _j, _k = _a.testCompleted, testCompleted = _k === void 0 ? 0 : _k, _l = _a.testErrors, testErrors = _l === void 0 ? 0 : _l;
    return ({
        id: id,
        checkOnly: checkOnly,
        completedDate: '2020-05-01T14:31:36.000Z',
        createdDate: '2020-05-01T14:21:36.000Z',
        done: true,
        details: [{
                componentFailures: componentFailure.map(exports.mockDeployMessage),
                componentSuccesses: componentSuccess.map(exports.mockDeployMessage),
                runTestResult: exports.mockRunTestResult(runTestResult),
            }],
        ignoreWarnings: ignoreWarnings,
        lastModifiedDate: '2020-05-01T14:31:36.000Z',
        numberComponentErrors: componentFailure.length,
        numberComponentsDeployed: componentSuccess.length,
        numberComponentsTotal: componentFailure.length + componentSuccess.length,
        numberTestErrors: testErrors,
        numberTestsCompleted: testCompleted,
        numberTestsTotal: testCompleted + testErrors,
        rollbackOnError: rollbackOnError,
        startDate: '2020-05-01T14:21:36.000Z',
        status: success ? 'Succeeded' : 'Failed',
        success: success,
        errorMessage: errorMessage,
    });
};
exports.mockDeployResultComplete = mockDeployResultComplete;
var mockDeployResult = function (params) { return ({
    complete: jest.fn().mockResolvedValue(exports.mockDeployResultComplete(params)),
}); };
exports.mockDeployResult = mockDeployResult;
var mockQueryResult = function (props) { return (__assign({ done: true, totalSize: 0, records: [] }, props)); };
exports.mockQueryResult = mockQueryResult;
var mockIdentity = function (organizationId) { return ({
    id: '',
    // eslint-disable-next-line camelcase
    asserted_user: false,
    // eslint-disable-next-line camelcase
    user_id: '',
    // eslint-disable-next-line camelcase
    organization_id: organizationId,
    username: '',
    // eslint-disable-next-line camelcase
    nick_name: '',
    // eslint-disable-next-line camelcase
    display_name: '',
    email: '',
    // eslint-disable-next-line camelcase
    email_verified: false,
    // eslint-disable-next-line camelcase
    first_name: '',
    // eslint-disable-next-line camelcase
    last_name: '',
    timezone: '',
    photos: {
        picture: '',
        thumbnail: '',
    },
    // eslint-disable-next-line camelcase
    addr_street: '',
    // eslint-disable-next-line camelcase
    addr_city: '',
    // eslint-disable-next-line camelcase
    addr_state: '',
    // eslint-disable-next-line camelcase
    addr_country: '',
    // eslint-disable-next-line camelcase
    addr_zip: '',
    // eslint-disable-next-line camelcase
    mobile_phone: '',
    // eslint-disable-next-line camelcase
    mobile_phone_verified: false,
    // eslint-disable-next-line camelcase
    is_lightning_login_user: false,
    status: {
        // eslint-disable-next-line camelcase
        created_date: null,
        body: '',
    },
    urls: {
        enterprise: '',
        metadata: '',
        partner: '',
        rest: '',
        sobjects: '',
        search: '',
        query: '',
        recent: '',
        // eslint-disable-next-line camelcase
        tooling_soap: '',
        // eslint-disable-next-line camelcase
        tooling_rest: '',
        profile: '',
        feeds: '',
        groups: '',
        users: '',
        // eslint-disable-next-line camelcase
        feed_items: '',
        // eslint-disable-next-line camelcase
        feed_elements: '',
        // eslint-disable-next-line camelcase
        custom_domain: '',
    },
    active: false,
    // eslint-disable-next-line camelcase
    user_type: '',
    language: '',
    locale: '',
    utcOffset: 0,
    // eslint-disable-next-line camelcase
    last_modified_date: new Date(),
    // eslint-disable-next-line camelcase
    is_app_installed: false,
}); };
var mockSObjectField = function (overrides) { return (__assign({ aggregatable: false, autoNumber: false, byteLength: 0, calculated: false, cascadeDelete: false, caseSensitive: false, createable: false, custom: false, defaultedOnCreate: false, dependentPicklist: false, deprecatedAndHidden: false, externalId: false, filterable: false, groupable: false, htmlFormatted: false, idLookup: false, label: 'label', length: 0, name: 'name', nameField: false, namePointing: false, nillable: false, permissionable: false, polymorphicForeignKey: false, queryByDistance: false, restrictedPicklist: false, scale: 0, searchPrefilterable: false, soapType: 'xsd:string', sortable: false, type: 'string', unique: false, updateable: false }, overrides)); };
exports.mockSObjectField = mockSObjectField;
var mockSObjectDescribeGlobal = function (overrides) { return (__assign({ activateable: false, createable: false, custom: true, customSetting: false, deletable: false, deprecatedAndHidden: false, feedEnabled: false, hasSubtypes: false, isSubtype: false, keyPrefix: '0AE', label: 'obj', labelPlural: 'objs', layoutable: false, mergeable: false, mruEnabled: false, name: 'obj__c', queryable: false, replicateable: false, retrieveable: false, searchable: false, triggerable: false, undeletable: false, updateable: false, urls: {} }, overrides)); };
exports.mockSObjectDescribeGlobal = mockSObjectDescribeGlobal;
var mockSObjectDescribe = function (overrides) {
    var _a, _b;
    return (__assign(__assign({ activateable: false, childRelationships: [], compactLayoutable: false, createable: false, custom: false, customSetting: false, deletable: false, deprecatedAndHidden: false, feedEnabled: false, label: 'obj', labelPlural: 'objs', layoutable: false, mergeable: false, mruEnabled: false, name: 'obj__c', namedLayoutInfos: [], queryable: false, recordTypeInfos: [], replicateable: false, retrieveable: false, searchable: false, searchLayoutable: false, supportedScopes: [], triggerable: false, undeletable: false, updateable: false, urls: {} }, overrides), { fields: (_b = (_a = overrides.fields) === null || _a === void 0 ? void 0 : _a.map(exports.mockSObjectField)) !== null && _b !== void 0 ? _b : [] }));
};
exports.mockSObjectDescribe = mockSObjectDescribe;
var mockJsforce = function () { return ({
    login: test_utils_1.mockFunction().mockImplementation(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, ({ id: '', organizationId: '', url: '' })];
        });
    }); }),
    metadata: {
        pollInterval: 1000,
        pollTimeout: 10000,
        describe: test_utils_1.mockFunction().mockResolvedValue({ metadataObjects: [], organizationNamespace: '' }),
        describeValueType: test_utils_1.mockFunction().mockResolvedValue(exports.mockDescribeValueResult({ valueTypeFields: [] })),
        read: test_utils_1.mockFunction().mockResolvedValue([]),
        list: test_utils_1.mockFunction().mockResolvedValue([]),
        upsert: test_utils_1.mockFunction().mockResolvedValue([]),
        "delete": test_utils_1.mockFunction().mockResolvedValue([]),
        update: test_utils_1.mockFunction().mockResolvedValue([]),
        retrieve: test_utils_1.mockFunction().mockReturnValue(exports.mockRetrieveLocator({})),
        deploy: test_utils_1.mockFunction().mockReturnValue(exports.mockDeployResult({})),
        deployRecentValidation: test_utils_1.mockFunction().mockReturnValue(exports.mockDeployResult({})),
    },
    soap: {
        describeSObjects: test_utils_1.mockFunction().mockResolvedValue([]),
    },
    describeGlobal: test_utils_1.mockFunction().mockResolvedValue({ sobjects: [] }),
    query: test_utils_1.mockFunction().mockResolvedValue(exports.mockQueryResult({})),
    queryMore: test_utils_1.mockFunction().mockResolvedValue(exports.mockQueryResult({})),
    bulk: {
        pollInterval: 1000,
        pollTimeout: 10000,
        load: test_utils_1.mockFunction().mockResolvedValue([]),
    },
    limits: test_utils_1.mockFunction().mockResolvedValue({
        DailyApiRequests: { Remaining: 10000 },
    }),
    tooling: {
        query: test_utils_1.mockFunction().mockResolvedValue(exports.mockQueryResult({})),
        queryMore: test_utils_1.mockFunction().mockResolvedValue(exports.mockQueryResult({})),
    },
    identity: test_utils_1.mockFunction().mockImplementation(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, mockIdentity('')];
    }); }); }),
    instanceUrl: exports.MOCK_INSTANCE_URL,
}); };
exports.mockJsforce = mockJsforce;
