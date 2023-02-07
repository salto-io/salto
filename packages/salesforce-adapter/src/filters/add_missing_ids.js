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
exports.WARNING_MESSAGE = exports.getIdsForType = void 0;
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
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var log = logging_1.logger(module);
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, groupByAsync = _a.groupByAsync;
var getIdsForType = function (client, type) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, result, errors;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, client.listMetadataObjects({ type: type })];
            case 1:
                _a = _b.sent(), result = _a.result, errors = _a.errors;
                if (errors && errors.length > 0) {
                    log.debug("Encountered errors while listing " + type + ": " + errors);
                }
                return [2 /*return*/, Object.fromEntries(result
                        .filter(function (info) { return info.id !== undefined && info.id !== ''; })
                        .map(function (info) { return [utils_1.getFullName(info), info.id]; }))];
        }
    });
}); };
exports.getIdsForType = getIdsForType;
/**
 * Try to add internal ids for the remaining types using listMetadataObjects.
 *
 * @param client          The salesforce client to use for the query
 * @param elementsByType  Elements missing internal ids, grouped by type
 */
var addMissingIds = function (client, typeName, elements) { return __awaiter(void 0, void 0, void 0, function () {
    var allIds;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.getIdsForType(client, typeName)];
            case 1:
                allIds = _a.sent();
                return [4 /*yield*/, awu(elements).forEach(function (element) { return __awaiter(void 0, void 0, void 0, function () {
                        var id, _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _a = allIds;
                                    return [4 /*yield*/, transformer_1.apiName(element)];
                                case 1:
                                    id = _a[_b.sent()];
                                    if (id !== undefined) {
                                        utils_1.setInternalId(element, id);
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var elementsWithMissingIds = function (elements) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (awu(elements)
                .flatMap(function (e) { return (adapter_api_1.isObjectType(e) ? Object.values(e.fields) : [e]); })
                .filter(function (e) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = adapter_api_1.isInstanceElement(e);
                        if (!_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, e.getType()];
                    case 1:
                        _a = !(_b.sent()).isSettings;
                        _b.label = 2;
                    case 2: return [2 /*return*/, (_a) || adapter_api_1.isField(e)];
                }
            }); }); })
                .filter(function (e) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, transformer_1.apiName(e)];
                    case 1: return [2 /*return*/, (_a.sent()) !== undefined && utils_1.getInternalId(e) === undefined];
                }
            }); }); })
                .toArray())];
    });
}); };
exports.WARNING_MESSAGE = 'Encountered an error while trying populate internal IDs for some of your salesforce configuration elements. This might result in some missing configuration dependencies in your workspace and/or affect the availability of the ‘go to service’ functionality.';
/**
 * Add missing env-specific ids using listMetadataObjects.
 */
var filter = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: exports.WARNING_MESSAGE,
            config: config,
            filterName: 'addMissingIds',
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var groupedElements, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = groupByAsync;
                            return [4 /*yield*/, elementsWithMissingIds(elements)];
                        case 1: return [4 /*yield*/, _a.apply(void 0, [_b.sent(), transformer_1.metadataType])];
                        case 2:
                            groupedElements = _b.sent();
                            log.debug("Getting missing ids for the following types: " + Object.keys(groupedElements));
                            return [4 /*yield*/, Promise.all(Object.entries(groupedElements)
                                    .map(function (_a) {
                                    var typeName = _a[0], typeElements = _a[1];
                                    return addMissingIds(client, typeName, typeElements);
                                }))];
                        case 3:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filter;
