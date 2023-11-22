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
var utils_1 = require("../filters/utils");
var package_1 = require("./package");
var custom_object_instances_deploy_1 = require("../custom_object_instances_deploy");
var constants_1 = require("../constants");
var awu = lowerdash_1.collections.asynciterable.awu;
var getCpqError = function (elemID) { return ({
    elemID: elemID,
    severity: 'Info',
    message: 'CPQ data changes detected',
    detailedMessage: '',
    deployActions: {
        preAction: {
            title: 'Disable CPQ Triggers',
            description: 'CPQ triggers should be disabled before deploying:',
            subActions: [
                'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
                'Check the "Triggers Disabled" checkbox',
                'Click "Save"',
                'There may also be custom Apex triggers created by your team that fire on events on CPQ objects. If you have such triggers, you may consider disabling them too. Note that Salesforce only allows disabling Apex triggers in sandbox orgs, but your development team may have other mechanisms for disabling them in production, such as custom metadata types. ',
            ],
        },
        postAction: {
            title: 'Re-enable CPQ Triggers',
            description: 'CPQ triggers should now be re-enabled:',
            showOnFailure: true,
            subActions: [
                'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
                'Uncheck the "Triggers Disabled" checkbox',
                'Click "Save"',
                'If you disabled any custom Apex triggers before deploying, re-enable them now',
            ],
        },
    },
}); };
// this changeValidator will return none or a single changeError
var changeValidator = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var cpqInstance;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(changes)
                    .filter(custom_object_instances_deploy_1.isInstanceOfCustomObjectChange)
                    .map(function (change) {
                    return adapter_api_1.getChangeData(change);
                }) // already checked that this is an instance element
                    .find(function (instance) { return __awaiter(void 0, void 0, void 0, function () {
                    var type, _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, instance.getType()];
                            case 1:
                                type = _b.sent();
                                return [4 /*yield*/, package_1.hasNamespace(type)];
                            case 2:
                                _a = (_b.sent());
                                if (!_a) return [3 /*break*/, 4];
                                return [4 /*yield*/, utils_1.getNamespace(type)];
                            case 3:
                                _a = (_b.sent()) === constants_1.CPQ_NAMESPACE;
                                _b.label = 4;
                            case 4: return [2 /*return*/, _a];
                        }
                    });
                }); })];
            case 1:
                cpqInstance = _a.sent();
                return [2 /*return*/, cpqInstance !== undefined ? [getCpqError(cpqInstance.elemID)] : []];
        }
    });
}); };
exports["default"] = changeValidator;
