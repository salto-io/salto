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
exports.hasValueSetNameAnnotation = exports.isValueSetReference = exports.isPicklistField = void 0;
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
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var global_value_sets_1 = require("./global_value_sets");
var awu = lowerdash_1.collections.asynciterable.awu;
var makeArray = lowerdash_1.collections.array.makeArray;
var isPicklistField = function (changedElement) {
    return adapter_api_1.isField(changedElement)
        && ([
            transformer_1.Types.primitiveDataTypes.Picklist.elemID.getFullName(),
            transformer_1.Types.primitiveDataTypes.MultiselectPicklist.elemID.getFullName(),
        ]).includes(changedElement.refType.elemID.getFullName());
};
exports.isPicklistField = isPicklistField;
var isValueSetReference = function (field) {
    return adapter_api_1.isReferenceExpression(field.annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME]);
};
exports.isValueSetReference = isValueSetReference;
var hasValueSetNameAnnotation = function (field) {
    return !lodash_1["default"].isUndefined(field.annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME]);
};
exports.hasValueSetNameAnnotation = hasValueSetNameAnnotation;
/**
 * Adds inactive values after the deletion of the values in the following cases:
 *  - Global value set
 *  - Restricted custom value set
 */
var filterCreator = function () { return ({
    onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        var isRestrictedPicklistField, isGlobalValueSetInstanceChange, withRemovedCustomValues;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    isRestrictedPicklistField = function (changedElement) {
                        return exports.isPicklistField(changedElement)
                            && Boolean(changedElement.annotations[constants_1.FIELD_ANNOTATIONS.RESTRICTED]);
                    };
                    isGlobalValueSetInstanceChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _a = adapter_api_1.isInstanceChange(change);
                                    if (!_a) return [3 /*break*/, 2];
                                    return [4 /*yield*/, transformer_1.metadataType(adapter_api_1.getChangeData(change))];
                                case 1:
                                    _a = (_b.sent()) === global_value_sets_1.GLOBAL_VALUE_SET;
                                    _b.label = 2;
                                case 2: return [2 /*return*/, (_a)];
                            }
                        });
                    }); };
                    withRemovedCustomValues = function (beforeValues, afterValues) {
                        var afterCustomValuesFullNames = afterValues.map(function (v) { return v.fullName; });
                        var setCustomValueInactive = function (value) {
                            value.isActive = false;
                            return value;
                        };
                        return __spreadArrays(afterValues, beforeValues
                            .filter(function (v) { return !afterCustomValuesFullNames.includes(v.fullName); })
                            .map(function (v) { return setCustomValueInactive(v); }));
                    };
                    // Handle global value set instances
                    return [4 /*yield*/, awu(changes)
                            .filter(adapter_api_1.isModificationChange)
                            .filter(isGlobalValueSetInstanceChange)
                            .forEach(function (change) {
                            var instChange = change;
                            var beforeCustomValues = makeArray(instChange.data.before.value[global_value_sets_1.CUSTOM_VALUE]);
                            var afterCustomValues = makeArray(instChange.data.after.value[global_value_sets_1.CUSTOM_VALUE]);
                            instChange.data.after.value[global_value_sets_1.CUSTOM_VALUE] = withRemovedCustomValues(beforeCustomValues, afterCustomValues);
                        })
                        // Handle restricted picklist fields
                    ];
                case 1:
                    // Handle global value set instances
                    _a.sent();
                    // Handle restricted picklist fields
                    changes
                        .filter(adapter_api_1.isFieldChange)
                        .filter(adapter_api_1.isModificationChange)
                        .filter(function (change) {
                        var field = adapter_api_1.getChangeData(change);
                        return (isRestrictedPicklistField(field)
                            && !exports.isValueSetReference(field));
                    })
                        .forEach(function (change) {
                        var beforeField = change.data.before;
                        var afterField = change.data.after;
                        var beforeCustomValues = makeArray(beforeField.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET]);
                        var afterCustomValues = makeArray(afterField.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET]);
                        afterField.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET] = withRemovedCustomValues(beforeCustomValues, afterCustomValues);
                    });
                    return [2 /*return*/];
            }
        });
    }); },
}); };
exports["default"] = filterCreator;
