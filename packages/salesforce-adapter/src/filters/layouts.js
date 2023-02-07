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
exports.specialLayoutObjects = exports.WEBLINK_TYPE_ID = exports.LAYOUT_TYPE_ID = void 0;
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
var logging_1 = require("@salto-io/logging");
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var constants_1 = require("../constants");
var custom_objects_to_object_type_1 = require("./custom_objects_to_object_type");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
exports.LAYOUT_TYPE_ID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.LAYOUT_TYPE_ID_METADATA_TYPE);
exports.WEBLINK_TYPE_ID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.WEBLINK_METADATA_TYPE);
exports.specialLayoutObjects = new Map([
    ['CaseClose', 'Case'],
    ['UserAlt', 'User'],
]);
// Layout full name starts with related sobject and then '-'
var layoutObjAndName = function (layout) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, obj, name;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, transformer_1.apiName(layout)];
            case 1:
                _a = (_c.sent()).split('-'), obj = _a[0], name = _a.slice(1);
                return [2 /*return*/, [(_b = exports.specialLayoutObjects.get(obj)) !== null && _b !== void 0 ? _b : obj, name.join('-')]];
        }
    });
}); };
var fixLayoutPath = function (layout, customObject, layoutName) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = layout;
                return [4 /*yield*/, custom_objects_to_object_type_1.getObjectDirectoryPath(customObject)];
            case 1:
                _a.path = __spreadArrays.apply(void 0, [_b.sent(), [
                        layout.elemID.typeName,
                        adapter_utils_1.pathNaclCase(adapter_utils_1.naclCase(layoutName)),
                    ]]);
                return [2 /*return*/];
        }
    });
}); };
/**
* Declare the layout filter, this filter adds reference from the sobject to it's layouts.
* Fixes references in layout items.
*/
var filterCreator = function (_a) {
    var config = _a.config;
    return ({
        /**
         * Upon fetch, shorten layout ID and add reference to layout sobjects.
         * Fixes references in layout items.
         *
         * @param elements the already fetched elements
         */
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var layouts, referenceElements, apiNameToCustomObject, _a, _b;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, awu(elements)
                            .filter(adapter_api_1.isInstanceElement)
                            .filter(utils_1.isInstanceOfType(constants_1.LAYOUT_TYPE_ID_METADATA_TYPE))
                            .toArray()];
                    case 1:
                        layouts = _d.sent();
                        if (layouts.length === 0) {
                            return [2 /*return*/];
                        }
                        referenceElements = utils_1.buildElementsSourceForFetch(elements, config);
                        _b = (_a = lowerdash_1.multiIndex).keyByAsync;
                        _c = {};
                        return [4 /*yield*/, referenceElements.getAll()];
                    case 2: return [4 /*yield*/, _b.apply(_a, [(_c.iter = _d.sent(),
                                _c.filter = transformer_1.isCustomObject,
                                _c.key = function (obj) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, transformer_1.apiName(obj)];
                                        case 1: return [2 /*return*/, [_a.sent()]];
                                    }
                                }); }); },
                                _c.map = function (obj) { return obj.elemID; },
                                _c)])];
                    case 3:
                        apiNameToCustomObject = _d.sent();
                        return [4 /*yield*/, awu(layouts).forEach(function (layout) { return __awaiter(void 0, void 0, void 0, function () {
                                var _a, layoutObjName, layoutName, layoutObjId, layoutObj, _b, _c;
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0: return [4 /*yield*/, layoutObjAndName(layout)];
                                        case 1:
                                            _a = _d.sent(), layoutObjName = _a[0], layoutName = _a[1];
                                            layoutObjId = apiNameToCustomObject.get(layoutObjName);
                                            if (!(layoutObjId !== undefined)) return [3 /*break*/, 3];
                                            return [4 /*yield*/, referenceElements.get(layoutObjId)];
                                        case 2:
                                            _b = _d.sent();
                                            return [3 /*break*/, 4];
                                        case 3:
                                            _b = undefined;
                                            _d.label = 4;
                                        case 4:
                                            layoutObj = _b;
                                            _c = layoutObj === undefined;
                                            if (_c) return [3 /*break*/, 6];
                                            return [4 /*yield*/, transformer_1.isCustomObject(layoutObj)];
                                        case 5:
                                            _c = !(_d.sent());
                                            _d.label = 6;
                                        case 6:
                                            if (_c) {
                                                log.debug('Could not find object %s for layout %s', layoutObjName, layoutName);
                                                return [2 /*return*/];
                                            }
                                            utils_1.addElementParentReference(layout, layoutObj);
                                            return [4 /*yield*/, fixLayoutPath(layout, layoutObj, layoutName)];
                                        case 7:
                                            _d.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 4:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    });
};
exports["default"] = filterCreator;
