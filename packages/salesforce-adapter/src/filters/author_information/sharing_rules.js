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
exports.WARNING_MESSAGE = void 0;
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
var logging_1 = require("@salto-io/logging");
var lodash_1 = require("lodash");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../../constants");
var transformer_1 = require("../../transformers/transformer");
var utils_1 = require("../utils");
var isDefined = lowerdash_1.values.isDefined;
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
var SHARING_RULES_API_NAMES = ['SharingCriteriaRule', 'SharingGuestRule', 'SharingOwnerRule'];
var isSharingRulesInstance = utils_1.isInstanceOfType(constants_1.SHARING_RULES_TYPE);
var getRuleObjectName = function (fileProperties) {
    return fileProperties.fullName.split('.')[0];
};
var getSharingRulesFileProperties = function (client) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, result, errors;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, client.listMetadataObjects(SHARING_RULES_API_NAMES.map(function (ruleType) { return ({ type: ruleType }); }))];
            case 1:
                _a = _b.sent(), result = _a.result, errors = _a.errors;
                if (errors && errors.length > 0) {
                    log.warn("Encountered errors while listing file properties for SharingRules: " + errors);
                }
                return [2 /*return*/, result];
        }
    });
}); };
var fetchAllSharingRules = function (client) { return __awaiter(void 0, void 0, void 0, function () {
    var allRules;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getSharingRulesFileProperties(client)];
            case 1:
                allRules = _a.sent();
                return [2 /*return*/, lodash_1["default"].groupBy(allRules.flat(), function (fileProp) { return getRuleObjectName(fileProp); })];
        }
    });
}); };
var getLastSharingRuleFileProperties = function (sharingRules, sharingRulesMap) {
    var rules = lodash_1["default"].sortBy(sharingRulesMap[sharingRules.value.fullName], function (fileProp) { return Date.parse(fileProp.lastModifiedDate); });
    return rules[rules.length - 1];
};
exports.WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.';
/*
 * add author information to sharing rules instances.
 */
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: exports.WARNING_MESSAGE,
            config: config,
            filterName: 'authorInformation',
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var sharingRulesMap, sharingRulesInstances;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, fetchAllSharingRules(client)];
                        case 1:
                            sharingRulesMap = _a.sent();
                            return [4 /*yield*/, (awu(elements)
                                    .filter(adapter_api_1.isInstanceElement)
                                    .filter(isSharingRulesInstance)
                                    .toArray())];
                        case 2:
                            sharingRulesInstances = _a.sent();
                            sharingRulesInstances.forEach(function (sharingRules) {
                                var lastRuleFileProp = getLastSharingRuleFileProperties(sharingRules, sharingRulesMap);
                                if (isDefined(lastRuleFileProp)) {
                                    var ruleAuthorInformation = transformer_1.getAuthorAnnotations(lastRuleFileProp);
                                    delete ruleAuthorInformation[adapter_api_1.CORE_ANNOTATIONS.CREATED_AT];
                                    delete ruleAuthorInformation[adapter_api_1.CORE_ANNOTATIONS.CREATED_BY];
                                    sharingRules.annotate(transformer_1.getAuthorAnnotations(lastRuleFileProp));
                                }
                            });
                            return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filterCreator;
