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
exports.createActiveVersionFileProperties = void 0;
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
var logging_1 = require("@salto-io/logging");
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../constants");
var fetch_1 = require("../fetch");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var isDefined = lowerdash_1.values.isDefined;
var log = logging_1.logger(module);
var FLOW_DEFINITION_METADATA_TYPE_ID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FLOW_DEFINITION_METADATA_TYPE);
var FLOW_METADATA_TYPE_ID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FLOW_METADATA_TYPE);
var fixFilePropertiesName = function (props, activeVersions) {
    var _a;
    return (__assign(__assign({}, props), { fullName: (_a = activeVersions.get("" + props.fullName)) !== null && _a !== void 0 ? _a : "" + props.fullName }));
};
var createActiveVersionFileProperties = function (fileProp, flowDefinitions) {
    var activeVersions = new Map();
    flowDefinitions.forEach(function (flow) { return activeVersions.set("" + flow.value.fullName, "" + flow.value.fullName + (isDefined(flow.value[constants_1.ACTIVE_VERSION_NUMBER]) ? "-" + flow.value[constants_1.ACTIVE_VERSION_NUMBER] : '')); });
    return fileProp.map(function (prop) { return fixFilePropertiesName(prop, activeVersions); });
};
exports.createActiveVersionFileProperties = createActiveVersionFileProperties;
var getFlowWithoutVersion = function (element, flowType) {
    var prevFullName = element.value.fullName;
    var flowName = prevFullName.includes('-') ? prevFullName.split('-').slice(0, -1).join('-') : prevFullName;
    return transformer_1.createInstanceElement(__assign(__assign({}, element.value), { fullName: flowName }), flowType, undefined, element.annotations);
};
var createActiveVersionProps = function (client, fetchProfile, flowDefinitionType, fileProps) { return __awaiter(void 0, void 0, void 0, function () {
    var definitionFileProps, flowDefinitionInstances;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, utils_1.listMetadataObjects(client, constants_1.FLOW_DEFINITION_METADATA_TYPE)];
            case 1:
                definitionFileProps = (_a.sent()).elements;
                return [4 /*yield*/, fetch_1.fetchMetadataInstances({
                        client: client,
                        fileProps: definitionFileProps,
                        metadataType: flowDefinitionType,
                        metadataQuery: fetchProfile.metadataQuery,
                        maxInstancesPerType: fetchProfile.maxInstancesPerType,
                    })];
            case 2:
                flowDefinitionInstances = _a.sent();
                return [2 /*return*/, exports.createActiveVersionFileProperties(fileProps, flowDefinitionInstances.elements)];
        }
    });
}); };
var createDeactivatedFlowDefinitionChange = function (flowChange, flowDefinitionMetadataType) {
    var _a;
    var flowApiName = utils_1.apiNameSync(adapter_api_1.getChangeData(flowChange));
    if (flowApiName === undefined) {
        throw new Error('Attempting to deploy a flow with no apiName');
    }
    var flowDefinitionInstance = transformer_1.createInstanceElement((_a = {},
        _a[constants_1.INSTANCE_FULL_NAME_FIELD] = flowApiName,
        _a[constants_1.ACTIVE_VERSION_NUMBER] = 0,
        _a), flowDefinitionMetadataType);
    return adapter_api_1.toChange({ after: flowDefinitionInstance });
};
var getFlowInstances = function (client, fetchProfile, flowType, flowDefinitionType) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, fileProps, configChanges, flowsVersionProps, _b, instances;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, utils_1.listMetadataObjects(client, constants_1.FLOW_METADATA_TYPE)];
            case 1:
                _a = _c.sent(), fileProps = _a.elements, configChanges = _a.configChanges;
                if (fetchProfile.preferActiveFlowVersions && lodash_1.isUndefined(flowDefinitionType)) {
                    log.error('Failed to fetch flows active version due to a problem with flowDefinition type');
                    return [2 /*return*/, {}];
                }
                if (!(fetchProfile.preferActiveFlowVersions && isDefined(flowDefinitionType))) return [3 /*break*/, 3];
                return [4 /*yield*/, createActiveVersionProps(client, fetchProfile, flowDefinitionType, fileProps)];
            case 2:
                _b = _c.sent();
                return [3 /*break*/, 4];
            case 3:
                _b = fileProps;
                _c.label = 4;
            case 4:
                flowsVersionProps = _b;
                return [4 /*yield*/, fetch_1.fetchMetadataInstances({
                        client: client,
                        fileProps: flowsVersionProps,
                        metadataType: flowType,
                        metadataQuery: fetchProfile.metadataQuery,
                        maxInstancesPerType: fetchProfile.maxInstancesPerType,
                    })];
            case 5:
                instances = _c.sent();
                return [2 /*return*/, { configChanges: instances.configChanges.concat(configChanges), elements: instances.elements.map(function (e) {
                            return (fetchProfile.preferActiveFlowVersions ? getFlowWithoutVersion(e, flowType) : e);
                        }) }];
        }
    });
}); };
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        name: 'flowsFilter',
        remote: true,
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var flowType, flowDefinitionType, instances;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        flowType = adapter_utils_1.findObjectType(elements, FLOW_METADATA_TYPE_ID);
                        if (flowType === undefined) {
                            return [2 /*return*/, {}];
                        }
                        flowDefinitionType = adapter_utils_1.findObjectType(elements, FLOW_DEFINITION_METADATA_TYPE_ID);
                        return [4 /*yield*/, getFlowInstances(client, config.fetchProfile, flowType, flowDefinitionType)];
                    case 1:
                        instances = _a.sent();
                        instances.elements.forEach(function (e) { return elements.push(e); });
                        // While we don't manage FlowDefinition Instances in Salto, we use the type upon deploy
                        // to create FlowDefinition Instance to deactivate a Flow.
                        if (flowDefinitionType !== undefined) {
                            flowDefinitionType.annotations[adapter_api_1.CORE_ANNOTATIONS.HIDDEN] = true;
                        }
                        return [2 /*return*/, {
                                configSuggestions: __spreadArrays(instances.configChanges),
                            }];
                }
            });
        }); },
        // In order to deactivate a Flow, we need to create a FlowDefinition instance with activeVersionNumber of 0
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var deactivatedFlowOnlyChanges, flowDefinitionType;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        deactivatedFlowOnlyChanges = changes.filter(utils_1.isDeactivatedFlowChangeOnly);
                        if (deactivatedFlowOnlyChanges.length === 0) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, config.elementsSource.get(FLOW_DEFINITION_METADATA_TYPE_ID)];
                    case 1:
                        flowDefinitionType = _a.sent();
                        if (!adapter_api_1.isObjectType(flowDefinitionType)) {
                            log.error('Failed to deactivate flows since the FlowDefinition metadata type does not exist in the elements source');
                            return [2 /*return*/];
                        }
                        deactivatedFlowOnlyChanges
                            .map(function (flowChange) { return createDeactivatedFlowDefinitionChange(flowChange, flowDefinitionType); })
                            .forEach(function (flowDefinitionChange) { return changes.push(flowDefinitionChange); });
                        return [2 /*return*/];
                }
            });
        }); },
        // Remove the created FlowDefinition instances
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var flowDefinitionChanges, deactivatedFlowNames;
            return __generator(this, function (_a) {
                flowDefinitionChanges = changes.filter(utils_1.isInstanceOfTypeChangeSync(constants_1.FLOW_DEFINITION_METADATA_TYPE));
                if (flowDefinitionChanges.length === 0) {
                    return [2 /*return*/];
                }
                deactivatedFlowNames = flowDefinitionChanges
                    .map(adapter_api_1.getChangeData)
                    .map(function (change) { return utils_1.apiNameSync(change); })
                    .filter(isDefined);
                log.info("Successfully deactivated the following flows: " + deactivatedFlowNames.join(' '));
                lodash_1["default"].pullAll(changes, flowDefinitionChanges);
                return [2 /*return*/];
            });
        }); },
    });
};
exports["default"] = filterCreator;
