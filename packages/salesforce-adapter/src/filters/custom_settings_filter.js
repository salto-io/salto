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
exports.isListCustomSettingsObject = void 0;
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
var lodash_1 = require("lodash");
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../transformers/transformer");
var custom_objects_instances_1 = require("./custom_objects_instances");
var constants_1 = require("../constants");
var data_management_1 = require("../fetch_profile/data_management");
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, keyByAsync = _a.keyByAsync;
var log = logging_1.logger(module);
var isListCustomSettingsObject = function (obj) { return (transformer_1.isCustomSettingsObject(obj)
    && obj.annotations[constants_1.CUSTOM_SETTINGS_TYPE] === constants_1.LIST_CUSTOM_SETTINGS_TYPE); };
exports.isListCustomSettingsObject = isListCustomSettingsObject;
var logInvalidCustomSettings = function (invalidCustomSettings) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (awu(invalidCustomSettings).forEach(function (settings) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b, _c; return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _b = (_a = log).debug;
                        _c = "Did not fetch instances for Custom Setting - ";
                        return [4 /*yield*/, transformer_1.apiName(settings.objectType)];
                    case 1: return [2 /*return*/, (_b.apply(_a, [_c + (_d.sent()) + " cause " + settings.invalidIdFields + " do not exist or are not queryable"]))];
                }
            }); }); }))];
    });
}); };
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var customSettingsObjects, customSettingsObjectNames, customSettingsFetchSettings, _a, validFetchSettings, invalidFetchSettings, customSettingsMap, _b, instances, configChangeSuggestions;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!config.fetchProfile.shouldFetchAllCustomSettings()) {
                            return [2 /*return*/, {}];
                        }
                        customSettingsObjects = elements
                            .filter(adapter_api_1.isObjectType)
                            .filter(exports.isListCustomSettingsObject);
                        return [4 /*yield*/, awu(customSettingsObjects)
                                .map(function (customSetting) { return transformer_1.apiName(customSetting); })
                                .toArray()];
                    case 1:
                        customSettingsObjectNames = _c.sent();
                        return [4 /*yield*/, custom_objects_instances_1.getCustomObjectsFetchSettings(customSettingsObjects, data_management_1.buildDataManagement({
                                includeObjects: customSettingsObjectNames,
                                saltoIDSettings: {
                                    defaultIdFields: ['Name'],
                                },
                            }))];
                    case 2:
                        customSettingsFetchSettings = _c.sent();
                        _a = lodash_1["default"].partition(customSettingsFetchSettings, function (setting) { return setting.invalidIdFields === undefined; }), validFetchSettings = _a[0], invalidFetchSettings = _a[1];
                        return [4 /*yield*/, logInvalidCustomSettings(invalidFetchSettings)];
                    case 3:
                        _c.sent();
                        return [4 /*yield*/, keyByAsync(validFetchSettings, function (obj) { return transformer_1.apiName(obj.objectType); })];
                    case 4:
                        customSettingsMap = _c.sent();
                        return [4 /*yield*/, custom_objects_instances_1.getAllInstances(client, customSettingsMap)];
                    case 5:
                        _b = _c.sent(), instances = _b.instances, configChangeSuggestions = _b.configChangeSuggestions;
                        elements.push.apply(elements, instances);
                        return [2 /*return*/, {
                                configSuggestions: __spreadArrays(configChangeSuggestions),
                            }];
                }
            });
        }); },
    });
};
exports["default"] = filterCreator;
