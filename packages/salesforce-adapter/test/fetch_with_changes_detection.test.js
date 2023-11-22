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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var adapter_1 = require("./adapter");
var metadata_types_1 = require("../src/fetch_profile/metadata_types");
var constants_1 = require("../src/constants");
var mock_elements_1 = require("./mock_elements");
var connection_1 = require("./connection");
var utils_1 = require("./utils");
var transformer_1 = require("../src/transformers/transformer");
var makeArray = lowerdash_1.collections.array.makeArray;
describe('Salesforce Fetch With Changes Detection', function () {
    var connection;
    var adapter;
    var changedAtSingleton;
    beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        var sourceElements, elementsSource;
        var _a;
        return __generator(this, function (_b) {
            changedAtSingleton = mock_elements_1.mockInstances()[constants_1.CHANGED_AT_SINGLETON];
            sourceElements = __spreadArrays(Object.values(mock_elements_1.mockTypes), transformer_1.Types.getAllMissingTypes(), [
                changedAtSingleton,
            ]);
            elementsSource = adapter_utils_1.buildElementsSourceFromElements(sourceElements);
            (_a = adapter_1["default"]({
                adapterParams: {
                    config: {
                        fetch: {
                            metadata: {
                                include: [
                                    {
                                        metadataType: '.*',
                                    },
                                ],
                            },
                        },
                    },
                    elementsSource: elementsSource,
                },
            }), connection = _a.connection, adapter = _a.adapter);
            return [2 /*return*/];
        });
    }); });
    describe('fetch with changes detection for CustomObjects', function () {
        var RELATED_TYPES = __spreadArrays(metadata_types_1.CUSTOM_OBJECT_FIELDS, [constants_1.CUSTOM_FIELD, constants_1.CUSTOM_OBJECT]);
        var UPDATED_OBJECT_NAME = 'Updated__c';
        var NON_UPDATED_OBJECT_NAME = 'NonUpdated__c';
        var retrieveRequest;
        beforeEach(function () {
            var _a;
            var filePropByRelatedType = {
                BusinessProcess: [
                    // Latest related property for Updated__c
                    connection_1.mockFileProperties({
                        fullName: UPDATED_OBJECT_NAME + ".TestBusinessProcess",
                        type: 'BusinessProcess',
                        lastModifiedDate: '2023-11-07T00:00:00.000Z',
                    }),
                    connection_1.mockFileProperties({
                        fullName: NON_UPDATED_OBJECT_NAME + ".TestBusinessProcess",
                        type: 'BusinessProcess',
                        lastModifiedDate: '2023-10-01T00:00:00.000Z',
                    }),
                ],
                CompactLayout: [
                    connection_1.mockFileProperties({
                        fullName: UPDATED_OBJECT_NAME + ".TestCompactLayout",
                        type: 'CompactLayout',
                        lastModifiedDate: '2023-11-05T00:00:00.000Z',
                    }),
                    connection_1.mockFileProperties({
                        fullName: NON_UPDATED_OBJECT_NAME + ".TestCompactLayout",
                        type: 'CompactLayout',
                        lastModifiedDate: '2023-10-03T00:00:00.000Z',
                    }),
                ],
                CustomField: [
                    connection_1.mockFileProperties({
                        fullName: UPDATED_OBJECT_NAME + ".TestField__c",
                        type: constants_1.CUSTOM_FIELD,
                        lastModifiedDate: '2023-11-02T00:00:00.000Z',
                    }),
                    connection_1.mockFileProperties({
                        fullName: NON_UPDATED_OBJECT_NAME + ".TestField__c",
                        type: constants_1.CUSTOM_FIELD,
                        lastModifiedDate: '2023-11-01T00:00:00.000Z',
                    }),
                ],
                CustomObject: [
                    connection_1.mockFileProperties({
                        fullName: UPDATED_OBJECT_NAME,
                        type: constants_1.CUSTOM_OBJECT,
                        lastModifiedDate: '2023-11-01T00:00:00.000Z',
                    }),
                    connection_1.mockFileProperties({
                        fullName: NON_UPDATED_OBJECT_NAME,
                        type: constants_1.CUSTOM_OBJECT,
                        lastModifiedDate: '2023-11-01T00:00:00.000Z',
                    }),
                ],
                FieldSet: [],
                Index: [],
                ListView: [
                    connection_1.mockFileProperties({
                        fullName: UPDATED_OBJECT_NAME + ".TestListView",
                        type: 'ListView',
                        lastModifiedDate: '2023-11-06T00:00:00.000Z',
                    }),
                    // Latest related property for NonUpdated__c
                    connection_1.mockFileProperties({
                        fullName: NON_UPDATED_OBJECT_NAME + ".TestListView",
                        type: 'ListView',
                        lastModifiedDate: '2023-11-02T00:00:00.000Z',
                    }),
                ],
                RecordType: [],
                SharingReason: [],
                ValidationRule: [],
                WebLink: [],
            };
            connection.metadata.describe.mockResolvedValue(connection_1.mockDescribeResult(RELATED_TYPES.map(function (type) { return ({ xmlName: type }); })));
            connection.metadata.list.mockImplementation(function (queries) { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, (makeArray(queries).flatMap(function (_a) {
                            var _b;
                            var type = _a.type;
                            return (_b = filePropByRelatedType[type]) !== null && _b !== void 0 ? _b : [];
                        }))];
                });
            }); });
            connection.metadata.retrieve.mockImplementation(function (request) {
                retrieveRequest = request;
                return connection_1.mockRetrieveLocator(connection_1.mockRetrieveResult({ zipFiles: [] }));
            });
            changedAtSingleton.value[constants_1.CUSTOM_OBJECT] = (_a = {},
                _a[UPDATED_OBJECT_NAME] = '2023-11-06T00:00:00.000Z',
                _a[NON_UPDATED_OBJECT_NAME] = '2023-11-02T00:00:00.000Z',
                _a);
        });
        it('should fetch only the updated CustomObject instances', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, adapter.fetch(__assign(__assign({}, utils_1.mockFetchOpts), { withChangesDetection: true }))];
                    case 1:
                        _b.sent();
                        expect((_a = retrieveRequest.unpackaged) === null || _a === void 0 ? void 0 : _a.types).toIncludeSameMembers([{
                                name: constants_1.CUSTOM_OBJECT,
                                members: [UPDATED_OBJECT_NAME],
                            }]);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
