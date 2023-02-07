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
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var logging_1 = require("@salto-io/logging");
var adapter_api_1 = require("@salto-io/adapter-api");
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var utils_1 = require("./utils");
var makeArray = lowerdash_1.collections.array.makeArray;
var isDefined = lowerdash_1.values.isDefined;
var DefaultMap = lowerdash_1.collections.map.DefaultMap;
var keyByAsync = lowerdash_1.collections.asynciterable.keyByAsync;
var removeAsync = lowerdash_1.promises.array.removeAsync;
var mapValuesAsync = lowerdash_1.promises.object.mapValuesAsync;
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
var INTERNAL_ID_SEPARATOR = '$';
var MAX_BREAKDOWN_ELEMENTS = 10;
var serializeInternalID = function (typeName, id) {
    return ("" + typeName + INTERNAL_ID_SEPARATOR + id);
};
var serializeInstanceInternalID = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = serializeInternalID;
                _b = transformer_1.apiName;
                return [4 /*yield*/, instance.getType()];
            case 1: return [4 /*yield*/, _b.apply(void 0, [_d.sent(), true])];
            case 2:
                _c = [_d.sent()];
                return [4 /*yield*/, transformer_1.apiName(instance)];
            case 3: return [2 /*return*/, (_a.apply(void 0, _c.concat([_d.sent()])))];
        }
    });
}); };
var deserializeInternalID = function (internalID) {
    var splitInternalID = internalID.split(INTERNAL_ID_SEPARATOR);
    if (splitInternalID.length !== 2) {
        throw Error("Invalid Custom Object Instance internalID - " + internalID);
    }
    return {
        type: splitInternalID[0], id: splitInternalID[1],
    };
};
var createWarnings = function (instancesWithCollidingElemID, missingRefs, illegalRefSources, customObjectPrefixKeyMap, dataManagement, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var collisionWarnings, typeToInstanceIdToMissingRefs, missingRefsWarnings, typesOfIllegalRefSources, illegalOriginsWarnings;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, adapter_utils_1.getAndLogCollisionWarnings({
                    adapterName: constants_1.SALESFORCE,
                    baseUrl: baseUrl,
                    instances: instancesWithCollidingElemID,
                    configurationName: 'data management',
                    getIdFieldsByType: dataManagement.getObjectIdsFields,
                    getTypeName: function (instance) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = transformer_1.apiName;
                                return [4 /*yield*/, instance.getType()];
                            case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent(), true])];
                        }
                    }); }); },
                    idFieldsName: 'saltoIDSettings',
                    getInstanceName: function (instance) { return transformer_1.apiName(instance); },
                    docsUrl: 'https://help.salto.io/en/articles/6927217-salto-for-salesforce-cpq-support',
                })];
            case 1:
                collisionWarnings = _a.sent();
                typeToInstanceIdToMissingRefs = lodash_1["default"].mapValues(lodash_1["default"].groupBy(missingRefs, function (missingRef) { return customObjectPrefixKeyMap[missingRef.targetId.substring(0, constants_1.KEY_PREFIX_LENGTH)]; }), function (typeMissingRefs) { return lodash_1["default"].groupBy(typeMissingRefs, function (missingRef) { return missingRef.targetId; }); });
                missingRefsWarnings = Object.entries(typeToInstanceIdToMissingRefs)
                    .map(function (_a) {
                    var type = _a[0], instanceIdToMissingRefs = _a[1];
                    var numMissingInstances = Object.keys(instanceIdToMissingRefs).length;
                    var header = "Identified references to " + numMissingInstances + " missing instances of " + type;
                    var perMissingInstToDisplay = Object.entries(instanceIdToMissingRefs)
                        .slice(0, MAX_BREAKDOWN_ELEMENTS);
                    var perMissingInstanceMsgs = perMissingInstToDisplay
                        .map(function (_a) {
                        var instanceId = _a[0], instanceMissingRefs = _a[1];
                        return adapter_utils_1.getInstanceDesc(instanceId, baseUrl) + " referenced from -\n  " + adapter_utils_1.getInstancesDetailsMsg(instanceMissingRefs.map(function (instanceMissingRef) { return instanceMissingRef.origin.id; }), baseUrl);
                    });
                    var epilogue = "To resolve this issue please edit the salesforce.nacl file to include " + type + " instances in the data management configuration and fetch again.\n\n      Alternatively, you can exclude the referring types from the data management configuration in salesforce.nacl";
                    var missingInstCount = Object.keys(instanceIdToMissingRefs).length;
                    var overflowMsg = missingInstCount > MAX_BREAKDOWN_ELEMENTS ? ['', "And " + (missingInstCount - MAX_BREAKDOWN_ELEMENTS) + " more missing Instances"] : [];
                    return adapter_utils_1.createWarningFromMsg(__spreadArrays([
                        header,
                        ''
                    ], perMissingInstanceMsgs, overflowMsg, [
                        '',
                        epilogue,
                    ]).join('\n'));
                });
                typesOfIllegalRefSources = lodash_1["default"].uniq(__spreadArrays(illegalRefSources).map(deserializeInternalID)
                    .map(function (source) { return source.type; }));
                illegalOriginsWarnings = illegalRefSources.size === 0 ? [] : [adapter_utils_1.createWarningFromMsg("Omitted " + illegalRefSources.size + " instances due to the previous SaltoID collisions and/or missing instances.\n  Types of the omitted instances are: " + typesOfIllegalRefSources.join(', ') + ".")];
                return [2 /*return*/, __spreadArrays(collisionWarnings, missingRefsWarnings, illegalOriginsWarnings)];
        }
    });
}); };
var isReferenceField = function (field) { return (isDefined(field) && (utils_1.isLookupField(field) || utils_1.isMasterDetailField(field))); };
var replaceLookupsWithRefsAndCreateRefMap = function (instances, internalToInstance, dataManagement) { return __awaiter(void 0, void 0, void 0, function () {
    var reverseReferencesMap, missingRefs, replaceLookups;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                reverseReferencesMap = new DefaultMap(function () { return new Set(); });
                missingRefs = [];
                replaceLookups = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
                    var transformFunc, _a;
                    var _b;
                    var _c;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                transformFunc = function (_a) {
                                    var value = _a.value, field = _a.field;
                                    return __awaiter(void 0, void 0, void 0, function () {
                                        var refTo, ignoredRefTo, refTarget, _b, _c, _d, _e, _f, _g, _h;
                                        var _j, _k;
                                        var _l, _m, _o;
                                        return __generator(this, function (_p) {
                                            switch (_p.label) {
                                                case 0:
                                                    if (!isReferenceField(field)) {
                                                        return [2 /*return*/, value];
                                                    }
                                                    refTo = makeArray((_l = field === null || field === void 0 ? void 0 : field.annotations) === null || _l === void 0 ? void 0 : _l[constants_1.FIELD_ANNOTATIONS.REFERENCE_TO]);
                                                    ignoredRefTo = refTo.filter(function (typeName) { return dataManagement.shouldIgnoreReference(typeName); });
                                                    if (!lodash_1["default"].isEmpty(refTo) && ignoredRefTo.length === refTo.length) {
                                                        log.debug('Ignored reference to type/s %s from instance - %s', ignoredRefTo.join(', '), instance.elemID.getFullName());
                                                        return [2 /*return*/, value];
                                                    }
                                                    if (!lodash_1["default"].isEmpty(ignoredRefTo)) {
                                                        log.warn('Not ignoring reference to type/s %s from instance - %s because some of the refTo is legal (refTo = %s)', ignoredRefTo.join(', '), instance.elemID.getFullName(), refTo.join(', '));
                                                    }
                                                    refTarget = refTo
                                                        .map(function (typeName) { return internalToInstance[serializeInternalID(typeName, value)]; })
                                                        .filter(isDefined)
                                                        .pop();
                                                    if (!(refTarget === undefined)) return [3 /*break*/, 5];
                                                    if (!(!lodash_1["default"].isEmpty(value) && (((_m = field === null || field === void 0 ? void 0 : field.annotations) === null || _m === void 0 ? void 0 : _m[constants_1.FIELD_ANNOTATIONS.CREATABLE]) || ((_o = field === null || field === void 0 ? void 0 : field.annotations) === null || _o === void 0 ? void 0 : _o[constants_1.FIELD_ANNOTATIONS.UPDATEABLE])))) return [3 /*break*/, 4];
                                                    _c = (_b = missingRefs).push;
                                                    _j = {};
                                                    _k = {};
                                                    _d = transformer_1.apiName;
                                                    return [4 /*yield*/, instance.getType()];
                                                case 1: return [4 /*yield*/, _d.apply(void 0, [_p.sent(), true])];
                                                case 2:
                                                    _k.type = _p.sent();
                                                    return [4 /*yield*/, transformer_1.apiName(instance)];
                                                case 3:
                                                    _c.apply(_b, [(_j.origin = (_k.id = _p.sent(),
                                                            _k.field = field.name,
                                                            _k),
                                                            _j.targetId = instance.value[field.name],
                                                            _j)]);
                                                    _p.label = 4;
                                                case 4: return [2 /*return*/, value];
                                                case 5:
                                                    _g = (_f = reverseReferencesMap).get;
                                                    return [4 /*yield*/, serializeInstanceInternalID(refTarget)];
                                                case 6:
                                                    _h = (_e = _g.apply(_f, [_p.sent()]))
                                                        .add;
                                                    return [4 /*yield*/, serializeInstanceInternalID(instance)];
                                                case 7:
                                                    _h.apply(_e, [_p.sent()]);
                                                    return [2 /*return*/, new adapter_api_1.ReferenceExpression(refTarget.elemID)];
                                            }
                                        });
                                    });
                                };
                                _a = adapter_utils_1.transformValues;
                                _b = {
                                    values: instance.value
                                };
                                return [4 /*yield*/, instance.getType()];
                            case 1: return [4 /*yield*/, _a.apply(void 0, [(_b.type = _d.sent(),
                                        _b.transformFunc = transformFunc,
                                        _b.strict = false,
                                        _b.allowEmpty = true,
                                        _b)])];
                            case 2: return [2 /*return*/, (_c = _d.sent()) !== null && _c !== void 0 ? _c : instance.value];
                        }
                    });
                }); };
                return [4 /*yield*/, awu(instances).forEach(function (instance, index) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _a = instance;
                                    return [4 /*yield*/, replaceLookups(instance)];
                                case 1:
                                    _a.value = _b.sent();
                                    if (index > 0 && index % 500 === 0) {
                                        log.debug("Replaced lookup with references for " + index + " instances");
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 1:
                _a.sent();
                return [2 /*return*/, { reverseReferencesMap: reverseReferencesMap, missingRefs: missingRefs }];
        }
    });
}); };
var getIllegalRefSources = function (initialIllegalRefTargets, reverseRefsMap) {
    var illegalRefSources = new Set();
    var illegalRefTargets = __spreadArrays(initialIllegalRefTargets);
    while (illegalRefTargets.length > 0) {
        var currentBrokenRef = illegalRefTargets.pop();
        if (currentBrokenRef === undefined) {
            break;
        }
        var refsToCurrentIllegal = __spreadArrays(reverseRefsMap.get(currentBrokenRef));
        refsToCurrentIllegal.filter(function (r) { return !illegalRefSources.has(r); })
            .forEach(function (newIllegalRefFrom) {
            illegalRefTargets.push(newIllegalRefFrom);
            illegalRefSources.add(newIllegalRefFrom);
        });
    }
    return illegalRefSources;
};
var buildCustomObjectPrefixKeyMap = function (elements) { return __awaiter(void 0, void 0, void 0, function () {
    var customObjects, keyPrefixToCustomObject;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(elements)
                    .filter(transformer_1.isCustomObject)
                    .filter(function (customObject) { return isDefined(customObject.annotations[constants_1.KEY_PREFIX]); })
                    .toArray()];
            case 1:
                customObjects = _a.sent();
                keyPrefixToCustomObject = lodash_1["default"].keyBy(customObjects, function (customObject) { return customObject.annotations[constants_1.KEY_PREFIX]; });
                return [2 /*return*/, mapValuesAsync(keyPrefixToCustomObject, 
                    // Looking at Salesforce's keyPrefix results duplicate types with
                    // the same prefix exist but are not relevant/important to differentiate between
                    function (keyCustomObject) { return transformer_1.apiName(keyCustomObject); })];
        }
    });
}); };
var filter = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        name: 'customObjectInstanceReferencesFilter',
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var dataManagement, customObjectInstances, internalToInstance, _a, reverseReferencesMap, missingRefs, instancesWithCollidingElemID, missingRefOriginInternalIDs, instWithDupElemIDInterIDs, _b, illegalRefTargets, illegalRefSources, invalidInstances, baseUrl, customObjectPrefixKeyMap;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        dataManagement = config.fetchProfile.dataManagement;
                        if (dataManagement === undefined) {
                            return [2 /*return*/, {}];
                        }
                        return [4 /*yield*/, awu(elements).filter(transformer_1.isInstanceOfCustomObject)
                                .toArray()];
                    case 1:
                        customObjectInstances = _d.sent();
                        return [4 /*yield*/, keyByAsync(customObjectInstances, serializeInstanceInternalID)];
                    case 2:
                        internalToInstance = _d.sent();
                        return [4 /*yield*/, replaceLookupsWithRefsAndCreateRefMap(customObjectInstances, internalToInstance, dataManagement)];
                    case 3:
                        _a = _d.sent(), reverseReferencesMap = _a.reverseReferencesMap, missingRefs = _a.missingRefs;
                        instancesWithCollidingElemID = adapter_utils_1.getInstancesWithCollidingElemID(customObjectInstances);
                        missingRefOriginInternalIDs = new Set(missingRefs
                            .map(function (missingRef) { return serializeInternalID(missingRef.origin.type, missingRef.origin.id); }));
                        _b = Set.bind;
                        return [4 /*yield*/, Promise.all(instancesWithCollidingElemID.map(serializeInstanceInternalID))];
                    case 4:
                        instWithDupElemIDInterIDs = new (_b.apply(Set, [void 0, _d.sent()]))();
                        illegalRefTargets = new Set(__spreadArrays(missingRefOriginInternalIDs, instWithDupElemIDInterIDs));
                        illegalRefSources = getIllegalRefSources(illegalRefTargets, reverseReferencesMap);
                        invalidInstances = new Set(__spreadArrays(illegalRefSources, illegalRefTargets));
                        return [4 /*yield*/, removeAsync(elements, function (element) { return __awaiter(void 0, void 0, void 0, function () {
                                var _a, _b, _c;
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0: return [4 /*yield*/, transformer_1.isInstanceOfCustomObject(element)];
                                        case 1:
                                            _a = (_d.sent());
                                            if (!_a) return [3 /*break*/, 3];
                                            _c = (_b = invalidInstances).has;
                                            return [4 /*yield*/, serializeInstanceInternalID(element)];
                                        case 2:
                                            _a = _c.apply(_b, [_d.sent()]);
                                            _d.label = 3;
                                        case 3: return [2 /*return*/, (_a)];
                                    }
                                });
                            }); })];
                    case 5:
                        _d.sent();
                        return [4 /*yield*/, client.getUrl()];
                    case 6:
                        baseUrl = _d.sent();
                        return [4 /*yield*/, buildCustomObjectPrefixKeyMap(elements)];
                    case 7:
                        customObjectPrefixKeyMap = _d.sent();
                        _c = {};
                        return [4 /*yield*/, createWarnings(instancesWithCollidingElemID, missingRefs, illegalRefSources, customObjectPrefixKeyMap, dataManagement, baseUrl === null || baseUrl === void 0 ? void 0 : baseUrl.origin)];
                    case 8: return [2 /*return*/, (_c.errors = _d.sent(),
                            _c)];
                }
            });
        }); },
    });
};
exports["default"] = filter;
