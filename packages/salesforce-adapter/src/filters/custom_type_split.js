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
exports.customFieldsFileName = exports.standardFieldsFileName = exports.annotationsFileName = void 0;
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
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../transformers/transformer");
var custom_objects_to_object_type_1 = require("./custom_objects_to_object_type");
var constants_1 = require("../constants");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var annotationsFileName = function (objectName) { return adapter_utils_1.pathNaclCase(objectName) + "Annotations"; };
exports.annotationsFileName = annotationsFileName;
var standardFieldsFileName = function (objectName) { return adapter_utils_1.pathNaclCase(objectName) + "StandardFields"; };
exports.standardFieldsFileName = standardFieldsFileName;
var customFieldsFileName = function (objectName) { return adapter_utils_1.pathNaclCase(objectName) + "CustomFields"; };
exports.customFieldsFileName = customFieldsFileName;
var perFieldFileName = function (fieldName) { return adapter_utils_1.pathNaclCase(fieldName); };
var splitFields = function (customObject, splitAllFields) { return __awaiter(void 0, void 0, void 0, function () {
    var pathPrefix, _a, _b, standardFieldsObject, customFieldsObject;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, custom_objects_to_object_type_1.getObjectDirectoryPath(customObject)];
            case 1:
                pathPrefix = _c.sent();
                _b = (_a = splitAllFields).includes;
                return [4 /*yield*/, transformer_1.apiName(customObject)];
            case 2:
                if (_b.apply(_a, [_c.sent()])) {
                    return [2 /*return*/, Object.entries(customObject.fields).map(function (_a) {
                            var _b;
                            var fieldName = _a[0], field = _a[1];
                            return new adapter_api_1.ObjectType({
                                elemID: customObject.elemID,
                                fields: (_b = {}, _b[fieldName] = field, _b),
                                path: __spreadArrays(pathPrefix, [
                                    constants_1.OBJECT_FIELDS_PATH,
                                    perFieldFileName(fieldName),
                                ]),
                            });
                        })];
                }
                standardFieldsObject = new adapter_api_1.ObjectType({
                    elemID: customObject.elemID,
                    fields: lodash_1["default"].pickBy(customObject.fields, function (f) { return !transformer_1.isCustom(f.elemID.getFullName()); }),
                    path: __spreadArrays(pathPrefix, [
                        exports.standardFieldsFileName(customObject.elemID.name),
                    ]),
                });
                customFieldsObject = new adapter_api_1.ObjectType({
                    elemID: customObject.elemID,
                    fields: lodash_1["default"].pickBy(customObject.fields, function (f) { return transformer_1.isCustom(f.elemID.getFullName()); }),
                    path: __spreadArrays(pathPrefix, [
                        exports.customFieldsFileName(customObject.elemID.name),
                    ]),
                });
                return [2 /*return*/, [standardFieldsObject, customFieldsObject]];
        }
    });
}); };
var customObjectToSplitElements = function (customObject, splitAllFields) { return __awaiter(void 0, void 0, void 0, function () {
    var pathPrefix, annotationsObject, fieldObjects;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, custom_objects_to_object_type_1.getObjectDirectoryPath(customObject)];
            case 1:
                pathPrefix = _a.sent();
                annotationsObject = new adapter_api_1.ObjectType({
                    elemID: customObject.elemID,
                    annotationRefsOrTypes: customObject.annotationRefTypes,
                    annotations: customObject.annotations,
                    path: __spreadArrays(pathPrefix, [
                        exports.annotationsFileName(customObject.elemID.name),
                    ]),
                });
                return [4 /*yield*/, splitFields(customObject, splitAllFields)];
            case 2:
                fieldObjects = _a.sent();
                return [2 /*return*/, lodash_1["default"].concat(fieldObjects, annotationsObject)];
        }
    });
}); };
var filterCreator = function (_a) {
    var config = _a.config;
    return ({
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var customObjects, newSplitCustomObjects, isNotEmptyObject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(elements)
                            .filter(adapter_api_1.isObjectType)
                            .filter(function (e) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, transformer_1.isCustomObject(e)];
                                case 1: return [2 /*return*/, (_a.sent()) || utils_1.isCustomMetadataRecordType(e)];
                            }
                        }); }); })
                            .toArray()];
                    case 1:
                        customObjects = _a.sent();
                        return [4 /*yield*/, awu(customObjects)
                                .flatMap(function (customObject) {
                                var _a;
                                return customObjectToSplitElements(customObject, (_a = config.separateFieldToFiles) !== null && _a !== void 0 ? _a : []);
                            })
                                .toArray()];
                    case 2:
                        newSplitCustomObjects = _a.sent();
                        lodash_1["default"].pullAllWith(elements, customObjects, 
                        // No need to check for custom objectness since all of the elements in
                        // the second params are custom objects.
                        function (elementA, elementB) { return adapter_api_1.isObjectType(elementA)
                            && adapter_api_1.isObjectType(elementB)
                            && elementA.isEqual(elementB); });
                        isNotEmptyObject = function (customObject) {
                            return !(lodash_1["default"].isEmpty(customObject.annotations) && lodash_1["default"].isEmpty(customObject.fields));
                        };
                        elements.push.apply(elements, newSplitCustomObjects.filter(isNotEmptyObject));
                        return [2 /*return*/];
                }
            });
        }); },
    });
};
exports["default"] = filterCreator;
