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
var adapter_api_1 = require("@salto-io/adapter-api");
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var logging_1 = require("@salto-io/logging");
var constants_1 = require("../constants");
var custom_objects_to_object_type_1 = require("./custom_objects_to_object_type");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var log = logging_1.logger(module);
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, groupByAsync = _a.groupByAsync;
var createCustomMetadataRecordType = function (instance, customMetadataType) { return __awaiter(void 0, void 0, void 0, function () {
    var objectType;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, custom_objects_to_object_type_1.createCustomTypeFromCustomObjectInstance({ instance: instance, metadataType: constants_1.CUSTOM_METADATA })];
            case 1:
                objectType = _a.sent();
                objectType.fields = __assign(__assign({}, objectType.fields), lodash_1["default"].omit(customMetadataType.fields, 'values'));
                return [2 /*return*/, objectType];
        }
    });
}); };
var isCustomMetadataRecordTypeField = function (element) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (adapter_api_1.isField(element) && utils_1.isCustomMetadataRecordType(element.parent))];
    });
}); };
var isCustomMetadataRelatedChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var element;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                element = adapter_api_1.getChangeData(change);
                return [4 /*yield*/, utils_1.isCustomMetadataRecordType(element)];
            case 1: return [2 /*return*/, (_a.sent()) || isCustomMetadataRecordTypeField(element)];
        }
    });
}); };
var getApiNameOfRelatedChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var element;
    return __generator(this, function (_a) {
        element = adapter_api_1.getChangeData(change);
        return [2 /*return*/, adapter_api_1.isField(element) ? transformer_1.apiName(element.parent) : transformer_1.apiName(element)];
    });
}); };
var filterCreator = function (_a) {
    var config = _a.config;
    var groupedOriginalChangesByApiName;
    return {
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var customMetadataType, customMetadataInstances, customMetadataRecordTypes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(elements)
                            .filter(adapter_api_1.isObjectType)
                            .find(function (e) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, transformer_1.apiName(e)];
                                case 1: return [2 /*return*/, (_a.sent()) === constants_1.CUSTOM_METADATA];
                            }
                        }); }); })];
                    case 1:
                        customMetadataType = _a.sent();
                        if (lodash_1["default"].isUndefined(customMetadataType)) {
                            log.warn('Could not find CustomMetadata ObjectType. Skipping filter.');
                            return [2 /*return*/];
                        }
                        customMetadataInstances = elements
                            .filter(adapter_api_1.isInstanceElement)
                            .filter(function (e) { return e.elemID.name.endsWith(constants_1.CUSTOM_METADATA_SUFFIX); });
                        return [4 /*yield*/, awu(customMetadataInstances)
                                .map(function (instance) { return createCustomMetadataRecordType(instance, customMetadataType); })
                                .toArray()];
                    case 2:
                        customMetadataRecordTypes = _a.sent();
                        lodash_1["default"].pullAll(elements, customMetadataInstances);
                        customMetadataRecordTypes.forEach(function (e) { return elements.push(e); });
                        return [2 /*return*/];
                }
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var customMetadataRelatedChanges, deployableChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(function (c) { return adapter_api_1.isObjectTypeChange(c) || adapter_api_1.isFieldChange(c); })
                            .filter(isCustomMetadataRelatedChange)
                            .toArray()];
                    case 1:
                        customMetadataRelatedChanges = _a.sent();
                        return [4 /*yield*/, groupByAsync(customMetadataRelatedChanges, getApiNameOfRelatedChange)];
                    case 2:
                        groupedOriginalChangesByApiName = _a.sent();
                        return [4 /*yield*/, awu(Object.entries(groupedOriginalChangesByApiName))
                                .map(function (entry) { return custom_objects_to_object_type_1.createCustomObjectChange.apply(void 0, __spreadArrays([config.systemFields], entry)); })
                                .toArray()];
                    case 3:
                        deployableChanges = _a.sent();
                        lodash_1["default"].pullAll(changes, customMetadataRelatedChanges);
                        deployableChanges.forEach(function (c) { return changes.push(c); });
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var relatedAppliedChangesApiNames, appliedChangesApiNames, appliedOriginalChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(utils_1.isInstanceOfTypeChange(constants_1.CUSTOM_OBJECT))
                            .filter(function (c) { return adapter_api_1.getChangeData(c).elemID.name.endsWith(constants_1.CUSTOM_METADATA_SUFFIX); })
                            .toArray()];
                    case 1:
                        relatedAppliedChangesApiNames = _a.sent();
                        return [4 /*yield*/, awu(relatedAppliedChangesApiNames)
                                .map(function (c) { return transformer_1.apiName(adapter_api_1.getChangeData(c)); })
                                .toArray()];
                    case 2:
                        appliedChangesApiNames = _a.sent();
                        appliedOriginalChanges = appliedChangesApiNames
                            .flatMap(function (name) { var _a; return (_a = groupedOriginalChangesByApiName[name]) !== null && _a !== void 0 ? _a : []; });
                        lodash_1["default"].pullAll(changes, relatedAppliedChangesApiNames);
                        appliedOriginalChanges.forEach(function (c) { return changes.push(c); });
                        return [2 /*return*/];
                }
            });
        }); },
    };
};
exports["default"] = filterCreator;
