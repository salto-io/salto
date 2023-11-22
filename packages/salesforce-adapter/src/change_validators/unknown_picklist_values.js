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
var adapter_api_1 = require("@salto-io/adapter-api");
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var isDefined = lowerdash_1.values.isDefined;
var awu = lowerdash_1.collections.asynciterable.awu;
var isValueSetValue = function (value) { return (lodash_1["default"].isArray(value) && value.every(function (entry) { return lodash_1["default"].isString(entry[constants_1.INSTANCE_FULL_NAME_FIELD]); })); };
var isGlobalValueSetValue = function (value) { return (isValueSetValue(lodash_1["default"].get(value, 'customValue'))); };
var getGlobalValueSetValue = function (field) {
    var valueSetName = field.annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME];
    if (!adapter_api_1.isReferenceExpression(valueSetName)) {
        return undefined;
    }
    var globalValueSetInstance = valueSetName.value;
    return adapter_api_1.isInstanceElement(globalValueSetInstance) && isGlobalValueSetValue(globalValueSetInstance.value)
        ? globalValueSetInstance.value
        : undefined;
};
var getAllowedValues = function (field) {
    var valueSet = field.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET];
    // ValueSet
    if (isValueSetValue(valueSet)) {
        return valueSet.map(function (entry) { return entry[constants_1.INSTANCE_FULL_NAME_FIELD]; });
    }
    // GlobalValueSet
    var globalValueSetValue = getGlobalValueSetValue(field);
    if (globalValueSetValue !== undefined) {
        return globalValueSetValue.customValue.map(function (entry) { return entry[constants_1.INSTANCE_FULL_NAME_FIELD]; });
    }
    return undefined;
};
var createUnknownPicklistValueChangeError = function (instance, field, unknownValue, allowedValues) { return ({
    elemID: instance.elemID,
    message: "Unknown picklist value \"" + unknownValue + "\" on field " + field.elemID.name,
    detailedMessage: "Unknown picklist value \"" + unknownValue + "\" on " + instance.elemID.getFullName() + "." + field.elemID.name + ", Supported values are " + adapter_utils_1.safeJsonStringify(allowedValues) + ". You can learn more about this deployment preview error here: https://help.salto.io/en/articles/7907887-unknown-picklist-value",
    severity: 'Warning',
}); };
var createUnknownPicklistValueChangeErrors = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
    var fields, picklistFieldNames;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, instance.getType()];
            case 1:
                fields = (_a.sent()).fields;
                picklistFieldNames = Object.values(fields)
                    // Only checking picklist fields for now and not multi-picklist fields because multi-picklist
                    // fields require more manipulations
                    .filter(function (field) { return field.refType.elemID.isEqual(transformer_1.Types.primitiveDataTypes.Picklist.elemID); })
                    .map(function (field) { return field.name; });
                return [2 /*return*/, picklistFieldNames
                        .map(function (picklistFieldName) {
                        var field = fields[picklistFieldName];
                        var fieldValue = instance.value[picklistFieldName];
                        if (fieldValue === undefined) {
                            return undefined;
                        }
                        var allowedValues = getAllowedValues(field);
                        return allowedValues !== undefined && !allowedValues.includes(fieldValue)
                            ? createUnknownPicklistValueChangeError(instance, field, fieldValue, allowedValues)
                            : undefined;
                    })
                        .filter(isDefined)];
        }
    });
}); };
var changeValidator = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (awu(changes)
                .filter(adapter_api_1.isInstanceChange)
                .filter(adapter_api_1.isAdditionOrModificationChange)
                .map(adapter_api_1.getChangeData)
                .flatMap(createUnknownPicklistValueChangeErrors)
                .toArray())];
    });
}); };
exports["default"] = changeValidator;
