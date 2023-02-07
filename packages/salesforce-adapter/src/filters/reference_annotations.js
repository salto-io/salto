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
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var makeArray = lowerdash_1.collections.array.makeArray;
var REFERENCE_TO = constants_1.FIELD_ANNOTATIONS.REFERENCE_TO;
var awu = lowerdash_1.collections.asynciterable.awu;
var isMetadataTypeOrCustomObject = function (elem) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (transformer_1.isMetadataObjectType(elem) || transformer_1.isCustomObject(elem))
            /**
             * Convert annotations to reference expressions using the known metadata types.
             *
             * @param elements      The fetched elements
             * @param typeToElemID  Known element ids by metadata type
             */
        ];
    });
}); };
/**
 * Convert annotations to reference expressions using the known metadata types.
 *
 * @param elements      The fetched elements
 * @param typeToElemID  Known element ids by metadata type
 */
var convertAnnotationsToReferences = function (elements, typeToElemID, annotationNames) { return __awaiter(void 0, void 0, void 0, function () {
    var resolveTypeReference;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                resolveTypeReference = function (ref) {
                    var _a;
                    if (lodash_1["default"].isString(ref)) {
                        // Try finding a metadata type and fallback to finding a custom object
                        var referenceElemId = (_a = typeToElemID.get(ref, ref)) !== null && _a !== void 0 ? _a : typeToElemID.get(constants_1.CUSTOM_OBJECT, ref);
                        if (referenceElemId !== undefined) {
                            return new adapter_api_1.ReferenceExpression(referenceElemId);
                        }
                    }
                    return ref;
                };
                return [4 /*yield*/, awu(elements)
                        .filter(adapter_api_1.isObjectType)
                        .filter(isMetadataTypeOrCustomObject)
                        .flatMap(function (obj) { return Object.values(obj.fields); })
                        .filter(function (field) { return annotationNames.some(function (name) { return field.annotations[name] !== undefined; }); })
                        .forEach(function (field) {
                        annotationNames.filter(function (name) { return field.annotations[name] !== undefined; }).forEach(function (name) {
                            field.annotations[name] = makeArray(field.annotations[name]).map(resolveTypeReference);
                        });
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
/**
 * Convert referenceTo and foreignKeyDomain annotations into reference expressions.
 */
var filter = function (_a) {
    var config = _a.config;
    return ({
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var referenceElements, typeToElemID, _a, _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        referenceElements = utils_1.buildElementsSourceForFetch(elements, config);
                        _b = (_a = lowerdash_1.multiIndex).keyByAsync;
                        _c = {};
                        return [4 /*yield*/, referenceElements.getAll()];
                    case 1: return [4 /*yield*/, _b.apply(_a, [(_c.iter = _d.sent(),
                                _c.filter = isMetadataTypeOrCustomObject,
                                _c.key = function (obj) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, transformer_1.metadataType(obj)];
                                        case 1:
                                            _a = [_b.sent()];
                                            return [4 /*yield*/, transformer_1.apiName(obj)];
                                        case 2: return [2 /*return*/, _a.concat([_b.sent()])];
                                    }
                                }); }); },
                                _c.map = function (obj) { return obj.elemID; },
                                _c)])];
                    case 2:
                        typeToElemID = _d.sent();
                        return [4 /*yield*/, convertAnnotationsToReferences(elements, typeToElemID, [REFERENCE_TO, constants_1.FOREIGN_KEY_DOMAIN])];
                    case 3:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    });
};
exports["default"] = filter;
