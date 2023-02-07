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
var lodash_1 = require("lodash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var makeArray = lowerdash_1.collections.array.makeArray;
var flatMapAsync = lowerdash_1.collections.asynciterable.flatMapAsync;
/**
 * Resolve references using the mapping generated from the Salesforce DescribeValueType API.
 *
 * @param instance                The current instance being modified
 * @param externalIDToElemIDs     Known element ids, mapped by API name and metadata type
 */
var resolveReferences = function (instance, externalIDToElemIDs) { return __awaiter(void 0, void 0, void 0, function () {
    var transformPrimitive, _a, _b;
    var _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                transformPrimitive = function (_a) {
                    var value = _a.value, field = _a.field;
                    if (field === undefined || value === undefined || !lodash_1["default"].isString(value)) {
                        return value;
                    }
                    var refTarget = makeArray(field.annotations[constants_1.FOREIGN_KEY_DOMAIN])
                        .filter(adapter_api_1.isReferenceExpression)
                        .map(function (ref) { return externalIDToElemIDs.get(ref.elemID.typeName, value); })
                        .find(lowerdash_1.values.isDefined);
                    return refTarget !== undefined ? new adapter_api_1.ReferenceExpression(refTarget) : value;
                };
                // not using transformElement because we're editing the instance in-place
                _a = instance;
                _b = adapter_utils_1.transformValues;
                _c = {
                    values: instance.value
                };
                return [4 /*yield*/, instance.getType()];
            case 1: return [4 /*yield*/, _b.apply(void 0, [(_c.type = _e.sent(),
                        _c.transformFunc = transformPrimitive,
                        _c.strict = false,
                        _c.allowEmpty = true,
                        _c)])];
            case 2:
                // not using transformElement because we're editing the instance in-place
                _a.value = (_d = _e.sent()) !== null && _d !== void 0 ? _d : instance.value;
                return [2 /*return*/];
        }
    });
}); };
/**
 * Use annotations generated from the DescribeValueType API foreignKeyDomain data to resolve
 * names into reference expressions.
 */
var filter = function (_a) {
    var config = _a.config;
    return ({
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var referenceElements, elementsWithFields, _a, elementIndex;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        referenceElements = utils_1.buildElementsSourceForFetch(elements, config);
                        _a = flatMapAsync;
                        return [4 /*yield*/, referenceElements.getAll()];
                    case 1:
                        elementsWithFields = _a.apply(void 0, [_b.sent(), utils_1.extractFlatCustomObjectFields]);
                        return [4 /*yield*/, lowerdash_1.multiIndex.keyByAsync({
                                iter: elementsWithFields,
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
                                map: function (elem) { return elem.elemID; },
                            })];
                    case 2:
                        elementIndex = _b.sent();
                        return [4 /*yield*/, awu(elements)
                                .filter(adapter_api_1.isInstanceElement)
                                .forEach(function (instance) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, resolveReferences(instance, elementIndex)];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 3:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    });
};
exports["default"] = filter;
