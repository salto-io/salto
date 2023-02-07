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
var _a;
exports.__esModule = true;
exports.WORKFLOW_TYPE_TO_FIELD = exports.WORKFLOW_FIELD_TO_TYPE = exports.WORKFLOW_DIR_NAME = exports.WORKFLOW_RULES_FIELD = exports.WORKFLOW_TASKS_FIELD = exports.WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD = exports.WORKFLOW_OUTBOUND_MESSAGES_FIELD = exports.WORKFLOW_FLOW_ACTIONS_FIELD = exports.WORKFLOW_FIELD_UPDATES_FIELD = exports.WORKFLOW_ALERTS_FIELD = void 0;
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
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var _b = lowerdash_1.collections.asynciterable, awu = _b.awu, groupByAsync = _b.groupByAsync;
var makeArray = lowerdash_1.collections.array.makeArray;
var mapValuesAsync = lowerdash_1.promises.object.mapValuesAsync;
var removeAsync = lowerdash_1.promises.array.removeAsync;
var log = logging_1.logger(module);
exports.WORKFLOW_ALERTS_FIELD = 'alerts';
exports.WORKFLOW_FIELD_UPDATES_FIELD = 'fieldUpdates';
exports.WORKFLOW_FLOW_ACTIONS_FIELD = 'flowActions';
exports.WORKFLOW_OUTBOUND_MESSAGES_FIELD = 'outboundMessages';
exports.WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD = 'knowledgePublishes';
exports.WORKFLOW_TASKS_FIELD = 'tasks';
exports.WORKFLOW_RULES_FIELD = 'rules';
exports.WORKFLOW_DIR_NAME = 'WorkflowActions';
exports.WORKFLOW_FIELD_TO_TYPE = (_a = {},
    _a[exports.WORKFLOW_ALERTS_FIELD] = constants_1.WORKFLOW_ACTION_ALERT_METADATA_TYPE,
    _a[exports.WORKFLOW_FIELD_UPDATES_FIELD] = constants_1.WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
    _a[exports.WORKFLOW_FLOW_ACTIONS_FIELD] = constants_1.WORKFLOW_FLOW_ACTION_METADATA_TYPE,
    _a[exports.WORKFLOW_OUTBOUND_MESSAGES_FIELD] = constants_1.WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE,
    _a[exports.WORKFLOW_KNOWLEDGE_PUBLISHES_FIELD] = constants_1.WORKFLOW_KNOWLEDGE_PUBLISH_METADATA_TYPE,
    _a[exports.WORKFLOW_TASKS_FIELD] = constants_1.WORKFLOW_TASK_METADATA_TYPE,
    _a[exports.WORKFLOW_RULES_FIELD] = constants_1.WORKFLOW_RULE_METADATA_TYPE,
    _a);
exports.WORKFLOW_TYPE_TO_FIELD = lodash_1["default"].invert(exports.WORKFLOW_FIELD_TO_TYPE);
var isWorkflowInstance = utils_1.isInstanceOfType(constants_1.WORKFLOW_METADATA_TYPE);
var isWorkflowChildInstance = function (elem) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = adapter_api_1.isInstanceElement(elem);
                if (!_a) return [3 /*break*/, 2];
                _c = (_b = Object.values(exports.WORKFLOW_FIELD_TO_TYPE)).includes;
                return [4 /*yield*/, transformer_1.metadataType(elem)];
            case 1:
                _a = _c.apply(_b, [_d.sent()]);
                _d.label = 2;
            case 2: return [2 /*return*/, _a];
        }
    });
}); };
var isWorkflowRelatedChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var elem;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                elem = adapter_api_1.getChangeData(change);
                return [4 /*yield*/, isWorkflowInstance(elem)];
            case 1: return [2 /*return*/, (_a.sent()) || isWorkflowChildInstance(elem)];
        }
    });
}); };
var createPartialWorkflowInstance = function (fullInstance, changes, dataField) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = transformer_1.createInstanceElement;
                _b = [__assign((_d = {}, _d[constants_1.INSTANCE_FULL_NAME_FIELD] = fullInstance.value[constants_1.INSTANCE_FULL_NAME_FIELD], _d), lodash_1["default"].omit(fullInstance.value, Object.keys(exports.WORKFLOW_FIELD_TO_TYPE)))];
                return [4 /*yield*/, mapValuesAsync(exports.WORKFLOW_FIELD_TO_TYPE, function (fieldType) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b, _c, _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _b = (_a = Promise).all;
                                    _c = utils_1.getDataFromChanges;
                                    _d = [dataField];
                                    return [4 /*yield*/, awu(changes)
                                            .filter(utils_1.isInstanceOfTypeChange(fieldType))
                                            .toArray()];
                                case 1: return [2 /*return*/, (_b.apply(_a, [_c.apply(void 0, _d.concat([_e.sent()])).map(function (nestedInstance) { return __awaiter(void 0, void 0, void 0, function () {
                                            var _a, _b, _c;
                                            var _d;
                                            return __generator(this, function (_e) {
                                                switch (_e.label) {
                                                    case 0:
                                                        _a = [{}];
                                                        return [4 /*yield*/, transformer_1.toMetadataInfo(nestedInstance)];
                                                    case 1:
                                                        _b = [__assign.apply(void 0, _a.concat([_e.sent()]))];
                                                        _d = {};
                                                        _c = constants_1.INSTANCE_FULL_NAME_FIELD;
                                                        return [4 /*yield*/, transformer_1.apiName(nestedInstance, true)];
                                                    case 2: return [2 /*return*/, (__assign.apply(void 0, _b.concat([(_d[_c] = _e.sent(), _d)])))];
                                                }
                                            });
                                        }); })]))];
                            }
                        });
                    }); })];
            case 1:
                _c = [__assign.apply(void 0, _b.concat([_e.sent()]))];
                return [4 /*yield*/, fullInstance.getType()];
            case 2: return [2 /*return*/, (_a.apply(void 0, _c.concat([_e.sent(), undefined,
                    fullInstance.annotations])))];
        }
    });
}); };
var createDummyWorkflowInstance = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var realFieldTypes, _a, _b, dummyFieldType, workflowType, _c;
    var _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _b = (_a = Object).fromEntries;
                return [4 /*yield*/, awu(changes)
                        .map(function (change) { return adapter_api_1.getChangeData(change); })
                        .map(function (inst) { return inst.getType(); })
                        .map(function (instType) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, transformer_1.metadataType(instType)];
                            case 1: return [2 /*return*/, [_a.sent(), instType]];
                        }
                    }); }); })
                        .toArray()];
            case 1:
                realFieldTypes = _b.apply(_a, [_f.sent()]);
                dummyFieldType = function (typeName) { return new adapter_api_1.ObjectType({
                    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, typeName),
                    annotationRefsOrTypes: lodash_1["default"].clone(transformer_1.metadataAnnotationTypes),
                    annotations: { metadataType: typeName },
                }); };
                workflowType = new adapter_api_1.ObjectType({
                    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.WORKFLOW_METADATA_TYPE),
                    fields: __assign((_d = {}, _d[constants_1.INSTANCE_FULL_NAME_FIELD] = { refType: adapter_api_1.BuiltinTypes.SERVICE_ID }, _d), lodash_1["default"].mapValues(exports.WORKFLOW_FIELD_TO_TYPE, function (typeName) {
                        var _a;
                        return ({ refType: (_a = realFieldTypes[typeName]) !== null && _a !== void 0 ? _a : dummyFieldType(typeName) });
                    })),
                    annotationRefsOrTypes: transformer_1.metadataAnnotationTypes,
                    annotations: {
                        metadataType: 'Workflow',
                        dirName: 'workflows',
                        suffix: 'workflow',
                    },
                });
                _c = transformer_1.createInstanceElement;
                _e = {};
                return [4 /*yield*/, utils_1.parentApiName(adapter_api_1.getChangeData(changes[0]))];
            case 2: return [2 /*return*/, _c.apply(void 0, [(_e.fullName = _f.sent(), _e), workflowType])];
        }
    });
}); };
var createWorkflowChange = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var parent, after, before;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, createDummyWorkflowInstance(changes)];
            case 1:
                parent = _a.sent();
                return [4 /*yield*/, createPartialWorkflowInstance(parent, changes, 'after')];
            case 2:
                after = _a.sent();
                return [4 /*yield*/, createPartialWorkflowInstance(parent, changes, 'before')
                    /*
                     * we cannot know if the workflow instance change is add or modify
                     * but it does not matter in this use case because changes
                     * will be deployed with the upsert API anyway
                     */
                ];
            case 3:
                before = _a.sent();
                /*
                 * we cannot know if the workflow instance change is add or modify
                 * but it does not matter in this use case because changes
                 * will be deployed with the upsert API anyway
                 */
                return [2 /*return*/, { action: 'modify', data: { before: before, after: after } }];
        }
    });
}); };
var getWorkflowApiName = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var inst;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                inst = adapter_api_1.getChangeData(change);
                return [4 /*yield*/, isWorkflowInstance(inst)];
            case 1: return [2 /*return*/, (_a.sent()) ? transformer_1.apiName(inst) : utils_1.parentApiName(inst)];
        }
    });
}); };
var filterCreator = function () {
    var originalWorkflowChanges = {};
    return {
        /**
         * Upon fetch, modify the full_names of the inner types of the workflow to contain
         * the workflow full_name (e.g. MyWorkflowAlert -> Lead.MyWorkflowAlert)
         */
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var splitWorkflow, additionalElements;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        splitWorkflow = function (workflowInst) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, Promise.all(Object.entries(exports.WORKFLOW_FIELD_TO_TYPE).map(function (_a) {
                                            var fieldName = _a[0], fieldType = _a[1];
                                            return __awaiter(void 0, void 0, void 0, function () {
                                                var objType, workflowApiName, innerInstances;
                                                return __generator(this, function (_b) {
                                                    switch (_b.label) {
                                                        case 0: return [4 /*yield*/, awu(elements)
                                                                .find(function (e) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                                                                switch (_b.label) {
                                                                    case 0:
                                                                        _a = adapter_api_1.isObjectType(e);
                                                                        if (!_a) return [3 /*break*/, 2];
                                                                        return [4 /*yield*/, transformer_1.metadataType(e)];
                                                                    case 1:
                                                                        _a = (_b.sent()) === fieldType;
                                                                        _b.label = 2;
                                                                    case 2: return [2 /*return*/, _a];
                                                                }
                                                            }); }); })];
                                                        case 1:
                                                            objType = _b.sent();
                                                            if (lodash_1["default"].isUndefined(objType)) {
                                                                log.debug('failed to find object type for %s', fieldType);
                                                                return [2 /*return*/, []];
                                                            }
                                                            return [4 /*yield*/, transformer_1.apiName(workflowInst)];
                                                        case 2:
                                                            workflowApiName = _b.sent();
                                                            return [4 /*yield*/, Promise.all(makeArray(workflowInst.value[fieldName])
                                                                    .map(function (innerValue) { return __awaiter(void 0, void 0, void 0, function () {
                                                                    var _a;
                                                                    return __generator(this, function (_b) {
                                                                        return [2 /*return*/, transformer_1.createInstanceElement(__assign(__assign({}, innerValue), (_a = {}, _a[constants_1.INSTANCE_FULL_NAME_FIELD] = utils_1.fullApiName(workflowApiName, innerValue[constants_1.INSTANCE_FULL_NAME_FIELD]), _a)), objType)];
                                                                    });
                                                                }); }))];
                                                        case 3:
                                                            innerInstances = _b.sent();
                                                            return [2 /*return*/, innerInstances];
                                                    }
                                                });
                                            });
                                        }))];
                                    case 1: return [2 /*return*/, (_a.sent()).flat()];
                                }
                            });
                        }); };
                        return [4 /*yield*/, awu(elements)
                                .filter(adapter_api_1.isInstanceElement)
                                .filter(isWorkflowInstance)
                                .flatMap(function (wfInst) { return splitWorkflow(wfInst); })
                                .toArray()];
                    case 1:
                        additionalElements = _a.sent();
                        return [4 /*yield*/, removeAsync(elements, isWorkflowInstance)];
                    case 2:
                        _a.sent();
                        elements.push.apply(elements, additionalElements);
                        return [2 /*return*/];
                }
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var allWorkflowRelatedChanges, deployableWorkflowChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        allWorkflowRelatedChanges = awu(changes)
                            .filter(isWorkflowRelatedChange);
                        return [4 /*yield*/, groupByAsync(allWorkflowRelatedChanges, getWorkflowApiName)];
                    case 1:
                        originalWorkflowChanges = _a.sent();
                        return [4 /*yield*/, awu(Object.values(originalWorkflowChanges))
                                .map(createWorkflowChange)
                                .toArray()
                            // Remove all the non-deployable workflow changes from the original list and replace them
                            // with the deployable changes we created here
                        ];
                    case 2:
                        deployableWorkflowChanges = _a.sent();
                        // Remove all the non-deployable workflow changes from the original list and replace them
                        // with the deployable changes we created here
                        return [4 /*yield*/, removeAsync(changes, isWorkflowRelatedChange)];
                    case 3:
                        // Remove all the non-deployable workflow changes from the original list and replace them
                        // with the deployable changes we created here
                        _a.sent();
                        changes.push.apply(changes, deployableWorkflowChanges);
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var appliedWorkflowApiNames, appliedOriginalChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(isWorkflowRelatedChange)
                            .map(function (change) { return getWorkflowApiName(change); })
                            .toArray()];
                    case 1:
                        appliedWorkflowApiNames = _a.sent();
                        appliedOriginalChanges = appliedWorkflowApiNames.flatMap(function (workflowName) { var _a; return (_a = originalWorkflowChanges[workflowName]) !== null && _a !== void 0 ? _a : []; });
                        // Remove the changes we generated in preDeploy and replace them with the original changes
                        return [4 /*yield*/, removeAsync(changes, isWorkflowRelatedChange)];
                    case 2:
                        // Remove the changes we generated in preDeploy and replace them with the original changes
                        _a.sent();
                        changes.push.apply(changes, appliedOriginalChanges);
                        return [2 /*return*/];
                }
            });
        }); },
    };
};
exports["default"] = filterCreator;
