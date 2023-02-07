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
var _a, _b;
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
var logging_1 = require("@salto-io/logging");
var lodash_1 = require("lodash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var constants_1 = require("../../constants");
var transformer_1 = require("../../transformers/transformer");
var utils_1 = require("../utils");
var log = logging_1.logger(module);
var _c = lowerdash_1.collections.asynciterable, awu = _c.awu, keyByAsync = _c.keyByAsync;
var REFERENCABLE_FIELD_NAMES = [
    constants_1.CPQ_FILTER_SOURCE_FIELD,
    constants_1.CPQ_HIDDEN_SOURCE_FIELD,
    constants_1.CPQ_TARGET_FIELD,
];
var SERVICE_TO_CPQ_API_NAME = {
    Product: 'Product2',
    Quote: constants_1.CPQ_QUOTE,
    Subscription: constants_1.CPQ_SUBSCRIPTION,
};
var CPQ_TO_SERVICE_API_NAME = (_a = {
        Product2: 'Product'
    },
    _a[constants_1.CPQ_QUOTE] = 'Quote',
    _a[constants_1.CPQ_SUBSCRIPTION] = 'Subscription',
    _a);
var REFERENCABLE_FIELD_NAME_TO_CONTROLLING_FIELD = (_b = {},
    _b[constants_1.CPQ_FILTER_SOURCE_FIELD] = constants_1.CPQ_FILTER_SOURCE_OBJECT,
    _b[constants_1.CPQ_HIDDEN_SOURCE_FIELD] = constants_1.CPQ_HIDDEN_SOURCE_OBJECT,
    _b[constants_1.CPQ_TARGET_FIELD] = constants_1.CPQ_TARGET_OBJECT,
    _b);
var isCPQInstance = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = utils_1.getNamespace;
                return [4 /*yield*/, instance.getType()];
            case 1: return [4 /*yield*/, _a.apply(void 0, [_b.sent()])];
            case 2: return [2 /*return*/, ((_b.sent()) === constants_1.CPQ_NAMESPACE)];
        }
    });
}); };
var getCPQObjectApiName = function (serviceApiName) {
    var _a;
    return ((_a = SERVICE_TO_CPQ_API_NAME[serviceApiName]) !== null && _a !== void 0 ? _a : serviceApiName);
};
var setReferences = function (_a, referencableFieldName, customObjectsByApiName) {
    var value = _a.value;
    return __awaiter(void 0, void 0, void 0, function () {
        var controllingFieldName, objectApiName, fieldApiName, referencedObject, referencedField;
        return __generator(this, function (_b) {
            controllingFieldName = REFERENCABLE_FIELD_NAME_TO_CONTROLLING_FIELD[referencableFieldName];
            if (value[referencableFieldName] === undefined || value[controllingFieldName] === undefined) {
                return [2 /*return*/];
            }
            objectApiName = getCPQObjectApiName(value[controllingFieldName]);
            fieldApiName = value[referencableFieldName];
            referencedObject = customObjectsByApiName[objectApiName];
            if (referencedObject === undefined) {
                log.warn('Could not find CustomObject with apiName: %s.', objectApiName);
                return [2 /*return*/];
            }
            value[controllingFieldName] = new adapter_api_1.ReferenceExpression(referencedObject.elemID);
            referencedField = referencedObject.fields[fieldApiName];
            if (referencedField === undefined) {
                log.warn('Could not find field %s on type %s.', fieldApiName, objectApiName);
                return [2 /*return*/];
            }
            value[referencableFieldName] = new adapter_api_1.ReferenceExpression(referencedField.elemID);
            return [2 /*return*/];
        });
    });
};
var setCustomFieldReferences = function (instance, customObjectByApiName) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(REFERENCABLE_FIELD_NAMES).forEach(function (referencableFieldName) {
                    return setReferences(instance, referencableFieldName, customObjectByApiName);
                })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var isRelatedChange = function (change) {
    var instance = adapter_api_1.getChangeData(change);
    var instanceFieldNames = Object.keys(instance.value);
    return instanceFieldNames
        .some(function (fieldName) { return REFERENCABLE_FIELD_NAMES.includes(fieldName); });
};
var getServiceObjectApiName = function (cpqApiName) {
    var _a;
    var actualCPQApiName = transformer_1.relativeApiName(cpqApiName);
    return (_a = CPQ_TO_SERVICE_API_NAME[actualCPQApiName]) !== null && _a !== void 0 ? _a : actualCPQApiName;
};
var createDeployableInstance = function (instance) {
    var deployableInstance = instance.clone();
    var value = deployableInstance.value;
    REFERENCABLE_FIELD_NAMES.forEach(function (referencableFieldName) {
        var controllingFieldName = REFERENCABLE_FIELD_NAME_TO_CONTROLLING_FIELD[referencableFieldName];
        if (value[referencableFieldName] === undefined || value[controllingFieldName] === undefined) {
            return;
        }
        value[controllingFieldName] = getServiceObjectApiName(value[controllingFieldName]);
        value[referencableFieldName] = getServiceObjectApiName(value[referencableFieldName]);
    });
    return deployableInstance;
};
var filter = function () {
    var originalChangesByFullName;
    return {
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var customObjects, customObjectsByApiName;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(elements)
                            .filter(adapter_api_1.isObjectType)
                            .filter(transformer_1.isCustomObject)
                            .toArray()];
                    case 1:
                        customObjects = _a.sent();
                        return [4 /*yield*/, keyByAsync(customObjects, transformer_1.apiName)];
                    case 2:
                        customObjectsByApiName = _a.sent();
                        return [4 /*yield*/, awu(elements)
                                .filter(adapter_api_1.isInstanceElement)
                                .filter(isCPQInstance)
                                .forEach(function (instance) { return setCustomFieldReferences(instance, customObjectsByApiName); })];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var relatedChanges, deployableChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        relatedChanges = changes
                            .filter(adapter_api_1.isInstanceChange)
                            .filter(adapter_api_1.isAdditionOrModificationChange)
                            .filter(isRelatedChange);
                        originalChangesByFullName = lodash_1["default"].keyBy(relatedChanges, function (c) { return adapter_api_1.getChangeData(c).elemID.getFullName(); });
                        return [4 /*yield*/, awu(relatedChanges)
                                .map(function (change) { return adapter_utils_1.applyFunctionToChangeData(change, createDeployableInstance); })
                                .toArray()];
                    case 1:
                        deployableChanges = _a.sent();
                        lodash_1["default"].pullAll(changes, relatedChanges);
                        deployableChanges.forEach(function (deployableChange) { return changes.push(deployableChange); });
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var appliedChangesByFullName, relatedAppliedChanges;
            return __generator(this, function (_a) {
                appliedChangesByFullName = lodash_1["default"].keyBy(changes.filter(adapter_api_1.isInstanceChange), function (change) { return adapter_api_1.getChangeData(change).elemID.getFullName(); });
                relatedAppliedChanges = lodash_1["default"].pick(appliedChangesByFullName, Object.keys(originalChangesByFullName));
                // Enrich the original changes with any extra data from the applied changes (e.g. Id, OwnerId etc...)
                Object.entries(originalChangesByFullName)
                    .forEach(function (_a) {
                    var changeApiName = _a[0], originalChange = _a[1];
                    var appliedChange = appliedChangesByFullName[changeApiName];
                    if (appliedChange === undefined) {
                        return;
                    }
                    var appliedInstanceValue = adapter_api_1.getChangeData(appliedChange).value;
                    var originalInstance = adapter_api_1.getChangeData(originalChange);
                    var originalInstanceValue = originalInstance.value;
                    originalInstance.value = __assign(__assign(__assign({}, originalInstanceValue), appliedInstanceValue), lodash_1["default"].pick(originalInstanceValue, lodash_1["default"].flatten(Object.entries(REFERENCABLE_FIELD_NAME_TO_CONTROLLING_FIELD))));
                });
                lodash_1["default"].pullAll(changes, Object.values(relatedAppliedChanges));
                Object.values(originalChangesByFullName).forEach(function (change) { return changes.push(change); });
                return [2 /*return*/];
            });
        }); },
    };
};
exports["default"] = filter;
