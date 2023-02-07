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
exports.makeFilter = void 0;
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
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../transformers/transformer");
var awu = lowerdash_1.collections.asynciterable.awu;
var TYPE_NAME_TO_FIELD_REMOVALS = new Map([
    ['Profile', ['tabVisibilities']],
]);
var removeFieldsFromTypes = function (elements, typeNameToFieldRemovals) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(elements)
                    .filter(adapter_api_1.isObjectType)
                    .forEach(function (type) { return __awaiter(void 0, void 0, void 0, function () {
                    var fieldsToRemove, _a, _b;
                    var _c;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                _b = (_a = typeNameToFieldRemovals).get;
                                return [4 /*yield*/, transformer_1.metadataType(type)];
                            case 1:
                                fieldsToRemove = (_c = _b.apply(_a, [_d.sent()])) !== null && _c !== void 0 ? _c : [];
                                fieldsToRemove.forEach(function (fieldName) { delete type.fields[fieldName]; });
                                return [2 /*return*/];
                        }
                    });
                }); })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var removeValuesFromInstances = function (elements, typeNameToFieldRemovals) { return __awaiter(void 0, void 0, void 0, function () {
    var removeValuesFunc;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                removeValuesFunc = function (_a) {
                    var value = _a.value, field = _a.field;
                    return __awaiter(void 0, void 0, void 0, function () {
                        var fieldParent, fieldsToRemove, _b, _c;
                        var _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    if (!field)
                                        return [2 /*return*/, value];
                                    fieldParent = field.parent;
                                    _c = (_b = typeNameToFieldRemovals).get;
                                    return [4 /*yield*/, transformer_1.metadataType(fieldParent)];
                                case 1:
                                    fieldsToRemove = (_d = _c.apply(_b, [_e.sent()])) !== null && _d !== void 0 ? _d : [];
                                    if (fieldsToRemove.includes(field.name)) {
                                        return [2 /*return*/, undefined];
                                    }
                                    return [2 /*return*/, value];
                            }
                        });
                    });
                };
                return [4 /*yield*/, awu(elements)
                        .filter(adapter_api_1.isInstanceElement)
                        // The below filter is temporary optimization to save calling transformValues for all instances
                        // since TYPE_NAME_TO_FIELD_REMOVALS contains currently only top level types
                        .filter(function (inst) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _b = (_a = typeNameToFieldRemovals).has;
                                return [4 /*yield*/, transformer_1.metadataType(inst)];
                            case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                        }
                    }); }); })
                        .forEach(function (inst) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b;
                        var _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _a = inst;
                                    _b = adapter_utils_1.transformValues;
                                    _c = {
                                        values: inst.value
                                    };
                                    return [4 /*yield*/, inst.getType()];
                                case 1: return [4 /*yield*/, _b.apply(void 0, [(_c.type = _d.sent(),
                                            _c.transformFunc = removeValuesFunc,
                                            _c.strict = false,
                                            _c.allowEmpty = true,
                                            _c.pathID = inst.elemID,
                                            _c)])];
                                case 2:
                                    _a.value = (_d.sent()) || inst.value;
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
/**
 * Declare the remove field and values filter, this filter removes fields from ObjectTypes and
 * their corresponding instances upon fetch.
 * */
var makeFilter = function (typeNameToFieldRemovals) { return function () { return ({
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, removeValuesFromInstances(elements, typeNameToFieldRemovals)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, removeFieldsFromTypes(elements, typeNameToFieldRemovals)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
}); }; };
exports.makeFilter = makeFilter;
exports["default"] = exports.makeFilter(TYPE_NAME_TO_FIELD_REMOVALS);
