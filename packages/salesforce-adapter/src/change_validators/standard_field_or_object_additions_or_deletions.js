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
var adapter_api_1 = require("@salto-io/adapter-api");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("../filters/utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var isCustomFieldChange = function (change) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, (transformer_1.isFieldOfCustomObject(adapter_api_1.getChangeData(change)))];
}); }); };
var isCustomObjectChange = function (change) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, (transformer_1.isCustomObject(adapter_api_1.getChangeData(change)))];
}); }); };
var createFieldAdditionChangeError = function (field) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _b = {
                    elemID: field.elemID,
                    severity: 'Error',
                    message: 'Standard field does not exist in target organization'
                };
                _a = "The standard field " + field.name + " of type ";
                return [4 /*yield*/, utils_1.safeApiName(field.parent)];
            case 1: return [2 /*return*/, (_b.detailedMessage = _a + (_c.sent()) + " does not exist in your target organization. It is not possible to create a standard field through the API. You may need additional feature licenses. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058127-creation-deletion-of-standard-field-object-is-not-allowed",
                    _b)];
        }
    });
}); };
var createObjectAdditionChangeError = function (objectType) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _b = {
                    elemID: objectType.elemID,
                    severity: 'Error',
                    message: 'Standard object does not exist in target organization'
                };
                _a = "The standard object ";
                return [4 /*yield*/, utils_1.safeApiName(objectType)];
            case 1: return [2 /*return*/, (_b.detailedMessage = _a + (_c.sent()) + " does not exist in your target organization.  You cannot create a standard object through the API. You may need additional feature licenses. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058127-creation-deletion-of-standard-field-object-is-not-allowed",
                    _b)];
        }
    });
}); };
var createFieldRemovalChangeError = function (field) { return ({
    elemID: field.elemID,
    severity: 'Error',
    message: 'Cannot delete a standard field',
    detailedMessage: "Deletion of standard field " + field.name + " through the API is forbidden. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058127-creation-deletion-of-standard-field-object-is-not-allowed",
}); };
var createObjectRemovalChangeError = function (objectType) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _b = {
                    elemID: objectType.elemID,
                    severity: 'Error',
                    message: 'Cannot delete a standard object'
                };
                _a = "Deletion of standard object ";
                return [4 /*yield*/, utils_1.safeApiName(objectType)];
            case 1: return [2 /*return*/, (_b.detailedMessage = _a + (_c.sent()) + " through the API is forbidden. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058127-creation-deletion-of-standard-field-object-is-not-allowed",
                    _b)
                /**
                 * It is forbidden to add/remove standard fields or objects.
                 */
            ];
        }
    });
}); };
/**
 * It is forbidden to add/remove standard fields or objects.
 */
var changeValidator = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var standardFieldChanges, additionOrRemovalCustomObjectChanges, addedOrDeletedCustomObjects, isFieldOfAddedOrDeletedCustomObject, standardObjectChanges, standardFieldAdditionErrors, standardObjectAdditionErrors, standardFieldRemovalErrors, standardObjectRemovalErrors;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(changes)
                    .filter(adapter_api_1.isFieldChange)
                    .filter(isCustomFieldChange)
                    .filter(function (field) { return __awaiter(void 0, void 0, void 0, function () { var _a; var _b; return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _a = transformer_1.isCustom;
                            return [4 /*yield*/, utils_1.safeApiName(adapter_api_1.getChangeData(field))];
                        case 1: return [2 /*return*/, !_a.apply(void 0, [(_b = _c.sent()) !== null && _b !== void 0 ? _b : ''])];
                    }
                }); }); })
                    .toArray()];
            case 1:
                standardFieldChanges = _a.sent();
                return [4 /*yield*/, awu(changes)
                        .filter(adapter_api_1.isAdditionOrRemovalChange)
                        .filter(adapter_api_1.isObjectTypeChange)
                        .filter(isCustomObjectChange)
                        .toArray()];
            case 2:
                additionOrRemovalCustomObjectChanges = _a.sent();
                return [4 /*yield*/, awu(additionOrRemovalCustomObjectChanges)
                        .map(adapter_api_1.getChangeData)
                        .toArray()];
            case 3:
                addedOrDeletedCustomObjects = _a.sent();
                isFieldOfAddedOrDeletedCustomObject = function (field) { return (addedOrDeletedCustomObjects.some(function (customObject) { return Object.values(customObject.fields).includes(field); })); };
                return [4 /*yield*/, awu(additionOrRemovalCustomObjectChanges)
                        .filter(function (obj) { return __awaiter(void 0, void 0, void 0, function () { var _a; var _b; return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _a = transformer_1.isCustom;
                                return [4 /*yield*/, utils_1.safeApiName(adapter_api_1.getChangeData(obj))];
                            case 1: return [2 /*return*/, !_a.apply(void 0, [(_b = _c.sent()) !== null && _b !== void 0 ? _b : ''])];
                        }
                    }); }); })
                        .toArray()];
            case 4:
                standardObjectChanges = _a.sent();
                return [4 /*yield*/, awu(standardFieldChanges)
                        .filter(adapter_api_1.isAdditionChange)
                        .map(adapter_api_1.getChangeData)
                        // We only want to create an error for fields that are not part of an added CustomObject type, since the error
                        // will already be on their parent CustomObject change. This should also avoid blocking valid addition changes
                        // in case the Field parent CustomObject was added.
                        .filter(function (field) { return !isFieldOfAddedOrDeletedCustomObject(field); })
                        .map(createFieldAdditionChangeError)
                        .toArray()];
            case 5:
                standardFieldAdditionErrors = _a.sent();
                return [4 /*yield*/, awu(standardObjectChanges)
                        .filter(adapter_api_1.isAdditionChange)
                        .map(adapter_api_1.getChangeData)
                        .map(createObjectAdditionChangeError)
                        .toArray()];
            case 6:
                standardObjectAdditionErrors = _a.sent();
                return [4 /*yield*/, awu(standardFieldChanges)
                        .filter(adapter_api_1.isRemovalChange)
                        .map(adapter_api_1.getChangeData)
                        // We only want to create an error for fields that are not part of a deleted CustomObject type, since the error
                        // will already be on their parent CustomObject change. This should also avoid blocking valid deletion changes
                        // in case the Field parent CustomObject was deleted.
                        .filter(function (field) { return !isFieldOfAddedOrDeletedCustomObject(field); })
                        .map(createFieldRemovalChangeError)
                        .toArray()];
            case 7:
                standardFieldRemovalErrors = _a.sent();
                return [4 /*yield*/, awu(standardObjectChanges)
                        .filter(adapter_api_1.isRemovalChange)
                        .map(adapter_api_1.getChangeData)
                        .map(createObjectRemovalChangeError)
                        .toArray()];
            case 8:
                standardObjectRemovalErrors = _a.sent();
                return [2 /*return*/, __spreadArrays(standardFieldAdditionErrors, standardObjectAdditionErrors, standardFieldRemovalErrors, standardObjectRemovalErrors)];
        }
    });
}); };
exports["default"] = changeValidator;
