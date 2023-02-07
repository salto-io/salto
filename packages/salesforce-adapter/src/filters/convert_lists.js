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
exports.makeFilter = exports.convertList = void 0;
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
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../constants");
var hardcoded_lists_json_1 = require("./hardcoded_lists.json");
var transformer_1 = require("../transformers/transformer");
var convert_maps_1 = require("./convert_maps");
var awu = lowerdash_1.collections.asynciterable.awu;
var fieldsToSort = [
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'CleanDataService', 'field', 'cleanRules'),
        orderBy: 'developerName',
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'CleanRule', 'field', 'fieldMappings'),
        orderBy: 'developerName',
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'FieldMapping', 'field', 'fieldMappingRows'),
        orderBy: 'fieldName',
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'FieldMappingRow', 'field', 'fieldMappingFields'),
        orderBy: 'dataServiceField',
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'DuplicateRule', 'field', 'duplicateRuleMatchRules'),
        orderBy: 'matchingRule',
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'DuplicateRuleMatchRule', 'field', 'objectMapping'),
        orderBy: ['inputObject', 'outputObject'],
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'LeadConvertSettings', 'field', 'objectMapping'),
        orderBy: ['inputObject', 'outputObject'],
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'ObjectMapping', 'field', 'mappingFields'),
        orderBy: ['inputField', 'outputField'],
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'BusinessProcess', 'field', 'values'),
        orderBy: 'fullName',
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'PlatformActionList', 'field', 'platformActionListItems'),
        orderBy: function (val) { return Number(val.sortOrder); },
    },
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'QuickActionList', 'field', 'quickActionListItems'),
        orderBy: 'quickActionName',
    },
];
var annotationsToSort = [
    {
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'MacroInstruction', 'field', 'Target', 'valueSet'),
        orderBy: 'fullName',
    },
];
var markListRecursively = function (type, values) { return __awaiter(void 0, void 0, void 0, function () {
    var markList;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                markList = function (field, value) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, _b, _c, _d, _e;
                    return __generator(this, function (_f) {
                        switch (_f.label) {
                            case 0:
                                _a = lodash_1["default"].isArray(value);
                                if (!_a) return [3 /*break*/, 2];
                                _b = adapter_api_1.isListType;
                                return [4 /*yield*/, field.getType()];
                            case 1:
                                _a = !_b.apply(void 0, [_f.sent()]);
                                _f.label = 2;
                            case 2:
                                if (!_a) return [3 /*break*/, 4];
                                // This assumes Salesforce does not have list of lists fields
                                _c = field;
                                _d = adapter_api_1.createRefToElmWithValue;
                                _e = adapter_api_1.ListType.bind;
                                return [4 /*yield*/, field.getType()];
                            case 3:
                                // This assumes Salesforce does not have list of lists fields
                                _c.refType = _d.apply(void 0, [new (_e.apply(adapter_api_1.ListType, [void 0, _f.sent()]))()]);
                                _f.label = 4;
                            case 4: return [2 /*return*/, value];
                        }
                    });
                }); };
                return [4 /*yield*/, adapter_utils_1.applyRecursive(type, values, markList)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var castListRecursively = function (type, values, unorderedLists) {
    if (unorderedLists === void 0) { unorderedLists = []; }
    return __awaiter(void 0, void 0, void 0, function () {
        var listOrders, castLists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    listOrders = lodash_1["default"].fromPairs(unorderedLists.map(function (sortDef) { return [sortDef.elemID.getFullName(), sortDef.orderBy]; }));
                    castLists = function (field, value) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b, orderBy;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _a = adapter_api_1.isListType;
                                    return [4 /*yield*/, field.getType()];
                                case 1:
                                    if (_a.apply(void 0, [_c.sent()]) && !lodash_1["default"].isArray(value)) {
                                        return [2 /*return*/, [value]];
                                    }
                                    _b = adapter_api_1.isListType;
                                    return [4 /*yield*/, field.getType()];
                                case 2:
                                    // We get from sfdc api list with empty strings for empty object (possibly jsforce issue)
                                    if (_b.apply(void 0, [_c.sent()]) && lodash_1["default"].isArray(value)
                                        && lodash_1["default"].isEmpty(value.filter(function (v) { return !lodash_1["default"].isEmpty(v); }))) {
                                        return [2 /*return*/, []];
                                    }
                                    orderBy = listOrders[field.elemID.getFullName()];
                                    return [2 /*return*/, orderBy ? lodash_1["default"].orderBy(value, orderBy) : value];
                            }
                        });
                    }); };
                    return [4 /*yield*/, adapter_utils_1.applyRecursive(type, values, castLists)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
};
var markHardcodedLists = function (type, knownListIds) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, awu(lodash_1["default"].values(type.fields))
                .filter(function (f) { return knownListIds.has(f.elemID.getFullName()); })
                .forEach(function (f) { return __awaiter(void 0, void 0, void 0, function () {
                var fieldType;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, f.getType()
                            // maps are created synthetically and should not be converted here
                        ];
                        case 1:
                            fieldType = _a.sent();
                            // maps are created synthetically and should not be converted here
                            if (!adapter_api_1.isContainerType(fieldType)) {
                                f.refType = adapter_api_1.createRefToElmWithValue(new adapter_api_1.ListType(fieldType));
                            }
                            return [2 /*return*/];
                    }
                });
            }); })];
    });
}); };
var sortAnnotations = function (type, unorderedLists) {
    if (unorderedLists === void 0) { unorderedLists = []; }
    unorderedLists.forEach(function (_a) {
        var elemId = _a.elemID, orderBy = _a.orderBy;
        var parentId = elemId.createParentID();
        var parent = adapter_utils_1.resolvePath(type, parentId);
        var parentValues = adapter_api_1.isElement(parent) ? parent.annotations : parent;
        var annotationValue = lodash_1["default"].get(parentValues, elemId.name);
        if (annotationValue === undefined)
            return;
        var sortedAnnotation = lodash_1["default"].orderBy(annotationValue, orderBy);
        lodash_1["default"].set(parentValues, elemId.name, sortedAnnotation);
    });
};
var convertList = function (type, values) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, markListRecursively(type, values)];
            case 1:
                _a.sent();
                return [4 /*yield*/, castListRecursively(type, values)];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.convertList = convertList;
var getMapFieldIds = function (types) { return __awaiter(void 0, void 0, void 0, function () {
    var objectsWithMapFields, allObjectsFields, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, awu(types).filter(function (obj) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _b = (_a = Object.keys(convert_maps_1.metadataTypeToFieldToMapDef)).includes;
                            return [4 /*yield*/, transformer_1.metadataType(obj)];
                        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                    }
                }); }); }).toArray()];
            case 1:
                objectsWithMapFields = _b.sent();
                if (!(objectsWithMapFields.length > 0)) return [3 /*break*/, 3];
                allObjectsFields = objectsWithMapFields.flatMap(function (obj) { return Object.values(obj.fields); });
                _a = Set.bind;
                return [4 /*yield*/, awu(allObjectsFields)
                        .filter(function (f) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = convert_maps_1.metadataTypeToFieldToMapDef;
                                return [4 /*yield*/, transformer_1.metadataType(f.parent)];
                            case 1: return [2 /*return*/, _a[_b.sent()] !== undefined];
                        }
                    }); }); })
                        .filter(function (f) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = convert_maps_1.metadataTypeToFieldToMapDef;
                                return [4 /*yield*/, transformer_1.metadataType(f.parent)];
                            case 1: return [2 /*return*/, _a[_b.sent()][f.name] !== undefined];
                        }
                    }); }); }).map(function (f) { return f.elemID.getFullName(); })
                        .toArray()];
            case 2: return [2 /*return*/, new (_a.apply(Set, [void 0, _b.sent()]))()];
            case 3: return [2 /*return*/, new Set()];
        }
    });
}); };
/**
 * Mark list fields as lists if there is any instance that has a list value in the field,
 * or if the list field is explicitly hardcoded as list.
 * Unfortunately it seems like this is the only way to know if a field is a list or a single value
 * in the Salesforce API.
 * After marking all fields as lists we also convert all values that should be lists to a list
 * This step is needed because the API never returns lists of length 1
 */
var makeFilter = function (unorderedListFields, unorderedListAnnotations, hardcodedLists) { return function () { return ({
    /**
     * Upon fetch, mark all list fields as list fields in all fetched types
     *
     * @param elements the already fetched elements
     */
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        var instances, objectTypes, mapFieldIds, knownListIds;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, awu(elements)
                        .filter(adapter_api_1.isInstanceElement)
                        .filter(function (inst) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = adapter_api_1.isObjectType;
                                return [4 /*yield*/, inst.getType()];
                            case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                        }
                    }); }); })
                        .toArray()];
                case 1:
                    instances = _a.sent();
                    objectTypes = elements.filter(adapter_api_1.isObjectType);
                    return [4 /*yield*/, getMapFieldIds(objectTypes)];
                case 2:
                    mapFieldIds = _a.sent();
                    knownListIds = new Set(__spreadArrays(hardcodedLists, unorderedListFields.map(function (sortDef) { return sortDef.elemID.getFullName(); })).filter(function (id) { return !mapFieldIds.has(id); }));
                    return [4 /*yield*/, awu(objectTypes).forEach(function (t) { return markHardcodedLists(t, knownListIds); })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, awu(instances).forEach(function (inst) { return __awaiter(void 0, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _a = markListRecursively;
                                        return [4 /*yield*/, inst.getType()];
                                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent(), inst.value])];
                                }
                            });
                        }); })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, awu(instances).forEach(function (inst) { return __awaiter(void 0, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _a = castListRecursively;
                                        return [4 /*yield*/, inst.getType()];
                                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent(), inst.value, unorderedListFields])];
                                }
                            });
                        }); })];
                case 5:
                    _a.sent();
                    objectTypes.forEach(function (t) { return sortAnnotations(t, unorderedListAnnotations); });
                    return [2 /*return*/];
            }
        });
    }); },
}); }; };
exports.makeFilter = makeFilter;
exports["default"] = exports.makeFilter(fieldsToSort, annotationsToSort, hardcoded_lists_json_1["default"]);
