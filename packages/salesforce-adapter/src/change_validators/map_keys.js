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
var convert_maps_1 = require("../filters/convert_maps");
var constants_1 = require("../constants");
var reference_mapping_1 = require("../transformers/reference_mapping");
var utils_1 = require("../filters/utils");
var transformer_1 = require("../transformers/transformer");
var awu = lowerdash_1.collections.asynciterable.awu;
var metadataTypesToValidate = [
    constants_1.PROFILE_METADATA_TYPE,
    constants_1.PERMISSION_SET_METADATA_TYPE,
];
var isNum = function (str) { return (!lodash_1["default"].isEmpty(str) && !Number.isNaN(lodash_1["default"].toNumber(str))); };
var getMapKeyErrors = function (after) { return __awaiter(void 0, void 0, void 0, function () {
    var errors, type, typeName, mapper;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                errors = [];
                return [4 /*yield*/, after.getType()];
            case 1:
                type = _a.sent();
                return [4 /*yield*/, transformer_1.apiName(type)];
            case 2:
                typeName = _a.sent();
                mapper = convert_maps_1.metadataTypeToFieldToMapDef[typeName];
                return [4 /*yield*/, awu(Object.entries(after.value)).filter(function (_a) {
                        var fieldName = _a[0];
                        return __awaiter(void 0, void 0, void 0, function () {
                            var _b;
                            var _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        _b = adapter_api_1.isMapType;
                                        return [4 /*yield*/, ((_c = (type).fields[fieldName]) === null || _c === void 0 ? void 0 : _c.getType())];
                                    case 1: return [2 /*return*/, _b.apply(void 0, [_d.sent()])
                                            && mapper[fieldName] !== undefined];
                                }
                            });
                        });
                    }).forEach(function (_a) {
                        var fieldName = _a[0], fieldValues = _a[1];
                        return __awaiter(void 0, void 0, void 0, function () {
                            var fieldType, mapDef, findInvalidPaths;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, (type).fields[fieldName].getType()];
                                    case 1:
                                        fieldType = _b.sent();
                                        mapDef = mapper[fieldName];
                                        findInvalidPaths = function (_a) {
                                            var value = _a.value, path = _a.path, field = _a.field;
                                            return __awaiter(void 0, void 0, void 0, function () {
                                                var _b, expectedPath_1, pathParts, actualPath, previewPrefix;
                                                var _c;
                                                return __generator(this, function (_d) {
                                                    switch (_d.label) {
                                                        case 0:
                                                            _b = adapter_api_1.isObjectType;
                                                            return [4 /*yield*/, (field === null || field === void 0 ? void 0 : field.getType())];
                                                        case 1:
                                                            if (_b.apply(void 0, [_d.sent()]) && path !== undefined) {
                                                                if (value[mapDef.key] === undefined) {
                                                                    errors.push({
                                                                        elemID: path,
                                                                        severity: 'Error',
                                                                        message: "Nested value '" + mapDef.key + "' not found in field '" + fieldName,
                                                                        detailedMessage: typeName + " " + after.value.fullName + " field " + fieldName + ": Nested value '" + mapDef.key + "' not found",
                                                                    });
                                                                    return [2 /*return*/, undefined];
                                                                }
                                                                // this validation intend to catch unresolved reference, and should be removed after the general fix
                                                                if (typeof value[mapDef.key] !== 'string') {
                                                                    return [2 /*return*/, undefined];
                                                                }
                                                                expectedPath_1 = convert_maps_1.defaultMapper(value[mapDef.key]).slice(0, mapDef.nested ? 2 : 1);
                                                                pathParts = path.getFullNameParts().filter(function (part) { return !isNum(part); });
                                                                actualPath = pathParts.slice(-expectedPath_1.length);
                                                                previewPrefix = actualPath.slice(0, actualPath.findIndex(function (val, idx) { return val !== expectedPath_1[idx]; }) + 1);
                                                                if (!lodash_1["default"].isEqual(actualPath, expectedPath_1)) {
                                                                    errors.push({
                                                                        elemID: (_c = after.elemID).createNestedID.apply(_c, __spreadArrays([fieldName], previewPrefix)),
                                                                        severity: 'Error',
                                                                        message: "Incorrect map key in " + typeName + " " + after.value.fullName + " field " + fieldName + ": " + (previewPrefix === null || previewPrefix === void 0 ? void 0 : previewPrefix.join(constants_1.API_NAME_SEPARATOR)) + " should be " + expectedPath_1.slice(0, previewPrefix.length).join(constants_1.API_NAME_SEPARATOR),
                                                                        detailedMessage: typeName + " " + after.value.fullName + " field " + fieldName + ": Incorrect map key " + (actualPath === null || actualPath === void 0 ? void 0 : actualPath.join(constants_1.API_NAME_SEPARATOR)) + ", should be " + expectedPath_1.join(constants_1.API_NAME_SEPARATOR),
                                                                    });
                                                                }
                                                                return [2 /*return*/, undefined];
                                                            }
                                                            return [2 /*return*/, value];
                                                    }
                                                });
                                            });
                                        };
                                        return [4 /*yield*/, adapter_utils_1.transformValues({
                                                values: fieldValues,
                                                type: fieldType,
                                                transformFunc: findInvalidPaths,
                                                strict: false,
                                                allowEmpty: true,
                                                pathID: after.elemID.createNestedID(fieldName),
                                            })];
                                    case 2:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        });
                    })];
            case 3:
                _a.sent();
                return [2 /*return*/, errors];
        }
    });
}); };
var changeValidator = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (awu(changes)
                .filter(adapter_api_1.isAdditionOrModificationChange)
                .filter(adapter_api_1.isInstanceChange)
                .filter(utils_1.isInstanceOfTypeChange.apply(void 0, metadataTypesToValidate))
                .flatMap(function (change) { return __awaiter(void 0, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = getMapKeyErrors;
                            return [4 /*yield*/, adapter_utils_1.resolveValues(adapter_api_1.getChangeData(change), reference_mapping_1.getLookUpName)];
                        case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                    }
                });
            }); })
                .toArray())];
    });
}); };
exports["default"] = changeValidator;
