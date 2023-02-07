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
var lodash_1 = require("lodash");
var adapter_api_1 = require("@salto-io/adapter-api");
var lowerdash_1 = require("@salto-io/lowerdash");
var logging_1 = require("@salto-io/logging");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var isDefined = lowerdash_1.values.isDefined;
var log = logging_1.logger(module);
var STANDARD_ENTITY_TYPES = ['StandardEntity', 'User'];
// temporary workaround for SALTO-1162 until we switch to using bulk api v2 -
// there is a max of 2000 entries returned per query, so we separate the heavy
// types to their own queries to increase the limit (may extend / make this dynamic in the future)
var REFERENCING_TYPES_TO_FETCH_INDIVIDUALLY = ['Layout', 'Flow', 'ApexClass', 'ApexPage', 'CustomField'];
/**
 * Get a list of known dependencies between metadata components.
 *
 * @param client  The client to use to run the query
 */
var getDependencies = function (client) { return __awaiter(void 0, void 0, void 0, function () {
    var allTypes, whereClauses, allQueries, allDepsIters, allDepsResults, deps;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                allTypes = REFERENCING_TYPES_TO_FETCH_INDIVIDUALLY.map(function (t) { return "'" + t + "'"; }).join(', ');
                whereClauses = __spreadArrays(REFERENCING_TYPES_TO_FETCH_INDIVIDUALLY.map(function (t) { return "MetadataComponentType='" + t + "'"; }), [
                    "MetadataComponentType NOT IN (" + allTypes + ")",
                ]);
                allQueries = whereClauses.map(function (clause) { return "SELECT \n    MetadataComponentId, MetadataComponentType, MetadataComponentName, \n    RefMetadataComponentId, RefMetadataComponentType, RefMetadataComponentName \n  FROM MetadataComponentDependency WHERE " + clause; });
                return [4 /*yield*/, Promise.all(allQueries.map(function (q) { return client.queryAll(q, true); }))];
            case 1:
                allDepsIters = _a.sent();
                allDepsResults = allDepsIters.map(function (iter) { return lowerdash_1.collections.asynciterable.mapAsync(iter, function (recs) { return recs.map(function (rec) { return ({
                    from: {
                        type: rec.MetadataComponentType,
                        id: rec.MetadataComponentId,
                        name: rec.MetadataComponentName,
                    },
                    to: {
                        type: rec.RefMetadataComponentType,
                        id: rec.RefMetadataComponentId,
                        name: rec.RefMetadataComponentName,
                    },
                }); }); }); });
                return [4 /*yield*/, Promise.all(allDepsResults.map(function (res) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, lowerdash_1.collections.asynciterable.toArrayAsync(res)];
                            case 1: return [2 /*return*/, (_a.sent()).flat()];
                        }
                    }); }); }))];
            case 2:
                deps = (_a.sent()).flat();
                return [2 /*return*/, lodash_1["default"].values(lodash_1["default"].groupBy(deps, function (dep) { return Object.entries(dep.from); })).map(function (depArr) { return ({
                        from: depArr[0].from,
                        to: depArr.map(function (dep) { return dep.to; }),
                    }); })];
        }
    });
}); };
/**
 * Add references to the generated-dependencies annotation,
 * except for those already referenced elsewhere.
 *
 * @param elem        The element to modify
 * @param refElemIDs  The reference ids to add
 */
var addGeneratedDependencies = function (elem, refElemIDs) {
    if (refElemIDs.length === 0) {
        return;
    }
    var existingReferences = adapter_utils_1.getAllReferencedIds(elem);
    var newDependencies = refElemIDs
        .filter(function (elemId) { return !existingReferences.has(elemId.getFullName()); })
        .map(function (elemId) { return new adapter_api_1.ReferenceExpression(elemId); });
    if (newDependencies.length !== 0) {
        adapter_utils_1.extendGeneratedDependencies(elem, newDependencies.map(function (reference) { return ({ reference: reference }); }));
    }
};
/**
 * Add an annotation with the references that are not already represented more granularly
 * in the element.
 *
 * @param groupedDeps         All dependencies, grouped by src
 * @param elemLookup          Element lookup by type and internal salesforce id
 * @param customObjectLookup  Element lookup for custom objects
 */
var addExtraReferences = function (groupedDeps, fetchedElements, elemLookup, customObjectLookup) { return __awaiter(void 0, void 0, void 0, function () {
    var getElemId, getFetchedElement;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                getElemId = function (_a) {
                    var type = _a.type, id = _a.id;
                    // Special case handling:
                    // - standard entities are returned with type=StandardEntity and id=<entity name>
                    // - User is returned with type=User and id=User
                    if (STANDARD_ENTITY_TYPES.includes(type)) {
                        return customObjectLookup.get(id);
                    }
                    return elemLookup.get(type, id);
                };
                getFetchedElement = function (elemId) { return __awaiter(void 0, void 0, void 0, function () {
                    var elem;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (elemId.idType !== 'field') {
                                    return [2 /*return*/, fetchedElements.get(elemId)];
                                }
                                return [4 /*yield*/, fetchedElements.get(elemId.createParentID())];
                            case 1:
                                elem = _a.sent();
                                return [2 /*return*/, adapter_api_1.isObjectType(elem)
                                        ? elem.fields[elemId.name]
                                        : undefined];
                        }
                    });
                }); };
                return [4 /*yield*/, awu(groupedDeps).forEach(function (edge) { return __awaiter(void 0, void 0, void 0, function () {
                        var elemId, elem, dependencies, missingDeps;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    elemId = getElemId(edge.from);
                                    if (elemId === undefined) {
                                        log.debug('Element %s:%s (%s) no found, skipping %d dependencies', edge.from.type, edge.from.id, edge.from.name, edge.to.length);
                                        return [2 /*return*/];
                                    }
                                    return [4 /*yield*/, getFetchedElement(elemId)];
                                case 1:
                                    elem = _a.sent();
                                    if (elem === undefined) {
                                        log.debug('Element %s was not fetched in this operation, skipping %d dependencies', elemId.getFullName(), edge.to.length);
                                        return [2 /*return*/];
                                    }
                                    dependencies = edge.to.map(function (dst) { return ({ dep: dst, elemId: getElemId(dst) }); });
                                    missingDeps = dependencies
                                        .filter(function (item) { return item.elemId === undefined; })
                                        .map(function (item) { return item.dep; });
                                    missingDeps.forEach(function (dep) {
                                        log.debug("Referenced element " + dep.type + ":" + dep.id + " (" + dep.name + ") not found for " + elem.elemID.getFullName());
                                    });
                                    addGeneratedDependencies(elem, dependencies.map(function (item) { return item.elemId; }).filter(isDefined));
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.WARNING_MESSAGE = 'Encountered an error while trying to query your salesforce account for additional configuration dependencies.';
/**
 * Add references using the tooling API.
 */
var creator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: exports.WARNING_MESSAGE,
            config: config,
            filterName: 'extraDependencies',
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var groupedDeps, fetchedElements, allElements, _a, elemLookup, customObjectLookup, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0: return [4 /*yield*/, getDependencies(client)];
                        case 1:
                            groupedDeps = _e.sent();
                            fetchedElements = adapter_utils_1.buildElementsSourceFromElements(elements);
                            allElements = utils_1.buildElementsSourceForFetch(elements, config);
                            _c = (_b = lowerdash_1.multiIndex.buildMultiIndex()
                                .addIndex({
                                name: 'elemLookup',
                                filter: utils_1.hasInternalId,
                                key: function (elem) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, transformer_1.metadataType(elem)];
                                        case 1: return [2 /*return*/, [_a.sent(), utils_1.getInternalId(elem)]];
                                    }
                                }); }); },
                                map: function (elem) { return elem.elemID; },
                            })
                                .addIndex({
                                name: 'customObjectLookup',
                                filter: function (elem) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    return [2 /*return*/, transformer_1.isCustomObject(elem)];
                                }); }); },
                                key: function (elem) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, transformer_1.apiName(elem)];
                                        case 1: return [2 /*return*/, [_a.sent()]];
                                    }
                                }); }); },
                                map: function (elem) { return elem.elemID; },
                            }))
                                .process;
                            _d = awu;
                            return [4 /*yield*/, allElements.getAll()];
                        case 2: return [4 /*yield*/, _c.apply(_b, [_d.apply(void 0, [_e.sent()]).flatMap(utils_1.extractFlatCustomObjectFields)])];
                        case 3:
                            _a = _e.sent(), elemLookup = _a.elemLookup, customObjectLookup = _a.customObjectLookup;
                            return [4 /*yield*/, addExtraReferences(groupedDeps, fetchedElements, elemLookup, customObjectLookup)];
                        case 4:
                            _e.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = creator;
