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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.isActivatingChangeOnly = exports.isActivatingChange = exports.isActiveFlowChange = exports.getFlowStatus = exports.getDeployAsActiveFlag = void 0;
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
var utils_1 = require("../filters/utils");
var lightining_url_resolvers_1 = require("../elements_url_retreiver/lightining_url_resolvers");
var awu = lowerdash_1.collections.asynciterable.awu;
var PREFER_ACTIVE_FLOW_VERSIONS_DEFAULT = false;
var ENABLE_FLOW_DEPLOY_AS_ACTIVE_ENABLED_DEFAULT = false;
var isFlowChange = function (change) { return utils_1.isInstanceOfType(constants_1.FLOW_METADATA_TYPE)(adapter_api_1.getChangeData(change)); };
var getDeployAsActiveFlag = function (elementsSource, defaultValue) { return __awaiter(void 0, void 0, void 0, function () {
    var flowSettings, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!lodash_1.isUndefined(elementsSource)) return [3 /*break*/, 1];
                _a = undefined;
                return [3 /*break*/, 3];
            case 1: return [4 /*yield*/, elementsSource.get(new adapter_api_1.ElemID(constants_1.SALESFORCE, 'FlowSettings', 'instance'))];
            case 2:
                _a = _b.sent();
                _b.label = 3;
            case 3:
                flowSettings = _a;
                return [2 /*return*/, lodash_1.isUndefined(flowSettings)
                        || lodash_1.isUndefined(flowSettings.value.enableFlowDeployAsActiveEnabled)
                        ? defaultValue : flowSettings.value.enableFlowDeployAsActiveEnabled];
        }
    });
}); };
exports.getDeployAsActiveFlag = getDeployAsActiveFlag;
var getFlowStatus = function (instance) { return instance.value[constants_1.STATUS]; };
exports.getFlowStatus = getFlowStatus;
var isActiveFlowChange = function (change) { return (exports.getFlowStatus(change.data.before) === constants_1.ACTIVE && exports.getFlowStatus(change.data.after) === constants_1.ACTIVE); };
exports.isActiveFlowChange = isActiveFlowChange;
var isActivatingChange = function (change) { return (exports.getFlowStatus(change.data.before) !== constants_1.ACTIVE && exports.getFlowStatus(change.data.after) === constants_1.ACTIVE); };
exports.isActivatingChange = isActivatingChange;
var isActivatingChangeOnly = function (change) {
    var beforeClone = change.data.before.clone();
    beforeClone.value[constants_1.STATUS] = constants_1.ACTIVE;
    var diffWithoutStatus = adapter_utils_1.detailedCompare(beforeClone, change.data.after);
    return lodash_1.isEmpty(diffWithoutStatus);
};
exports.isActivatingChangeOnly = isActivatingChangeOnly;
var testCoveragePostDeploy = function (instance) { return ({
    postAction: {
        title: 'Flows test coverage',
        showOnFailure: false,
        subActions: [
            "Please make sure that activation of the new flow version was not blocked due to insufficient test coverage and manually activate it if needed. Flow name: " + instance.elemID.getFullName(),
        ],
    },
}); };
var deployAsInactivePostDeploy = function (instance, baseUrl) {
    var url = instance.annotations[adapter_api_1.CORE_ANNOTATIONS.SERVICE_URL];
    if (url !== undefined) {
        return {
            postAction: {
                title: 'Deploying flows as inactive',
                description: 'Your Salesforce is configured to deploy flows as inactive, please make sure to manually activate them after the deployment completes',
                showOnFailure: false,
                subActions: [
                    "Go to: " + url,
                    'Activate it by clicking “Activate”',
                ],
            },
        };
    }
    if (baseUrl !== undefined) {
        return {
            postAction: {
                title: 'Deploying flows as inactive',
                description: 'Your Salesforce is configured to deploy flows as inactive, please make sure to manually activate them after the deployment completes',
                showOnFailure: false,
                subActions: [
                    "Go to: " + baseUrl + lightining_url_resolvers_1.FLOW_URL_SUFFIX,
                    "Search for the " + instance.elemID.getFullName() + " flow and click on it",
                    'Activate it by clicking “Activate”',
                ],
            },
        };
    }
    return {
        postAction: {
            title: 'Deploying flows as inactive',
            description: 'Your Salesforce is configured to deploy flows as inactive, please make sure to manually activate them after the deployment completes',
            showOnFailure: false,
            subActions: [
                'Go to the flow set up page in your org',
                "Search for the " + instance.elemID.getFullName() + " flow and click on it",
                'Activate it by clicking “Activate”',
            ],
        },
    };
};
var removeFlowError = function (instance) { return ({
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot delete flow',
    detailedMessage: "Cannot delete flow via metadata API. Flow name: " + instance.elemID.getFullName() + ". You can learn more about this deployment preview error here: https://help.salto.io/en/articles/7936713-cannot-delete-flow",
}); };
var newVersionInfo = function (instance, active) { return ({
    elemID: instance.elemID,
    severity: 'Info',
    message: "Deploying these changes will create a new " + (active ? 'active' : 'inactive') + " version of this flow",
    detailedMessage: "Deploying these changes will create a new " + (active ? 'active' : 'inactive') + " version of this flow. Flow name: " + instance.elemID.getFullName() + ". You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows",
}); };
var inActiveNewVersionInfo = function (instance, preferActive) {
    if (preferActive) {
        return {
            elemID: instance.elemID,
            severity: 'Info',
            message: 'Deploying these changes will create a new inactive version of this flow',
            detailedMessage: "Bear in mind that the new inactive version will not appear in Salto since your Salto environment is configured to prefer fetching active flow versions. Flow name: " + instance.elemID.getFullName() + ". You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows",
        };
    }
    return newVersionInfo(instance, false);
};
var activeFlowModificationError = function (instance, enableActiveDeploy, baseUrl) {
    if (enableActiveDeploy) {
        return {
            elemID: instance.elemID,
            severity: 'Info',
            message: 'Deploying these changes will create a new active version of this flow',
            detailedMessage: "Deploying these changes will create a new active version of this flow in case the test coverage percentage is greater than the number specified in your salesforce org config. Otherwise, a new inactive version of this flow will be created. Flow name: " + instance.elemID.getFullName() + ". You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows",
            deployActions: testCoveragePostDeploy(instance),
        };
    }
    return __assign(__assign({}, newVersionInfo(instance, false)), { deployActions: deployAsInactivePostDeploy(instance, baseUrl) });
};
var activatingFlowError = function (instance, enableActiveDeploy) {
    if (enableActiveDeploy) {
        return {
            elemID: instance.elemID,
            severity: 'Info',
            message: 'Activating this flow will work in case of sufficient test coverage as defined in your salesforce org config',
            detailedMessage: "Activating this flow will work in case of sufficient test coverage as defined in your salesforce org config. Flow name: " + instance.elemID.getFullName() + ". You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows",
            deployActions: testCoveragePostDeploy(instance),
        };
    }
    return {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Your salesforce org is configured to disallow flow activations via the API',
        detailedMessage: "Your salesforce org is configured to disallow flow activations via the API. Flow name: " + instance.elemID.getFullName() + ". You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows",
    };
};
var activeFlowAdditionError = function (instance, enableActiveDeploy, baseUrl) {
    if (enableActiveDeploy) {
        return {
            elemID: instance.elemID,
            severity: 'Info',
            message: 'Addition of a new active flow depends on test coverage',
            detailedMessage: 'You can learn more about this deployment preview error here: https://help.salto.io/en/articles/6982324-managing-salesforce-flows',
            deployActions: testCoveragePostDeploy(instance),
        };
    }
    return __assign(__assign({}, newVersionInfo(instance, false)), { deployActions: deployAsInactivePostDeploy(instance, baseUrl) });
};
var createDeactivatedFlowChangeInfo = function (flowInstance) { return ({
    elemID: flowInstance.elemID,
    severity: 'Info',
    message: 'Flow will be deactivated',
    detailedMessage: "The Flow " + utils_1.apiNameSync(flowInstance) + " will be deactivated.",
}); };
/**
 * Handling all changes regarding active flows
 */
var activeFlowValidator = function (config, isSandbox, client) {
    return function (changes, elementsSource) { return __awaiter(void 0, void 0, void 0, function () {
        var isPreferActiveVersion, isEnableFlowDeployAsActiveEnabled, baseUrl, flowChanges, removingFlowChangeErrors, _a, deactivatedFlowOnlyChanges, deactivatedFlowChanges, inactiveNewVersionChangeInfo, deactivatedFlowOnlyChangeInfo, sandboxFlowModification, activeFlowModification, activatingFlow, activeFlowAddition;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    isPreferActiveVersion = (_c = (_b = config.fetch) === null || _b === void 0 ? void 0 : _b.preferActiveFlowVersions) !== null && _c !== void 0 ? _c : PREFER_ACTIVE_FLOW_VERSIONS_DEFAULT;
                    return [4 /*yield*/, exports.getDeployAsActiveFlag(elementsSource, ENABLE_FLOW_DEPLOY_AS_ACTIVE_ENABLED_DEFAULT)];
                case 1:
                    isEnableFlowDeployAsActiveEnabled = _d.sent();
                    return [4 /*yield*/, client.getUrl()];
                case 2:
                    baseUrl = _d.sent();
                    return [4 /*yield*/, awu(changes)
                            .filter(adapter_api_1.isInstanceChange)
                            .filter(isFlowChange)
                            .toArray()];
                case 3:
                    flowChanges = _d.sent();
                    removingFlowChangeErrors = flowChanges
                        .filter(adapter_api_1.isRemovalChange)
                        .map(function (change) { return removeFlowError(adapter_api_1.getChangeData(change)); });
                    _a = lodash_1["default"].partition(flowChanges.filter(utils_1.isDeactivatedFlowChange), utils_1.isDeactivatedFlowChangeOnly), deactivatedFlowOnlyChanges = _a[0], deactivatedFlowChanges = _a[1];
                    inactiveNewVersionChangeInfo = deactivatedFlowChanges
                        .map(function (change) { return inActiveNewVersionInfo(adapter_api_1.getChangeData(change), isPreferActiveVersion); });
                    deactivatedFlowOnlyChangeInfo = deactivatedFlowOnlyChanges
                        .map(function (change) { return createDeactivatedFlowChangeInfo(adapter_api_1.getChangeData(change)); });
                    if (isSandbox) {
                        sandboxFlowModification = flowChanges
                            .filter(adapter_api_1.isModificationChange)
                            .filter(exports.isActiveFlowChange)
                            .map(adapter_api_1.getChangeData)
                            .map(function (instance) { return newVersionInfo(instance, true); });
                        return [2 /*return*/, __spreadArrays(inactiveNewVersionChangeInfo, deactivatedFlowOnlyChangeInfo, sandboxFlowModification, removingFlowChangeErrors)];
                    }
                    activeFlowModification = flowChanges
                        .filter(adapter_api_1.isModificationChange)
                        .filter(exports.isActiveFlowChange)
                        .map(adapter_api_1.getChangeData)
                        .map(function (flow) { return activeFlowModificationError(flow, isEnableFlowDeployAsActiveEnabled, baseUrl); });
                    activatingFlow = flowChanges
                        .filter(adapter_api_1.isModificationChange)
                        .filter(exports.isActivatingChange)
                        .map(function (change) {
                        if (exports.isActivatingChangeOnly(change)) {
                            return activatingFlowError(adapter_api_1.getChangeData(change), isEnableFlowDeployAsActiveEnabled);
                        }
                        return activeFlowModificationError(adapter_api_1.getChangeData(change), isEnableFlowDeployAsActiveEnabled, baseUrl);
                    });
                    activeFlowAddition = flowChanges
                        .filter(adapter_api_1.isAdditionChange)
                        .map(adapter_api_1.getChangeData)
                        .filter(function (flow) { return exports.getFlowStatus(flow) === constants_1.ACTIVE; })
                        .map(function (flow) { return activeFlowAdditionError(flow, isEnableFlowDeployAsActiveEnabled, baseUrl); });
                    return [2 /*return*/, __spreadArrays(inactiveNewVersionChangeInfo, deactivatedFlowOnlyChangeInfo, activeFlowModification, activatingFlow, activeFlowAddition, removingFlowChangeErrors)];
            }
        });
    }); };
};
exports["default"] = activeFlowValidator;
