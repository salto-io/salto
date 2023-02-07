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
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var _a = lowerdash_1.collections.asynciterable, groupByAsync = _a.groupByAsync, awu = _a.awu;
var removeAsync = lowerdash_1.promises.array.removeAsync;
var DEFAULT_NACL_FILENAME = 'Attributes';
var toNaclFilename = function (fieldName, objType) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = fieldName !== undefined;
                if (!_a) return [3 /*break*/, 2];
                _b = adapter_api_1.isMapType;
                return [4 /*yield*/, ((_c = objType.fields[fieldName]) === null || _c === void 0 ? void 0 : _c.getType())];
            case 1:
                _a = _b.apply(void 0, [_d.sent()]);
                _d.label = 2;
            case 2: return [2 /*return*/, ((_a)
                    ? lowerdash_1.strings.capitalizeFirstLetter(fieldName)
                    : DEFAULT_NACL_FILENAME)];
        }
    });
}); };
var splitProfile = function (profile) { return __awaiter(void 0, void 0, void 0, function () {
    var toInstancePart, targetFieldsByFile, profileInstances;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                toInstancePart = function (naclFilename, fieldNames) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _a = adapter_api_1.InstanceElement.bind;
                                _b = [void 0, profile.elemID.name];
                                return [4 /*yield*/, profile.getType()];
                            case 1: return [2 /*return*/, (new (_a.apply(adapter_api_1.InstanceElement, _b.concat([_c.sent(), lodash_1["default"].pick.apply(lodash_1["default"], __spreadArrays([profile.value], fieldNames)), profile.path === undefined ? undefined : __spreadArrays(profile.path, [naclFilename]), naclFilename === DEFAULT_NACL_FILENAME ? profile.annotations : undefined])))())];
                        }
                    });
                }); };
                return [4 /*yield*/, groupByAsync(Object.keys(profile.value), function (fieldName) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _a = toNaclFilename;
                                _b = [fieldName];
                                return [4 /*yield*/, profile.getType()];
                            case 1: return [2 /*return*/, _a.apply(void 0, _b.concat([_c.sent()]))];
                        }
                    }); }); })
                    // keep the default filename first so that it comes up first when searching the path index
                ];
            case 1:
                targetFieldsByFile = _a.sent();
                return [4 /*yield*/, Promise.all(lodash_1["default"].sortBy(Object.entries(targetFieldsByFile), function (_a) {
                        var fileName = _a[0];
                        return fileName !== DEFAULT_NACL_FILENAME;
                    }).map(function (_a) {
                        var fileName = _a[0], fields = _a[1];
                        return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_b) {
                            return [2 /*return*/, toInstancePart(fileName, fields)];
                        }); });
                    }))];
            case 2:
                profileInstances = _a.sent();
                return [2 /*return*/, profileInstances];
        }
    });
}); };
var isProfileInstance = function (elem) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = adapter_api_1.isInstanceElement(elem);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, transformer_1.metadataType(elem)];
            case 1:
                _a = (_b.sent()) === constants_1.PROFILE_METADATA_TYPE;
                _b.label = 2;
            case 2: return [2 /*return*/, (_a)
                /**
                 * Split profile instances, each assigned to its own nacl path.
                 * Each map field is assigned to a separate file, and the other fields and annotations
                 * to Attributes.nacl.
                 */
            ];
        }
    });
}); };
/**
 * Split profile instances, each assigned to its own nacl path.
 * Each map field is assigned to a separate file, and the other fields and annotations
 * to Attributes.nacl.
 */
var filterCreator = function () { return ({
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        var profileInstances, newProfileInstances;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, removeAsync(elements, isProfileInstance)];
                case 1:
                    profileInstances = _a.sent();
                    if (profileInstances.length === 0) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, awu(profileInstances).flatMap(splitProfile).toArray()];
                case 2:
                    newProfileInstances = _a.sent();
                    elements.push.apply(elements, newProfileInstances);
                    return [2 /*return*/];
            }
        });
    }); },
}); };
exports["default"] = filterCreator;
