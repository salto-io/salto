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
exports.getChangeGroupIds = void 0;
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
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var wu_1 = require("wu");
var custom_object_instances_deploy_1 = require("./custom_object_instances_deploy");
var utils_1 = require("./filters/utils");
var constants_1 = require("./constants");
var awu = lowerdash_1.collections.asynciterable.awu;
var getGroupId = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, typeName, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = !adapter_api_1.isInstanceChange(change);
                if (_a) return [3 /*break*/, 2];
                return [4 /*yield*/, custom_object_instances_deploy_1.isInstanceOfCustomObjectChange(change)];
            case 1:
                _a = !(_d.sent());
                _d.label = 2;
            case 2:
                if (_a) {
                    return [2 /*return*/, 'salesforce_metadata'];
                }
                _b = utils_1.safeApiName;
                return [4 /*yield*/, adapter_api_1.getChangeData(change).getType()];
            case 3: return [4 /*yield*/, _b.apply(void 0, [_d.sent()])];
            case 4:
                typeName = (_c = _d.sent()) !== null && _c !== void 0 ? _c : 'UNKNOWN';
                return [2 /*return*/, change.action + "_" + typeName + "_instances"];
        }
    });
}); };
/**
 * Returns the changes that should be part of the special deploy group for adding sbaa__ApprovalRule
 * instances with sbaa__ConditionsMet = 'Custom' and their corresponding sbaa__ApprovalCondition instances.
 */
var getAddCustomRuleAndConditionGroupChangeIds = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var addedInstancesChanges, customApprovalRuleAdditions, customApprovalRuleElemIds, customApprovalConditionAdditions;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                addedInstancesChanges = wu_1["default"](changes.entries())
                    .filter(function (_a) {
                    var _changeId = _a[0], change = _a[1];
                    return adapter_api_1.isAdditionChange(change);
                })
                    .filter(function (_a) {
                    var _changeId = _a[0], change = _a[1];
                    return adapter_api_1.isInstanceChange(change);
                })
                    .toArray();
                customApprovalRuleAdditions = addedInstancesChanges
                    .filter(function (_a) {
                    var _changeId = _a[0], change = _a[1];
                    return utils_1.isInstanceOfTypeChange(constants_1.SBAA_APPROVAL_RULE)(change);
                })
                    .filter(function (_a) {
                    var _changeId = _a[0], change = _a[1];
                    return adapter_api_1.getChangeData(change).value[constants_1.SBAA_CONDITIONS_MET] === 'Custom';
                });
                customApprovalRuleElemIds = new Set(customApprovalRuleAdditions
                    .map(function (_a) {
                    var _changeId = _a[0], change = _a[1];
                    return adapter_api_1.getChangeData(change).elemID.getFullName();
                }));
                return [4 /*yield*/, awu(addedInstancesChanges)
                        .filter(function (_a) {
                        var _changeId = _a[0], change = _a[1];
                        return utils_1.isInstanceOfTypeChange(constants_1.SBAA_APPROVAL_CONDITION)(change);
                    })
                        .filter(function (_a) {
                        var _changeId = _a[0], change = _a[1];
                        var approvalRule = adapter_api_1.getChangeData(change).value[constants_1.SBAA_APPROVAL_RULE];
                        return adapter_api_1.isReferenceExpression(approvalRule) && customApprovalRuleElemIds.has(approvalRule.elemID.getFullName());
                    })
                        .toArray()];
            case 1:
                customApprovalConditionAdditions = _a.sent();
                return [2 /*return*/, new Set(customApprovalRuleAdditions
                        .concat(customApprovalConditionAdditions)
                        .map(function (_a) {
                        var changeId = _a[0];
                        return changeId;
                    }))];
        }
    });
}); };
var getChangeGroupIds = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var changeGroupIdMap, customApprovalRuleAndConditionChangeIds;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                changeGroupIdMap = new Map();
                return [4 /*yield*/, getAddCustomRuleAndConditionGroupChangeIds(changes)];
            case 1:
                customApprovalRuleAndConditionChangeIds = _a.sent();
                return [4 /*yield*/, awu(changes.entries())
                        .forEach(function (_a) {
                        var changeId = _a[0], change = _a[1];
                        return __awaiter(void 0, void 0, void 0, function () {
                            var groupId, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        if (!customApprovalRuleAndConditionChangeIds.has(changeId)) return [3 /*break*/, 1];
                                        _b = constants_1.ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP;
                                        return [3 /*break*/, 3];
                                    case 1: return [4 /*yield*/, getGroupId(change)];
                                    case 2:
                                        _b = _c.sent();
                                        _c.label = 3;
                                    case 3:
                                        groupId = _b;
                                        changeGroupIdMap.set(changeId, groupId);
                                        return [2 /*return*/];
                                }
                            });
                        });
                    })];
            case 2:
                _a.sent();
                return [2 /*return*/, { changeGroupIdMap: changeGroupIdMap }];
        }
    });
}); };
exports.getChangeGroupIds = getChangeGroupIds;
