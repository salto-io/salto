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
exports.CUSTOM_LABEL_INSTANCES_FILE_PATH = void 0;
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
var joi_1 = require("joi");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var constants_1 = require("../constants");
var log = logging_1.logger(module);
var CUSTOM_LABELS_FULL_NAME = 'CustomLabels';
var CUSTOM_LABEL_INSTANCES_FILE_NAME = 'All';
exports.CUSTOM_LABEL_INSTANCES_FILE_PATH = [
    constants_1.SALESFORCE,
    constants_1.RECORDS_PATH,
    adapter_utils_1.pathNaclCase(constants_1.CUSTOM_LABEL_METADATA_TYPE),
    adapter_utils_1.pathNaclCase(CUSTOM_LABEL_INSTANCES_FILE_NAME),
];
var awu = lowerdash_1.collections.asynciterable.awu;
var makeArray = lowerdash_1.collections.array.makeArray;
var CUSTOM_LABEL_SCHEMA = joi_1["default"].object((_a = {},
    _a[constants_1.INSTANCE_FULL_NAME_FIELD] = joi_1["default"].string().required(),
    _a)).unknown(true);
var isCustomLabelsType = utils_1.isInstanceOfType(constants_1.CUSTOM_LABELS_METADATA_TYPE);
var isCustomLabel = adapter_utils_1.createSchemeGuard(CUSTOM_LABEL_SCHEMA);
var isCustomLabelsInstance = function (e) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, isCustomLabelsType(e)];
            case 1: return [2 /*return*/, ((_a.sent()) && makeArray(e.value.labels).every(isCustomLabel))];
        }
    });
}); };
var isCustomLabelType = utils_1.isInstanceOfType(constants_1.CUSTOM_LABEL_METADATA_TYPE);
var isCustomLabelChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (isCustomLabelType(adapter_api_1.getChangeData(change)))];
    });
}); };
var isCustomLabelsChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (isCustomLabelsType(adapter_api_1.getChangeData(change)))];
    });
}); };
var resolveCustomLabelsType = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var customLabelInstance, customLabelType;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                customLabelInstance = adapter_api_1.getChangeData(changes[0]);
                if (!adapter_api_1.isInstanceElement(customLabelInstance)) {
                    throw new Error('Could not determine CustomLabel type');
                }
                return [4 /*yield*/, customLabelInstance.getType()];
            case 1:
                customLabelType = _c.sent();
                return [2 /*return*/, new adapter_api_1.ObjectType({
                        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.CUSTOM_LABELS_METADATA_TYPE),
                        fields: (_a = {},
                            _a[constants_1.INSTANCE_FULL_NAME_FIELD] = { refType: adapter_api_1.BuiltinTypes.SERVICE_ID },
                            _a.labels = { refType: new adapter_api_1.ListType(customLabelType) },
                            _a),
                        annotationRefsOrTypes: transformer_1.metadataAnnotationTypes,
                        annotations: (_b = {},
                            _b[constants_1.METADATA_TYPE] = constants_1.CUSTOM_LABELS_METADATA_TYPE,
                            _b.dirName = 'labels',
                            _b.suffix = 'labels',
                            _b),
                    })];
        }
    });
}); };
var createCustomLabelsChange = function (customLabelChanges) { return __awaiter(void 0, void 0, void 0, function () {
    var customLabelsType, beforeCustomLabelsInstance, afterCustomLabelsInstance;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, resolveCustomLabelsType(customLabelChanges)];
            case 1:
                customLabelsType = _c.sent();
                beforeCustomLabelsInstance = transformer_1.createInstanceElement((_a = {},
                    _a[constants_1.INSTANCE_FULL_NAME_FIELD] = CUSTOM_LABELS_FULL_NAME,
                    _a.labels = utils_1.getDataFromChanges('before', customLabelChanges)
                        .filter(adapter_api_1.isInstanceElement)
                        .map(function (e) { return e.value; }),
                    _a), customLabelsType);
                afterCustomLabelsInstance = transformer_1.createInstanceElement((_b = {},
                    _b[constants_1.INSTANCE_FULL_NAME_FIELD] = CUSTOM_LABELS_FULL_NAME,
                    _b.labels = utils_1.getDataFromChanges('after', customLabelChanges)
                        .filter(adapter_api_1.isInstanceElement)
                        .map(function (e) { return e.value; }),
                    _b), customLabelsType);
                return [2 /*return*/, {
                        action: 'modify',
                        data: {
                            before: beforeCustomLabelsInstance,
                            after: afterCustomLabelsInstance,
                        },
                    }];
        }
    });
}); };
/**
 * Split custom labels into individual instances
 */
var filterCreator = function () {
    var customLabelChanges;
    return {
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var customLabelType, customLabelsInstances, customLabelsInstance, customLabelInstances;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(elements)
                            .filter(adapter_api_1.isObjectType)
                            .find(function (e) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, transformer_1.apiName(e)];
                                case 1: return [2 /*return*/, (_a.sent()) === constants_1.CUSTOM_LABEL_METADATA_TYPE];
                            }
                        }); }); })];
                    case 1:
                        customLabelType = _a.sent();
                        if (customLabelType === undefined) {
                            log.info('CustomLabel type does not exist, skipping filter');
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, awu(elements)
                                .filter(adapter_api_1.isInstanceElement)
                                .filter(isCustomLabelsInstance)
                                .toArray()];
                    case 2:
                        customLabelsInstances = _a.sent();
                        if (lodash_1["default"].isEmpty(customLabelsInstances)) {
                            log.info('CustomLabels instance does not exist, skipping filter');
                            return [2 /*return*/];
                        }
                        if (customLabelsInstances.length > 1) {
                            log.error('Found more than one instance of CustomLabels, skipping filter');
                            return [2 /*return*/];
                        }
                        customLabelsInstance = customLabelsInstances[0];
                        customLabelInstances = makeArray(customLabelsInstance.value.labels)
                            .map(function (label) { return new adapter_api_1.InstanceElement(label[constants_1.INSTANCE_FULL_NAME_FIELD], customLabelType, label, exports.CUSTOM_LABEL_INSTANCES_FILE_PATH); });
                        lodash_1["default"].pull(elements, customLabelsInstance);
                        elements.push.apply(elements, customLabelInstances);
                        return [2 /*return*/];
                }
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(isCustomLabelChange)
                            .toArray()];
                    case 1:
                        customLabelChanges = _c.sent();
                        if (lodash_1["default"].isEmpty(customLabelChanges)) {
                            return [2 /*return*/];
                        }
                        _b = (_a = changes).push;
                        return [4 /*yield*/, createCustomLabelsChange(customLabelChanges)];
                    case 2:
                        _b.apply(_a, [_c.sent()]);
                        lodash_1["default"].pullAll(changes, customLabelChanges);
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var customLabelsChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(isCustomLabelsChange)
                            .toArray()];
                    case 1:
                        customLabelsChanges = _a.sent();
                        if (lodash_1["default"].isEmpty(customLabelsChanges)) {
                            return [2 /*return*/];
                        }
                        lodash_1["default"].pullAll(changes, customLabelsChanges);
                        changes.push.apply(changes, customLabelChanges);
                        return [2 /*return*/];
                }
            });
        }); },
    };
};
exports["default"] = filterCreator;
