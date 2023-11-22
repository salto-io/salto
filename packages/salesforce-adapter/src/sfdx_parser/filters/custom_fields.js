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
var path_1 = require("path");
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var file_1 = require("@salto-io/file");
var constants_1 = require("../../constants");
var utils_1 = require("../../filters/utils");
var transformer_1 = require("../../transformers/transformer");
var xml_transformer_1 = require("../../transformers/xml_transformer");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
var FIELD_FILE_NAME_REGEXP = new RegExp('(?<pkg>[^/]+)/(?<app>[^/]+)/(?<type>[^/]+)/(?<object>[^/]+)/.*\\.field-meta\\.xml');
var getFieldsOfCustomObject = function (customObjectName, packageDir, sourceFileNames) { return __awaiter(void 0, void 0, void 0, function () {
    var fieldFileNames;
    return __generator(this, function (_a) {
        fieldFileNames = sourceFileNames
            .filter(function (fileName) {
            var _a;
            var match = fileName.match(FIELD_FILE_NAME_REGEXP);
            return ((_a = match === null || match === void 0 ? void 0 : match.groups) === null || _a === void 0 ? void 0 : _a.object) === customObjectName;
        });
        return [2 /*return*/, awu(fieldFileNames)
                .map(function (fileName) { return __awaiter(void 0, void 0, void 0, function () {
                var fileContent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, file_1.readTextFile.notFoundAsUndefined(path_1["default"].join(packageDir, fileName))];
                        case 1:
                            fileContent = _a.sent();
                            if (fileContent === undefined) {
                                // Should never happen
                                log.warn('skipping %s because we could not get its content', fileName);
                                return [2 /*return*/, undefined];
                            }
                            return [2 /*return*/, xml_transformer_1.xmlToValues(fileContent).values];
                    }
                });
            }); })
                .filter(lowerdash_1.values.isDefined)
                .toArray()];
    });
}); };
var addFieldAccessAnnotations = function (customObjectName, fields, elementsSource) { return __awaiter(void 0, void 0, void 0, function () {
    var elem, fieldAnnotations;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, elementsSource.get(new adapter_api_1.ElemID(constants_1.SALESFORCE, customObjectName))];
            case 1:
                elem = _a.sent();
                fieldAnnotations = adapter_api_1.isObjectType(elem)
                    ? lodash_1["default"].mapValues(elem.fields, function (fieldFromElem) { return lodash_1["default"].pick(fieldFromElem.annotations, [constants_1.FIELD_ANNOTATIONS.CREATABLE, constants_1.FIELD_ANNOTATIONS.UPDATEABLE, constants_1.FIELD_ANNOTATIONS.QUERYABLE]); })
                    : {};
                return [2 /*return*/, fields.map(function (field) {
                        var _a;
                        var _b;
                        return (__assign(__assign({}, field), (_b = fieldAnnotations[field.fullName]) !== null && _b !== void 0 ? _b : (_a = {},
                            _a[constants_1.FIELD_ANNOTATIONS.CREATABLE] = true,
                            _a[constants_1.FIELD_ANNOTATIONS.UPDATEABLE] = true,
                            _a[constants_1.FIELD_ANNOTATIONS.QUERYABLE] = true,
                            _a)));
                    })];
        }
    });
}); };
var filterCreator = function (_a) {
    var files = _a.files, config = _a.config;
    return ({
        name: 'sfdxCustomFieldsFilter',
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var customObjects;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(elements)
                            .filter(utils_1.isInstanceOfType(constants_1.CUSTOM_OBJECT))
                            .keyBy(transformer_1.apiName)];
                    case 1:
                        customObjects = _a.sent();
                        return [4 /*yield*/, awu(Object.entries(customObjects))
                                .forEach(function (_a) {
                                var customObjectName = _a[0], customObjectInstance = _a[1];
                                return __awaiter(void 0, void 0, void 0, function () {
                                    var fields, _b;
                                    return __generator(this, function (_c) {
                                        switch (_c.label) {
                                            case 0: return [4 /*yield*/, getFieldsOfCustomObject(customObjectName, files.baseDirName, files.sourceFileNames)
                                                // An issue that is specific to custom fields - because we don't have the soap API
                                                // to tell us about the field's access, we get all fields as if we have no access to them
                                                // in order to work around this issue, we try to take the values from the existing fields
                                                // annotations (from the element source), and assume all new fields have full access
                                            ];
                                            case 1:
                                                fields = _c.sent();
                                                // An issue that is specific to custom fields - because we don't have the soap API
                                                // to tell us about the field's access, we get all fields as if we have no access to them
                                                // in order to work around this issue, we try to take the values from the existing fields
                                                // annotations (from the element source), and assume all new fields have full access
                                                _b = customObjectInstance.value;
                                                return [4 /*yield*/, addFieldAccessAnnotations(customObjectName, fields, config.elementsSource)];
                                            case 2:
                                                // An issue that is specific to custom fields - because we don't have the soap API
                                                // to tell us about the field's access, we get all fields as if we have no access to them
                                                // in order to work around this issue, we try to take the values from the existing fields
                                                // annotations (from the element source), and assume all new fields have full access
                                                _b.fields = _c.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                });
                            })
                            // TODO: merge system fields into the custom object as well, otherwise we are missing
                            // references in layouts and this can cause conflicts
                        ];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    });
};
exports["default"] = filterCreator;
