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
exports.WARNING_MESSAGE = void 0;
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
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../../transformers/transformer");
var utils_1 = require("../utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var GET_ID_AND_NAMES_OF_USERS_QUERY = 'SELECT Id,Name FROM User';
var getIDToNameMap = function (client, instances) { return __awaiter(void 0, void 0, void 0, function () {
    var instancesIDs, queries, records;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                instancesIDs = Array.from(new Set(instances.flatMap(function (instance) { return [instance.value.CreatedById, instance.value.LastModifiedById]; })));
                queries = utils_1.conditionQueries(GET_ID_AND_NAMES_OF_USERS_QUERY, instancesIDs.map(function (id) { return ({ Id: "'" + id + "'" }); }));
                return [4 /*yield*/, utils_1.queryClient(client, queries)];
            case 1:
                records = _a.sent();
                return [2 /*return*/, Object.fromEntries(records.map(function (record) { return [record.Id, record.Name]; }))];
        }
    });
}); };
var moveAuthorFieldsToAnnotations = function (instance, IDToNameMap) {
    instance.annotations[adapter_api_1.CORE_ANNOTATIONS.CREATED_AT] = instance.value.CreatedDate;
    instance.annotations[adapter_api_1.CORE_ANNOTATIONS.CREATED_BY] = IDToNameMap[instance.value.CreatedById];
    instance.annotations[adapter_api_1.CORE_ANNOTATIONS.CHANGED_AT] = instance.value.LastModifiedDate;
    instance.annotations[adapter_api_1.CORE_ANNOTATIONS.CHANGED_BY] = IDToNameMap[instance.value.LastModifiedById];
};
var moveInstancesAuthorFieldsToAnnotations = function (instances, IDToNameMap) {
    instances.forEach(function (instance) { return moveAuthorFieldsToAnnotations(instance, IDToNameMap); });
};
exports.WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.';
/*
 * add author information to data instance elements.
 */
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: exports.WARNING_MESSAGE,
            config: config,
            filterName: 'authorInformation',
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var customObjectInstances, IDToNameMap;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, awu(elements).filter(transformer_1.isInstanceOfCustomObject)
                                .toArray()];
                        case 1:
                            customObjectInstances = _a.sent();
                            return [4 /*yield*/, getIDToNameMap(client, customObjectInstances)];
                        case 2:
                            IDToNameMap = _a.sent();
                            moveInstancesAuthorFieldsToAnnotations(customObjectInstances, IDToNameMap);
                            return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filterCreator;
