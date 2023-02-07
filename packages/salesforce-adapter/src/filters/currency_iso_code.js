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
var joi_1 = require("joi");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var currencyCodeType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.CURRENCY_CODE_TYPE_NAME),
    fields: (_a = {},
        _a[constants_1.FIELD_ANNOTATIONS.VALUE_SET] = { refType: new adapter_api_1.ListType(transformer_1.Types.valueSetType) },
        _a),
    isSettings: true,
    path: transformer_1.getTypePath(constants_1.CURRENCY_CODE_TYPE_NAME),
});
var VALUE_SET_SCHEMA = joi_1["default"].object({
    valueSet: joi_1["default"].array().items((_b = {},
        _b[constants_1.CUSTOM_VALUE.FULL_NAME] = joi_1["default"].string().required(),
        _b[constants_1.CUSTOM_VALUE.DEFAULT] = joi_1["default"].boolean().required(),
        _b[constants_1.CUSTOM_VALUE.LABEL] = joi_1["default"].string().required(),
        _b[constants_1.CUSTOM_VALUE.IS_ACTIVE] = joi_1["default"].boolean().required(),
        _b)).required(),
}).unknown(true).required();
var isTypeWithCurrencyIsoCode = function (elem) {
    var _a;
    if (!Object.prototype.hasOwnProperty.call(elem.fields, constants_1.CURRENCY_ISO_CODE)) {
        return false;
    }
    var error = VALUE_SET_SCHEMA.validate((_a = elem.fields[constants_1.CURRENCY_ISO_CODE]) === null || _a === void 0 ? void 0 : _a.annotations).error;
    return error === undefined;
};
var transformCurrencyIsoCodes = function (element, currencyCodeInstance) {
    var currencyIsoCodesRef = new adapter_api_1.ReferenceExpression(currencyCodeInstance.elemID, currencyCodeInstance);
    delete element.fields.CurrencyIsoCode.annotations.valueSet;
    element.fields.CurrencyIsoCode.annotations.valueSetName = currencyIsoCodesRef;
};
var createCurrencyCodesInstance = function (supportedCurrencies) {
    var _a;
    return (new adapter_api_1.InstanceElement(adapter_api_1.ElemID.CONFIG_NAME, currencyCodeType, (_a = {}, _a[constants_1.FIELD_ANNOTATIONS.VALUE_SET] = supportedCurrencies, _a), [constants_1.SALESFORCE, constants_1.RECORDS_PATH, constants_1.SETTINGS_PATH, currencyCodeType.elemID.name]));
};
/**
 * Build a global list of available currency code, and a replace all the explicit ValueSets
 * with ValueSetName which points to it
 */
var filterCreator = function () { return ({
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        var affectedElements, currencyCodeInstance;
        return __generator(this, function (_a) {
            affectedElements = elements.filter(adapter_api_1.isObjectType).filter(isTypeWithCurrencyIsoCode);
            if (affectedElements.length === 0) {
                return [2 /*return*/];
            }
            currencyCodeInstance = createCurrencyCodesInstance(affectedElements[0].fields.CurrencyIsoCode.annotations.valueSet);
            elements.push(currencyCodeType, currencyCodeInstance);
            affectedElements.forEach(function (element) { return transformCurrencyIsoCodes(element, currencyCodeInstance); });
            return [2 /*return*/];
        });
    }); },
}); };
exports["default"] = filterCreator;
