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
var adapter_components_1 = require("@salto-io/adapter-components");
var logging_1 = require("@salto-io/logging");
var adapter_api_1 = require("@salto-io/adapter-api");
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var isDefined = lowerdash_1.values.isDefined;
var DefaultMap = lowerdash_1.collections.map.DefaultMap;
var keyByAsync = lowerdash_1.collections.asynciterable.keyByAsync;
var removeAsync = lowerdash_1.promises.array.removeAsync;
var mapValuesAsync = lowerdash_1.promises.object.mapValuesAsync;
var createMissingValueReference = adapter_components_1.references.createMissingValueReference;
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
var createWarnings = function (instancesWithCollidingElemID, instancesWithEmptyIds, missingRefs, illegalRefSources, dataManagement, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var createOmittedInstancesWarning, collisionWarnings, instanceWithEmptyIdWarnings, originTypeToMissingRef, missingRefsWarnings, typesOfIllegalRefSources, illegalOriginsWarnings;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                createOmittedInstancesWarning = function (originTypeName, missingRefsFromOriginType) { return __awaiter(void 0, void 0, void 0, function () {
                    var typesOfMissingRefsTargets, numMissingInstances, header, perTargetTypeMsgs, perInstancesPreamble, perMissingInstanceMsgs, epilogue, overflowMsg;
                    return __generator(this, function (_a) {
                        typesOfMissingRefsTargets = lodash_1["default"](missingRefsFromOriginType)
                            .map(function (missingRef) { var _a; return (_a = missingRef.origin.field) === null || _a === void 0 ? void 0 : _a.annotations[constants_1.FIELD_ANNOTATIONS.REFERENCE_TO]; })
                            .filter(isDefined)
                            .uniq()
                            .value();
                        numMissingInstances = lodash_1["default"].uniqBy(missingRefsFromOriginType, function (missingRef) { return missingRef.targetId; }).length;
                        header = "Your Salto environment is configured to manage records of the " + originTypeName + " object. " + numMissingInstances + " " + originTypeName + " records were not fetched because they have a lookup relationship to one of the following objects:";
                        perTargetTypeMsgs = typesOfMissingRefsTargets.join('\n');
                        perInstancesPreamble = 'and these objects are not part of your Salto configuration. \n\nHere are the records:';
                        perMissingInstanceMsgs = missingRefs
                            .filter(function (missingRef) { return missingRef.origin.type === originTypeName; })
                            .map(function (missingRef) { return adapter_utils_1.getInstanceDesc(missingRef.origin.id, baseUrl) + " relates to " + adapter_utils_1.getInstanceDesc(missingRef.targetId, baseUrl); })
                            .slice(0, MAX_BREAKDOWN_ELEMENTS)
                            .sort() // this effectively sorts by origin instance ID
                        ;
                        epilogue = 'To resolve this issue, follow the steps outlined here: https://help.salto.io/en/articles/8283155-data-records-were-not-fetched';
                        overflowMsg = numMissingInstances > MAX_BREAKDOWN_ELEMENTS ? ['', "... and " + (numMissingInstances - MAX_BREAKDOWN_ELEMENTS) + " more missing records"] : [];
                        return [2 /*return*/, adapter_utils_1.createWarningFromMsg(__spreadArrays([
                                header,
                                '',
                                perTargetTypeMsgs,
                                '',
                                perInstancesPreamble,
                                ''
                            ], perMissingInstanceMsgs, overflowMsg, [
                                '',
                                epilogue,
                            ]).join('\n'))];
                    });
                }); };
                return [4 /*yield*/, adapter_utils_1.getAndLogCollisionWarnings({
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
                return [4 /*yield*/, awu(instancesWithEmptyIds)
                        // In case of collisions, there's already a warning on the Element
                        .filter(function (instance) { return !instancesWithCollidingElemID.includes(instance); })
                        .map(function (instance) { return __awaiter(void 0, void 0, void 0, function () {
                        var typeName, _a, _b, _c, _d, _e;
                        var _f;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0:
                                    _a = utils_1.safeApiName;
                                    return [4 /*yield*/, instance.getType()];
                                case 1: return [4 /*yield*/, _a.apply(void 0, [_g.sent()])];
                                case 2:
                                    typeName = (_f = _g.sent()) !== null && _f !== void 0 ? _f : 'Unknown';
                                    _b = adapter_utils_1.createWarningFromMsg;
                                    _c = ["Omitted Instance of type " + typeName + " due to empty Salto ID.",
                                        "Current Salto ID configuration for " + typeName + " is defined as " + adapter_utils_1.safeJsonStringify(dataManagement.getObjectIdsFields(typeName))];
                                    _d = "Instance Service Url: ";
                                    _e = adapter_utils_1.getInstanceDesc;
                                    return [4 /*yield*/, serializeInstanceInternalID(instance)];
                                case 3: return [2 /*return*/, _b.apply(void 0, [_c.concat([
                                            _d + _e.apply(void 0, [_g.sent(), baseUrl])
                                        ]).join('\n')])];
                            }
                        });
                    }); })
                        .toArray()];
            case 2:
                instanceWithEmptyIdWarnings = _a.sent();
                originTypeToMissingRef = lodash_1["default"].groupBy(missingRefs, function (missingRef) { return missingRef.origin.type; });
                return [4 /*yield*/, awu(Object.entries(originTypeToMissingRef))
                        .map(function (_a) {
                        var originType = _a[0], missingRefsFromType = _a[1];
                        return createOmittedInstancesWarning(originType, missingRefsFromType);
                    })
                        .toArray()];
            case 3:
                missingRefsWarnings = _a.sent();
                typesOfIllegalRefSources = lodash_1["default"].uniq(__spreadArrays(illegalRefSources).map(deserializeInternalID)
                    .map(function (source) { return source.type; }));
                illegalOriginsWarnings = illegalRefSources.size === 0 ? [] : [adapter_utils_1.createWarningFromMsg("Omitted " + illegalRefSources.size + " instances due to the previous SaltoID collisions and/or missing instances.\n  Types of the omitted instances are: " + typesOfIllegalRefSources.join(', ') + ".")];
                return [2 /*return*/, __spreadArrays(collisionWarnings, instanceWithEmptyIdWarnings, missingRefsWarnings, illegalOriginsWarnings)];
        }
    });
}); };
var replaceLookupsWithRefsAndCreateRefMap = function (instances, internalToInstance, internalToTypeName, dataManagement) { return __awaiter(void 0, void 0, void 0, function () {
    var reverseReferencesMap, missingRefs, fieldsWithUnknownTargetType, replaceLookups;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                reverseReferencesMap = new DefaultMap(function () { return new Set(); });
                missingRefs = [];
                fieldsWithUnknownTargetType = new DefaultMap(function () { return new Set(); });
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
                                        var refTo, refTarget, targetTypeName, brokenRefBehavior, _b, _c, _d, _e, _f, _g, _h, _j;
                                        var _k, _l;
                                        var _m;
                                        return __generator(this, function (_o) {
                                            switch (_o.label) {
                                                case 0:
                                                    if (!utils_1.isReferenceField(field)) {
                                                        return [2 /*return*/, value];
                                                    }
                                                    refTo = utils_1.referenceFieldTargetTypes(field);
                                                    refTarget = refTo
                                                        .map(function (targetTypeName) { return internalToInstance[serializeInternalID(targetTypeName, value)]; })
                                                        .filter(isDefined)
                                                        .pop();
                                                    if (!(refTarget === undefined)) return [3 /*break*/, 8];
                                                    if (lodash_1["default"].isEmpty(value)) {
                                                        return [2 /*return*/, value];
                                                    }
                                                    if (utils_1.isReadOnlyField(field)
                                                        || ((_m = field === null || field === void 0 ? void 0 : field.annotations) === null || _m === void 0 ? void 0 : _m[adapter_api_1.CORE_ANNOTATIONS.HIDDEN_VALUE]) === true) {
                                                        return [2 /*return*/, value];
                                                    }
                                                    targetTypeName = refTo.length === 1 ? refTo[0] : internalToTypeName(value);
                                                    if (targetTypeName === undefined) {
                                                        fieldsWithUnknownTargetType.get(field.elemID.getFullName()).add(value);
                                                    }
                                                    brokenRefBehavior = dataManagement.brokenReferenceBehaviorForTargetType(targetTypeName);
                                                    _b = brokenRefBehavior;
                                                    switch (_b) {
                                                        case 'InternalId': return [3 /*break*/, 1];
                                                        case 'BrokenReference': return [3 /*break*/, 2];
                                                        case 'ExcludeInstance': return [3 /*break*/, 3];
                                                    }
                                                    return [3 /*break*/, 7];
                                                case 1:
                                                    {
                                                        return [2 /*return*/, value];
                                                    }
                                                    _o.label = 2;
                                                case 2:
                                                    {
                                                        return [2 /*return*/, createMissingValueReference(new adapter_api_1.ElemID(constants_1.SALESFORCE, targetTypeName, 'instance'), value)];
                                                    }
                                                    _o.label = 3;
                                                case 3:
                                                    _d = (_c = missingRefs).push;
                                                    _k = {};
                                                    _l = {};
                                                    _e = transformer_1.apiName;
                                                    return [4 /*yield*/, instance.getType()];
                                                case 4: return [4 /*yield*/, _e.apply(void 0, [_o.sent(), true])];
                                                case 5:
                                                    _l.type = _o.sent();
                                                    return [4 /*yield*/, transformer_1.apiName(instance)];
                                                case 6:
                                                    _d.apply(_c, [(_k.origin = (_l.id = _o.sent(),
                                                            _l.field = field,
                                                            _l),
                                                            _k.targetId = instance.value[field.name],
                                                            _k)]);
                                                    return [2 /*return*/, value];
                                                case 7:
                                                    {
                                                        throw new Error('Unrecognized broken refs behavior. Is the configuration valid?');
                                                    }
                                                    _o.label = 8;
                                                case 8:
                                                    _h = (_g = reverseReferencesMap).get;
                                                    return [4 /*yield*/, serializeInstanceInternalID(refTarget)];
                                                case 9:
                                                    _j = (_f = _h.apply(_g, [_o.sent()]))
                                                        .add;
                                                    return [4 /*yield*/, serializeInstanceInternalID(instance)];
                                                case 10:
                                                    _j.apply(_f, [_o.sent()]);
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
                if (fieldsWithUnknownTargetType.size > 0) {
                    log.warn('The following fields have multiple %s annotations and contained internal IDs with an unknown key prefix. The default broken references behavior was used for them.', constants_1.FIELD_ANNOTATIONS.REFERENCE_TO);
                    fieldsWithUnknownTargetType.forEach(function (internalIds, fieldElemId) {
                        log.warn('Field %s: %o', fieldElemId, internalIds);
                    });
                }
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
    var objectTypes, objectTypesWithKeyPrefix, typeMap;
    return __generator(this, function (_a) {
        objectTypes = elements.filter(adapter_api_1.isObjectType);
        objectTypesWithKeyPrefix = objectTypes
            .filter(function (objectType) { return isDefined(objectType.annotations[constants_1.KEY_PREFIX]); });
        log.debug('%d/%d object types have a key prefix', objectTypesWithKeyPrefix.length, objectTypes.length);
        typeMap = lodash_1["default"].keyBy(objectTypesWithKeyPrefix, function (objectType) { return objectType.annotations[constants_1.KEY_PREFIX]; });
        return [2 /*return*/, mapValuesAsync(typeMap, function (objectType) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, transformer_1.apiName(objectType)];
            }); }); })];
    });
}); };
var filter = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        name: 'customObjectInstanceReferencesFilter',
        remote: true,
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var dataManagement, customObjectInstances, internalToInstance, internalIdPrefixToType, _a, reverseReferencesMap, missingRefs, instancesWithCollidingElemID, instancesWithEmptyId, missingRefOriginInternalIDs, instWithDupElemIDInterIDs, _b, instancesWithEmptyIdInternalIDs, _c, illegalRefTargets, illegalRefSources, invalidInstances, baseUrl;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        dataManagement = config.fetchProfile.dataManagement;
                        if (dataManagement === undefined) {
                            return [2 /*return*/, {}];
                        }
                        return [4 /*yield*/, awu(elements).filter(transformer_1.isInstanceOfCustomObject)
                                .toArray()];
                    case 1:
                        customObjectInstances = _e.sent();
                        return [4 /*yield*/, keyByAsync(customObjectInstances, serializeInstanceInternalID)];
                    case 2:
                        internalToInstance = _e.sent();
                        return [4 /*yield*/, buildCustomObjectPrefixKeyMap(elements)];
                    case 3:
                        internalIdPrefixToType = _e.sent();
                        return [4 /*yield*/, replaceLookupsWithRefsAndCreateRefMap(customObjectInstances, internalToInstance, function (internalId) { return internalIdPrefixToType[internalId.slice(0, constants_1.KEY_PREFIX_LENGTH)]; }, dataManagement)];
                    case 4:
                        _a = _e.sent(), reverseReferencesMap = _a.reverseReferencesMap, missingRefs = _a.missingRefs;
                        instancesWithCollidingElemID = adapter_utils_1.getInstancesWithCollidingElemID(customObjectInstances);
                        instancesWithEmptyId = customObjectInstances.filter(function (instance) { return instance.elemID.name === adapter_api_1.ElemID.CONFIG_NAME; });
                        missingRefOriginInternalIDs = new Set(missingRefs
                            .map(function (missingRef) { return serializeInternalID(missingRef.origin.type, missingRef.origin.id); }));
                        _b = Set.bind;
                        return [4 /*yield*/, Promise.all(instancesWithCollidingElemID.map(serializeInstanceInternalID))];
                    case 5:
                        instWithDupElemIDInterIDs = new (_b.apply(Set, [void 0, _e.sent()]))();
                        _c = Set.bind;
                        return [4 /*yield*/, Promise.all(instancesWithEmptyId.map(serializeInstanceInternalID))];
                    case 6:
                        instancesWithEmptyIdInternalIDs = new (_c.apply(Set, [void 0, _e.sent()]))();
                        illegalRefTargets = new Set(__spreadArrays(missingRefOriginInternalIDs, instWithDupElemIDInterIDs, instancesWithEmptyIdInternalIDs));
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
                    case 7:
                        _e.sent();
                        return [4 /*yield*/, client.getUrl()];
                    case 8:
                        baseUrl = _e.sent();
                        _d = {};
                        return [4 /*yield*/, createWarnings(instancesWithCollidingElemID, instancesWithEmptyId, missingRefs, illegalRefSources, dataManagement, baseUrl === null || baseUrl === void 0 ? void 0 : baseUrl.origin)];
                    case 9: return [2 /*return*/, (_d.errors = _e.sent(),
                            _d)];
                }
            });
        }); },
    });
};
exports["default"] = filter;
