"use strict";
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
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var awu = lowerdash_1.collections.asynciterable.awu;
var FIELD_NAME_TO_INNER_CONTEXT_FIELD = {
    applicationVisibilities: { name: 'application' },
    recordTypeVisibilities: { name: 'recordType', nested: true },
    standardValue: { name: 'label' },
    customValue: { name: 'label' },
};
var isFieldWithValueSet = function (field) { return (lodash_1["default"].isArray(field.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET])); };
var formatContext = function (context) {
    if (adapter_api_1.isReferenceExpression(context)) {
        return context.elemID.getFullName();
    }
    if (lodash_1["default"].isString(context)) {
        return context;
    }
    return adapter_utils_1.safeJsonStringify(context);
};
var createInstanceChangeError = function (field, contexts, instance) {
    var _a, _b;
    var instanceName = instance.elemID.name;
    return {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Instances cannot have more than one default',
        detailedMessage: "There cannot be more than one 'default' " + field.name + " in instance: " + instanceName + " type " + field.parent.elemID.name + ".\nThe following " + ((_b = (_a = FIELD_NAME_TO_INNER_CONTEXT_FIELD[field.name]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : constants_1.LABEL) + "s are set to default: " + contexts,
    };
};
var createFieldChangeError = function (field, contexts) {
    var _a, _b;
    return ({
        elemID: field.elemID,
        severity: 'Warning',
        message: 'Types cannot have more than one default',
        detailedMessage: "There cannot be more than one 'default' " + field.name + " in type " + field.parent.elemID.name + ".\nThe following " + ((_b = (_a = FIELD_NAME_TO_INNER_CONTEXT_FIELD[field.name]) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : constants_1.LABEL) + "s are set to default: " + contexts,
    });
};
var getPicklistMultipleDefaultsErrors = function (field) {
    var contexts = field.annotations.valueSet
        .filter(function (obj) { return obj["default"]; })
        .map(function (obj) { return obj[constants_1.LABEL]; })
        .map(formatContext);
    return contexts.length > 1 ? [createFieldChangeError(field, contexts)] : [];
};
var getInstancesMultipleDefaultsErrors = function (after) { return __awaiter(void 0, void 0, void 0, function () {
    var getDefaultObjectsList, findMultipleDefaults, createChangeErrorFromContext, errors;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                getDefaultObjectsList = function (val, type) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        if (adapter_api_1.isMapType(type)) {
                            return [2 /*return*/, awu(Object.values(val))
                                    .flatMap(function (inner) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            _a = getDefaultObjectsList;
                                            _b = [inner];
                                            return [4 /*yield*/, type.getInnerType()];
                                        case 1: return [2 /*return*/, _a.apply(void 0, _b.concat([_c.sent()]))];
                                    }
                                }); }); })
                                    .toArray()];
                        }
                        if (adapter_api_1.isListType(type) && lodash_1["default"].isArray(val)) {
                            return [2 /*return*/, awu(val)
                                    .flatMap(function (inner) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            _a = getDefaultObjectsList;
                                            _b = [inner];
                                            return [4 /*yield*/, type.getInnerType()];
                                        case 1: return [2 /*return*/, _a.apply(void 0, _b.concat([_c.sent()]))];
                                    }
                                }); }); })
                                    .toArray()];
                        }
                        return [2 /*return*/, val];
                    });
                }); };
                findMultipleDefaults = function (value, fieldType, valueName) { return __awaiter(void 0, void 0, void 0, function () {
                    var defaultObjects, contexts;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, getDefaultObjectsList(value, fieldType)];
                            case 1:
                                defaultObjects = _a.sent();
                                contexts = defaultObjects
                                    .filter(function (val) { return val["default"]; })
                                    .map(function (obj) { return obj[valueName]; })
                                    .map(formatContext);
                                return [2 /*return*/, contexts.length > 1 ? contexts : undefined];
                        }
                    });
                }); };
                createChangeErrorFromContext = function (field, context, instance) {
                    if (context !== undefined) {
                        return [createInstanceChangeError(field, context, instance)];
                    }
                    return [];
                };
                return [4 /*yield*/, awu(Object.entries(after.value))
                        .filter(function (_a) {
                        var fieldName = _a[0];
                        return Object.keys(FIELD_NAME_TO_INNER_CONTEXT_FIELD).includes(fieldName);
                    })
                        .flatMap(function (_a) {
                        var fieldName = _a[0], value = _a[1];
                        return __awaiter(void 0, void 0, void 0, function () {
                            var field, fieldType, valueName, defaultsContexts;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, after.getType()];
                                    case 1:
                                        field = (_b.sent()).fields[fieldName];
                                        if (field === undefined) {
                                            // Can happen if the field exists in the instance but not in the type.
                                            return [2 /*return*/, []];
                                        }
                                        return [4 /*yield*/, field.getType()];
                                    case 2:
                                        fieldType = _b.sent();
                                        valueName = FIELD_NAME_TO_INNER_CONTEXT_FIELD[fieldName].name;
                                        if (lodash_1["default"].isPlainObject(value) && FIELD_NAME_TO_INNER_CONTEXT_FIELD[fieldName].nested) {
                                            return [2 /*return*/, awu(Object.entries(value))
                                                    .flatMap(function (_a) {
                                                    var _key = _a[0], innerValue = _a[1];
                                                    return __awaiter(void 0, void 0, void 0, function () {
                                                        var startLevelType, _b, defaultsContexts;
                                                        return __generator(this, function (_c) {
                                                            switch (_c.label) {
                                                                case 0:
                                                                    if (!adapter_api_1.isMapType(fieldType)) return [3 /*break*/, 2];
                                                                    return [4 /*yield*/, fieldType.getInnerType()];
                                                                case 1:
                                                                    _b = _c.sent();
                                                                    return [3 /*break*/, 3];
                                                                case 2:
                                                                    _b = fieldType;
                                                                    _c.label = 3;
                                                                case 3:
                                                                    startLevelType = _b;
                                                                    return [4 /*yield*/, findMultipleDefaults(innerValue, startLevelType, valueName)];
                                                                case 4:
                                                                    defaultsContexts = _c.sent();
                                                                    return [2 /*return*/, createChangeErrorFromContext(field, defaultsContexts, after)];
                                                            }
                                                        });
                                                    });
                                                })];
                                        }
                                        return [4 /*yield*/, findMultipleDefaults(value, fieldType, valueName)];
                                    case 3:
                                        defaultsContexts = _b.sent();
                                        return [2 /*return*/, createChangeErrorFromContext(field, defaultsContexts, after)];
                                }
                            });
                        });
                    })
                        .toArray()];
            case 1:
                errors = _a.sent();
                return [2 /*return*/, errors];
        }
    });
}); };
/**
 * It is forbidden to set more than one 'default' field as 'true' for some types.
 */
var changeValidator = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceChangesErrors, picklistChangesErrors;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(changes)
                    .filter(adapter_api_1.isAdditionOrModificationChange)
                    .filter(adapter_api_1.isInstanceChange)
                    .map(adapter_api_1.getChangeData)
                    .flatMap(getInstancesMultipleDefaultsErrors)
                    .toArray()
                // special treatment for picklist & multipicklist valueSets
            ];
            case 1:
                instanceChangesErrors = _a.sent();
                return [4 /*yield*/, awu(changes)
                        .filter(adapter_api_1.isAdditionOrModificationChange)
                        .filter(adapter_api_1.isFieldChange)
                        .map(adapter_api_1.getChangeData)
                        .filter(transformer_1.isFieldOfCustomObject)
                        .filter(isFieldWithValueSet)
                        .flatMap(getPicklistMultipleDefaultsErrors)
                        .toArray()];
            case 2:
                picklistChangesErrors = _a.sent();
                return [2 /*return*/, __spreadArrays(instanceChangesErrors, picklistChangesErrors)];
        }
    });
}); };
exports["default"] = changeValidator;
