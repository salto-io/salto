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
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var utils_1 = require("../utils");
var constants_1 = require("../../constants");
var transformer_1 = require("../../transformers/transformer");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
var refListFieldNames = [
    constants_1.CPQ_CONSUMPTION_RATE_FIELDS, constants_1.CPQ_CONSUMPTION_SCHEDULE_FIELDS, constants_1.CPQ_GROUP_FIELDS,
    constants_1.CPQ_QUOTE_FIELDS, constants_1.CPQ_QUOTE_LINE_FIELDS,
];
var listOfText = new adapter_api_1.ListType(transformer_1.Types.primitiveDataTypes.Text);
var fieldTypeFromTextListToLongText = function (field) { return __awaiter(void 0, void 0, void 0, function () {
    var fieldType;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, field.getType()];
            case 1:
                fieldType = _a.sent();
                if (adapter_api_1.isListType(fieldType) && fieldType.isEqual(listOfText)) {
                    field.refType = adapter_api_1.createRefToElmWithValue(transformer_1.Types.primitiveDataTypes.LongTextArea);
                }
                return [2 /*return*/, field];
        }
    });
}); };
var fieldTypeFromLongTextToTextList = function (field) { return __awaiter(void 0, void 0, void 0, function () {
    var fieldType;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, field.getType()];
            case 1:
                fieldType = _a.sent();
                if (adapter_api_1.isPrimitiveType(fieldType)
                    && fieldType.isEqual(transformer_1.Types.primitiveDataTypes.LongTextArea)) {
                    field.refType = adapter_api_1.createRefToElmWithValue(listOfText);
                }
                return [2 /*return*/, field];
        }
    });
}); };
var refListFieldsToLongText = function (cpqCustomScriptObject) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(Object.values(cpqCustomScriptObject.fields))
                    .filter(function (field) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _b = (_a = refListFieldNames).includes;
                            return [4 /*yield*/, transformer_1.apiName(field, true)];
                        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                    }
                }); }); })
                    .forEach(fieldTypeFromTextListToLongText)];
            case 1:
                _a.sent();
                return [2 /*return*/, cpqCustomScriptObject];
        }
    });
}); };
var refListFieldsToTextLists = function (cpqCustomScriptObject) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(Object.values(cpqCustomScriptObject.fields))
                    .filter(function (field) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _b = (_a = refListFieldNames).includes;
                            return [4 /*yield*/, transformer_1.apiName(field, true)];
                        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                    }
                }); }); })
                    .forEach(fieldTypeFromLongTextToTextList)];
            case 1:
                _a.sent();
                return [2 /*return*/, cpqCustomScriptObject];
        }
    });
}); };
var refListValuesToArray = function (cpqCustomScriptInstance) {
    refListFieldNames.forEach(function (fieldName) {
        var fieldValue = cpqCustomScriptInstance.value[fieldName];
        if (lodash_1["default"].isString(fieldValue)) {
            cpqCustomScriptInstance.value[fieldName] = fieldValue.split(/\r?\n/);
        }
    });
    return cpqCustomScriptInstance;
};
var codeValueToFile = function (cpqCustomScriptInstance) {
    var _a;
    if (lodash_1["default"].isString(cpqCustomScriptInstance.value[constants_1.CPQ_CODE_FIELD])) {
        cpqCustomScriptInstance.value[constants_1.CPQ_CODE_FIELD] = new adapter_api_1.StaticFile({
            filepath: ((_a = cpqCustomScriptInstance.path) !== null && _a !== void 0 ? _a : []).join('/') + ".js",
            content: Buffer.from(cpqCustomScriptInstance.value[constants_1.CPQ_CODE_FIELD]),
            encoding: 'utf-8',
        });
    }
    return cpqCustomScriptInstance;
};
var transformInstanceToSFValues = function (cpqCustomScriptInstance) {
    refListFieldNames.forEach(function (fieldName) {
        var fieldValue = cpqCustomScriptInstance.value[fieldName];
        if (Array.isArray(fieldValue) && fieldValue.every(lodash_1["default"].isString)) {
            cpqCustomScriptInstance.value[fieldName] = fieldValue.join('\n');
        }
    });
    return cpqCustomScriptInstance;
};
var isInstanceOfCustomScript = function (element) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _b = adapter_api_1.isInstanceElement(element);
                if (!_b) return [3 /*break*/, 2];
                return [4 /*yield*/, transformer_1.isInstanceOfCustomObject(element)];
            case 1:
                _b = (_d.sent());
                _d.label = 2;
            case 2:
                _a = _b;
                if (!_a) return [3 /*break*/, 5];
                _c = transformer_1.apiName;
                return [4 /*yield*/, element.getType()];
            case 3: return [4 /*yield*/, _c.apply(void 0, [_d.sent()])];
            case 4:
                _a = (_d.sent()) === constants_1.CPQ_CUSTOM_SCRIPT;
                _d.label = 5;
            case 5: return [2 /*return*/, (_a)];
        }
    });
}); };
var isCustomScriptType = function (objType) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
    switch (_b.label) {
        case 0: return [4 /*yield*/, transformer_1.isCustomObject(objType)];
        case 1:
            _a = (_b.sent());
            if (!_a) return [3 /*break*/, 3];
            return [4 /*yield*/, transformer_1.apiName(objType)];
        case 2:
            _a = (_b.sent()) === constants_1.CPQ_CUSTOM_SCRIPT;
            _b.label = 3;
        case 3: return [2 /*return*/, _a];
    }
}); }); };
var getCustomScriptObjectChange = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, awu(changes)
                .filter(adapter_api_1.isObjectTypeChange)
                .find(function (change) { return isCustomScriptType(adapter_api_1.getChangeData(change)); })];
    });
}); };
var applyFuncOnCustomScriptInstanceChanges = function (changes, fn) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(changes)
                    .filter(utils_1.isInstanceOfTypeChange(constants_1.CPQ_CUSTOM_SCRIPT))
                    .forEach(function (customScriptInstanceChange) { return adapter_utils_1.applyFunctionToChangeData(customScriptInstanceChange, fn); })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var applyFuncOnCustomScriptObjectChange = function (changes, fn) { return __awaiter(void 0, void 0, void 0, function () {
    var customScriptObjectChange;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getCustomScriptObjectChange(changes)];
            case 1:
                customScriptObjectChange = _a.sent();
                if (!(customScriptObjectChange !== undefined)) return [3 /*break*/, 3];
                return [4 /*yield*/, adapter_utils_1.applyFunctionToChangeData(customScriptObjectChange, fn)];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); };
var applyFuncOnCustomScriptFieldChange = function (changes, fn) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(changes)
                    .filter(adapter_api_1.isFieldChange)
                    .filter(function (change) { return isCustomScriptType(adapter_api_1.getChangeData(change).parent); })
                    .filter(function (change) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _b = (_a = refListFieldNames).includes;
                            return [4 /*yield*/, transformer_1.apiName(adapter_api_1.getChangeData(change), true)];
                        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                    }
                }); }); })
                    .forEach(function (change) { return adapter_utils_1.applyFunctionToChangeData(change, fn); })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var filter = function () { return ({
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        var customObjects, cpqCustomScriptObject, cpqCustomScriptInstances;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, awu(elements).filter(transformer_1.isCustomObject).toArray()];
                case 1:
                    customObjects = _a.sent();
                    return [4 /*yield*/, awu(customObjects)
                            .find(function (obj) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, transformer_1.apiName(obj)];
                                case 1: return [2 /*return*/, (_a.sent()) === constants_1.CPQ_CUSTOM_SCRIPT];
                            }
                        }); }); })];
                case 2:
                    cpqCustomScriptObject = _a.sent();
                    if (cpqCustomScriptObject === undefined) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, refListFieldsToTextLists(cpqCustomScriptObject)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, awu(elements)
                            .filter(isInstanceOfCustomScript)
                            .toArray()];
                case 4:
                    cpqCustomScriptInstances = _a.sent();
                    log.debug("Transforming " + cpqCustomScriptInstances.length + " instances of SBQQ__CustomScript");
                    cpqCustomScriptInstances.forEach(function (instance, index) {
                        refListValuesToArray(instance);
                        codeValueToFile(instance);
                        if (index % 100 === 0) {
                            log.debug("Transformed " + index + " instances of SBQQ__CustomScript");
                        }
                    });
                    return [2 /*return*/];
            }
        });
    }); },
    preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        var addOrModifyChanges;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    addOrModifyChanges = changes.filter(adapter_api_1.isAdditionOrModificationChange);
                    return [4 /*yield*/, applyFuncOnCustomScriptInstanceChanges(addOrModifyChanges, transformInstanceToSFValues)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, applyFuncOnCustomScriptObjectChange(
                        // Fields are taken from object changes only when the object is added
                        addOrModifyChanges.filter(adapter_api_1.isAdditionChange), refListFieldsToLongText)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, applyFuncOnCustomScriptFieldChange(addOrModifyChanges, fieldTypeFromTextListToLongText)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        var addOrModifyChanges;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    addOrModifyChanges = changes.filter(adapter_api_1.isAdditionOrModificationChange);
                    return [4 /*yield*/, applyFuncOnCustomScriptInstanceChanges(addOrModifyChanges, refListValuesToArray)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, applyFuncOnCustomScriptObjectChange(
                        // Fields are taken from object changes only when the object is added
                        addOrModifyChanges.filter(adapter_api_1.isAdditionChange), refListFieldsToTextLists)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, applyFuncOnCustomScriptFieldChange(addOrModifyChanges, fieldTypeFromLongTextToTextList)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
}); };
exports["default"] = filter;
