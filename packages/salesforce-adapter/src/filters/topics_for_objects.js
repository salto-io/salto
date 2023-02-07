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
exports.DEFAULT_ENABLE_TOPICS_VALUE = void 0;
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
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var types_1 = require("../client/types");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var removeAsync = lowerdash_1.promises.array.removeAsync;
var ENABLE_TOPICS = constants_1.TOPICS_FOR_OBJECTS_FIELDS.ENABLE_TOPICS, ENTITY_API_NAME = constants_1.TOPICS_FOR_OBJECTS_FIELDS.ENTITY_API_NAME;
exports.DEFAULT_ENABLE_TOPICS_VALUE = false;
var getTopicsForObjects = function (obj) {
    return obj.annotations[constants_1.TOPICS_FOR_OBJECTS_ANNOTATION] || {};
};
var setTopicsForObjects = function (object, enableTopics) {
    var _a, _b;
    object.annotate((_a = {}, _a[constants_1.TOPICS_FOR_OBJECTS_ANNOTATION] = (_b = {}, _b[ENABLE_TOPICS] = enableTopics, _b), _a));
};
var setDefaultTopicsForObjects = function (object) { return setTopicsForObjects(object, exports.DEFAULT_ENABLE_TOPICS_VALUE); };
var createTopicsForObjectsInstance = function (values) { return (transformer_1.createInstanceElement(values, new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.TOPICS_FOR_OBJECTS_METADATA_TYPE),
    annotationRefsOrTypes: lodash_1["default"].clone(transformer_1.metadataAnnotationTypes),
    annotations: {
        metadataType: constants_1.TOPICS_FOR_OBJECTS_METADATA_TYPE,
        dirName: 'topicsForObjects',
        suffix: 'topicsForObjects',
    },
}))); };
var filterCreator = function () { return ({
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        var customObjectTypes, topicsForObjectsInstances, topicsPerObject, topics;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, awu(elements).filter(transformer_1.isCustomObject).toArray()];
                case 1:
                    customObjectTypes = _a.sent();
                    if (lodash_1["default"].isEmpty(customObjectTypes)) {
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, utils_1.getInstancesOfMetadataType(elements, constants_1.TOPICS_FOR_OBJECTS_METADATA_TYPE)];
                case 2:
                    topicsForObjectsInstances = _a.sent();
                    if (lodash_1["default"].isEmpty(topicsForObjectsInstances)) {
                        return [2 /*return*/];
                    }
                    topicsPerObject = topicsForObjectsInstances.map(function (instance) {
                        var _a;
                        return (_a = {}, _a[instance.value[ENTITY_API_NAME]] = utils_1.boolValue(instance.value[ENABLE_TOPICS]), _a);
                    });
                    topics = lodash_1["default"].merge.apply(lodash_1["default"], __spreadArrays([{}], topicsPerObject));
                    // Add topics for objects to all fetched elements
                    return [4 /*yield*/, awu(customObjectTypes).forEach(function (obj) { return __awaiter(void 0, void 0, void 0, function () {
                            var fullName;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, transformer_1.apiName(obj)];
                                    case 1:
                                        fullName = _a.sent();
                                        if (Object.keys(topics).includes(fullName)) {
                                            setTopicsForObjects(obj, topics[fullName]);
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); })
                        // Remove TopicsForObjects Instances & Type to avoid information duplication
                    ];
                case 3:
                    // Add topics for objects to all fetched elements
                    _a.sent();
                    // Remove TopicsForObjects Instances & Type to avoid information duplication
                    return [4 /*yield*/, removeAsync(elements, function (elem) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, transformer_1.metadataType(elem)];
                                case 1: return [2 /*return*/, ((_a.sent()) === constants_1.TOPICS_FOR_OBJECTS_METADATA_TYPE)];
                            }
                        }); }); })];
                case 4:
                    // Remove TopicsForObjects Instances & Type to avoid information duplication
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        var customObjectChanges, newObjects, newObjectTopicsToSet, changedObjectTopics, topicsToSet, _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, awu(changes)
                        .filter(adapter_api_1.isObjectTypeChange)
                        .filter(adapter_api_1.isAdditionOrModificationChange)
                        .filter(function (change) { return transformer_1.isCustomObject(adapter_api_1.getChangeData(change)); })
                        .toArray()];
                case 1:
                    customObjectChanges = _d.sent();
                    newObjects = customObjectChanges
                        .filter(adapter_api_1.isAdditionChange)
                        .map(adapter_api_1.getChangeData);
                    // Add default value for new custom objects that have not specified a value
                    newObjects
                        .filter(function (obj) { return lodash_1["default"].isEmpty(getTopicsForObjects(obj)); })
                        .forEach(setDefaultTopicsForObjects);
                    newObjectTopicsToSet = newObjects
                        .filter(function (obj) { return getTopicsForObjects(obj)[ENABLE_TOPICS] !== exports.DEFAULT_ENABLE_TOPICS_VALUE; });
                    changedObjectTopics = customObjectChanges
                        .filter(adapter_api_1.isModificationChange)
                        .filter(function (change) { return (!lodash_1["default"].isEqual(getTopicsForObjects(change.data.before), getTopicsForObjects(change.data.after))); })
                        .map(adapter_api_1.getChangeData);
                    topicsToSet = __spreadArrays(newObjectTopicsToSet, changedObjectTopics);
                    if (topicsToSet.length === 0) {
                        return [2 /*return*/];
                    }
                    _b = 
                    // Add topics for objects instances to the list of changes to deploy
                    (_a = changes.push).apply;
                    _c = [
                        // Add topics for objects instances to the list of changes to deploy
                        changes];
                    return [4 /*yield*/, awu(topicsToSet)
                            .map(function (obj) { return __awaiter(void 0, void 0, void 0, function () {
                            var topics, topicsEnabled, _a, _b;
                            var _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        topics = getTopicsForObjects(obj);
                                        topicsEnabled = utils_1.boolValue((_c = topics[ENABLE_TOPICS]) !== null && _c !== void 0 ? _c : false);
                                        _a = types_1.TopicsForObjectsInfo.bind;
                                        return [4 /*yield*/, transformer_1.apiName(obj)];
                                    case 1:
                                        _b = [void 0, _d.sent()];
                                        return [4 /*yield*/, transformer_1.apiName(obj)];
                                    case 2: return [2 /*return*/, new (_a.apply(types_1.TopicsForObjectsInfo, _b.concat([_d.sent(), topicsEnabled])))()];
                                }
                            });
                        }); })
                            .map(createTopicsForObjectsInstance)
                            .map(function (after) { return adapter_api_1.toChange({ after: after }); })
                            .toArray()];
                case 2:
                    // Add topics for objects instances to the list of changes to deploy
                    _b.apply(_a, _c.concat([_d.sent()]));
                    return [2 /*return*/];
            }
        });
    }); },
    onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Remove all the topics for objects instance changes that we added in preDeploy
                return [4 /*yield*/, removeAsync(changes, utils_1.isInstanceOfTypeChange(constants_1.TOPICS_FOR_OBJECTS_METADATA_TYPE))];
                case 1:
                    // Remove all the topics for objects instance changes that we added in preDeploy
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
}); };
exports["default"] = filterCreator;
