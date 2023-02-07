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
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lodash_1 = require("lodash");
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../transformers/transformer");
var reference_mapping_1 = require("../transformers/reference_mapping");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
/*
The keys represent metadataTypes of the instances to change.
The values represent api names of other instances, that the first instances' fields refer to.
*/
var metadataTypeToInstanceName = {
    ForecastingSettings: 'Opportunity',
};
var fieldSelectMapping = [
    { src: { field: 'field', parentTypes: ['OpportunityListFieldsSelectedSettings', 'OpportunityListFieldsUnselectedSettings', 'OpportunityListFieldsLabelMapping'] } },
];
/*
 * converts an 18-char internalId to a 15-char internalId.
 */
var toShortId = function (longId) { return (longId.slice(0, -3)); };
var getRelevantFieldMapping = function (_a) {
    var elementsSource = _a.elementsSource, key = _a.key, value = _a.value;
    return __awaiter(void 0, void 0, void 0, function () {
        var isReferencedCustomObject, _b, _c, _d;
        var _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    isReferencedCustomObject = function (elem) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b, _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0: return [4 /*yield*/, transformer_1.isCustomObject(elem)];
                                case 1:
                                    _a = (_d.sent());
                                    if (!_a) return [3 /*break*/, 3];
                                    _c = (_b = Object.values(metadataTypeToInstanceName)).includes;
                                    return [4 /*yield*/, transformer_1.apiName(elem)];
                                case 2:
                                    _a = _c.apply(_b, [_d.sent()]);
                                    _d.label = 3;
                                case 3: return [2 /*return*/, (_a)];
                            }
                        });
                    }); };
                    _c = (_b = lowerdash_1.multiIndex).keyByAsync;
                    _e = {};
                    _d = awu;
                    return [4 /*yield*/, elementsSource.getAll()];
                case 1: return [2 /*return*/, _c.apply(_b, [(_e.iter = _d.apply(void 0, [_f.sent()])
                            .filter(adapter_api_1.isObjectType)
                            .filter(isReferencedCustomObject)
                            .flatMap(function (obj) { return Object.values(obj.fields); }),
                            _e.filter = utils_1.hasInternalId,
                            _e.key = key,
                            _e.map = value,
                            _e)])];
            }
        });
    });
};
var shouldReplace = function (field, instance) { return __awaiter(void 0, void 0, void 0, function () {
    var resolverFinder;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                resolverFinder = reference_mapping_1.generateReferenceResolverFinder(fieldSelectMapping);
                return [4 /*yield*/, resolverFinder(field, instance)];
            case 1: return [2 /*return*/, (_a.sent()).length > 0];
        }
    });
}); };
var replaceInstanceValues = function (instance, nameLookup) { return __awaiter(void 0, void 0, void 0, function () {
    var transformFunc, values, _a, _b;
    var _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                transformFunc = function (_a) {
                    var value = _a.value, field = _a.field;
                    return __awaiter(void 0, void 0, void 0, function () {
                        var _b;
                        var _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _b = lodash_1["default"].isUndefined(field);
                                    if (_b) return [3 /*break*/, 2];
                                    return [4 /*yield*/, shouldReplace(field, instance)];
                                case 1:
                                    _b = !(_d.sent());
                                    _d.label = 2;
                                case 2:
                                    if (_b) {
                                        return [2 /*return*/, value];
                                    }
                                    // if we can't find an item in the lookup it's because
                                    // it's a standard field that doesn't need translation
                                    return [2 /*return*/, lodash_1["default"].isArray(value)
                                            ? value.map(function (s) { var _a; return (_a = nameLookup.get(s)) !== null && _a !== void 0 ? _a : s; })
                                            : ((_c = nameLookup.get(value)) !== null && _c !== void 0 ? _c : value)];
                            }
                        });
                    });
                };
                values = instance.value;
                _a = instance;
                _b = adapter_utils_1.transformValues;
                _c = {
                    values: values
                };
                return [4 /*yield*/, instance.getType()];
            case 1: return [4 /*yield*/, _b.apply(void 0, [(_c.type = _e.sent(),
                        _c.transformFunc = transformFunc,
                        _c.strict = false,
                        _c.allowEmpty = true,
                        _c)])];
            case 2:
                _a.value = (_d = _e.sent()) !== null && _d !== void 0 ? _d : values;
                return [2 /*return*/];
        }
    });
}); };
var replaceInstancesValues = function (elements, nameLookUp) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(elements)
                    .filter(adapter_api_1.isInstanceElement)
                    .filter(function (e) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _b = (_a = Object.keys(metadataTypeToInstanceName)).includes;
                            return [4 /*yield*/, transformer_1.metadataType(e)];
                        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                    }
                }); }); })
                    .forEach(function (e) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, _b, _c;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0: return [4 /*yield*/, replaceInstanceValues(e, nameLookUp)];
                            case 1:
                                _d.sent();
                                _b = (_a = log).debug;
                                _c = "replaced values of instance ";
                                return [4 /*yield*/, transformer_1.apiName(e)];
                            case 2:
                                _b.apply(_a, [_c + (_d.sent())]);
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
/**
 * Replace specific field values that are fetched as ids, to their names.
 */
var filter = function (_a) {
    var config = _a.config;
    return ({
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var referenceElements, idToApiNameLookUp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        referenceElements = utils_1.buildElementsSourceForFetch(elements, config);
                        return [4 /*yield*/, getRelevantFieldMapping({
                                elementsSource: referenceElements,
                                key: function (field) { return [toShortId(utils_1.getInternalId(field))]; },
                                value: function (field) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    return [2 /*return*/, transformer_1.apiName(field)];
                                }); }); },
                            })];
                    case 1:
                        idToApiNameLookUp = _a.sent();
                        return [4 /*yield*/, replaceInstancesValues(elements, idToApiNameLookUp)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var apiNameToIdLookup;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getRelevantFieldMapping({
                            elementsSource: config.elementsSource,
                            key: function (field) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, transformer_1.apiName(field)];
                                    case 1: return [2 /*return*/, [_a.sent()]];
                                }
                            }); }); },
                            value: function (field) { return toShortId(utils_1.getInternalId(field)); },
                        })];
                    case 1:
                        apiNameToIdLookup = _a.sent();
                        return [4 /*yield*/, replaceInstancesValues(changes.map(adapter_api_1.getChangeData), apiNameToIdLookup)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var idToApiNameLookUp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getRelevantFieldMapping({
                            elementsSource: config.elementsSource,
                            key: function (field) { return [toShortId(utils_1.getInternalId(field))]; },
                            value: transformer_1.apiName,
                        })];
                    case 1:
                        idToApiNameLookUp = _a.sent();
                        return [4 /*yield*/, replaceInstancesValues(changes.map(adapter_api_1.getChangeData), idToApiNameLookUp)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    });
};
exports["default"] = filter;
