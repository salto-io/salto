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
var _a;
exports.__esModule = true;
exports.SORT_ORDER = void 0;
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
var joi_1 = require("joi");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var constants_1 = require("../constants");
var utils_1 = require("../filters/utils");
var awu = lowerdash_1.collections.asynciterable.awu;
exports.SORT_ORDER = 'sortOrder';
var DUPLICATE_RULE_INSTANCE_SCHEMA = joi_1["default"].object({
    value: joi_1["default"].object((_a = {},
        _a[constants_1.INSTANCE_FULL_NAME_FIELD] = joi_1["default"].string().required(),
        _a[exports.SORT_ORDER] = joi_1["default"].number().required(),
        _a)).unknown(true).required(),
}).unknown(true).required();
var isValidDuplicateRuleInstance = adapter_utils_1.createSchemeGuard(DUPLICATE_RULE_INSTANCE_SCHEMA);
var getRelatedObjectName = function (instance) { return (instance.value[constants_1.INSTANCE_FULL_NAME_FIELD].split('.')[0]); };
var createSortOrderError = function (instance, objectName, order) { return ({
    elemID: instance.elemID,
    severity: 'Error',
    message: "Duplicate rule instances for " + objectName + " must be in sequential order.",
    detailedMessage: "Please set or update the order of the instances while making sure it starts from 1 and always increases by 1 (gaps are not allowed). Order is: " + order + ". You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8032257-duplicate-rules-must-be-in-sequential-order",
}); };
/**
 * Validates the values in the array are in sequential order starting from 1.
 */
var isInvalidSortOrder = function (sortOrders) { return (sortOrders
    .sort()
    .some(function (sortOrder, index) { return sortOrder !== index + 1; })); };
var changeValidator = function (changes, elementsSource) { return __awaiter(void 0, void 0, void 0, function () {
    var relatedChangesByObjectName, _a, _b, x, _c, duplicateRuleInstances, relevantDuplicateRuleInstancesByObjectName, invalidSortOrderByObjectName, invalidChangesByObjectName;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                if (elementsSource === undefined) {
                    return [2 /*return*/, []];
                }
                _b = (_a = lodash_1["default"]).groupBy;
                return [4 /*yield*/, awu(changes)
                        .filter(adapter_api_1.isInstanceChange)
                        .filter(adapter_api_1.isAdditionOrModificationChange)
                        .filter(utils_1.isInstanceOfTypeChange(constants_1.DUPLICATE_RULE_METADATA_TYPE))
                        .filter(function (change) { return isValidDuplicateRuleInstance(adapter_api_1.getChangeData(change)); })
                        .toArray()];
            case 1:
                relatedChangesByObjectName = _b.apply(_a, [_d.sent(),
                    function (change) { return getRelatedObjectName(adapter_api_1.getChangeData(change)); }]);
                if (lodash_1["default"].isEmpty(relatedChangesByObjectName)) {
                    return [2 /*return*/, []];
                }
                _c = awu;
                return [4 /*yield*/, elementsSource.getAll()];
            case 2: return [4 /*yield*/, _c.apply(void 0, [_d.sent()])
                    .filter(adapter_api_1.isInstanceElement)
                    .toArray()];
            case 3:
                x = _d.sent();
                return [4 /*yield*/, awu(x)
                        .filter(utils_1.isInstanceOfType(constants_1.DUPLICATE_RULE_METADATA_TYPE))
                        .filter(isValidDuplicateRuleInstance)
                        .toArray()];
            case 4:
                duplicateRuleInstances = _d.sent();
                relevantDuplicateRuleInstancesByObjectName = lodash_1["default"].pick(lodash_1["default"].groupBy(duplicateRuleInstances, getRelatedObjectName), Object.keys(relatedChangesByObjectName));
                invalidSortOrderByObjectName = lodash_1["default"].pickBy(lodash_1["default"].mapValues(relevantDuplicateRuleInstancesByObjectName, function (instances) { return instances.map(function (instance) { return instance.value.sortOrder; }).sort(); }), isInvalidSortOrder);
                invalidChangesByObjectName = lodash_1["default"].pick(relatedChangesByObjectName, Object.keys(invalidSortOrderByObjectName));
                return [2 /*return*/, Object.entries(invalidChangesByObjectName)
                        .flatMap(function (_a) {
                        var objectName = _a[0], invalidChanges = _a[1];
                        return invalidChanges
                            .map(adapter_api_1.getChangeData)
                            .map(function (instance) { return createSortOrderError(instance, objectName, invalidSortOrderByObjectName[objectName]); });
                    })];
        }
    });
}); };
exports["default"] = changeValidator;
