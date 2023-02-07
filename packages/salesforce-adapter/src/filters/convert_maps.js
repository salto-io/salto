"use strict";
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
exports.findTypeToConvert = exports.findInstancesToConvert = exports.getInstanceChanges = exports.metadataTypeToFieldToMapDef = exports.PROFILE_MAP_FIELD_DEF = exports.PERMISSIONS_SET_MAP_FIELD_DEF = exports.defaultMapper = void 0;
var lodash_1 = require("lodash");
var adapter_api_1 = require("@salto-io/adapter-api");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var logging_1 = require("@salto-io/logging");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var awu = lowerdash_1.collections.asynciterable.awu;
var isDefined = lowerdash_1.values.isDefined;
var makeArray = lowerdash_1.collections.array.makeArray;
var log = logging_1.logger(module);
/**
 * Convert a string value into the map index keys.
 * Note: Reference expressions are not supported yet (the resolved value is not populated in fetch)
 * so this filter has to run before any filter adding references on the objects with the specified
 * metadata types (e.g Profile).
 */
var defaultMapper = function (val) { return (val.split(constants_1.API_NAME_SEPARATOR).map(function (v) { return adapter_utils_1.naclCase(v); })); };
exports.defaultMapper = defaultMapper;
var BUSINESS_HOURS_MAP_FIELD_DEF = {
    // One-level maps
    businessHours: { key: 'name' },
};
exports.PERMISSIONS_SET_MAP_FIELD_DEF = {
    // One-level maps
    applicationVisibilities: { key: 'application' },
    classAccesses: { key: 'apexClass' },
    customMetadataTypeAccesses: { key: 'name' },
    customPermissions: { key: 'name' },
    customSettingAccesses: { key: 'name' },
    externalDataSourceAccesses: { key: 'externalDataSource' },
    flowAccesses: { key: 'flow' },
    objectPermissions: { key: 'object' },
    pageAccesses: { key: 'apexPage' },
    userPermissions: { key: 'name' },
    // Two-level maps
    fieldPermissions: { key: 'field', nested: true },
    fieldLevelSecurities: { key: 'field', nested: true },
    recordTypeVisibilities: { key: 'recordType', nested: true },
};
exports.PROFILE_MAP_FIELD_DEF = __assign(__assign({}, exports.PERMISSIONS_SET_MAP_FIELD_DEF), { 
    // Non-unique maps (multiple values can have the same key)
    categoryGroupVisibilities: { key: 'dataCategoryGroup', mapToList: true }, layoutAssignments: { key: 'layout', mapToList: true } });
var EMAIL_TEMPLATE_MAP_FIELD_DEF = {
    // One-level maps
    attachments: { key: 'name' },
};
var LIGHTNING_COMPONENT_BUNDLE_MAP = {
    'lwcResources.lwcResource': { key: 'filePath', mapper: (function (item) { return [adapter_utils_1.naclCase(lodash_1["default"].last(item.split('/')))]; }) },
};
exports.metadataTypeToFieldToMapDef = (_a = {},
    _a[constants_1.BUSINESS_HOURS_METADATA_TYPE] = BUSINESS_HOURS_MAP_FIELD_DEF,
    _a[constants_1.EMAIL_TEMPLATE_METADATA_TYPE] = EMAIL_TEMPLATE_MAP_FIELD_DEF,
    _a[constants_1.PROFILE_METADATA_TYPE] = exports.PROFILE_MAP_FIELD_DEF,
    _a[constants_1.PERMISSION_SET_METADATA_TYPE] = exports.PERMISSIONS_SET_MAP_FIELD_DEF,
    _a[constants_1.LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE] = LIGHTNING_COMPONENT_BUNDLE_MAP,
    _a);
/**
 * Convert the specified instance fields into maps.
 * Choose between unique maps and lists based on each field's conversion definition. If a field
 * should use a unique map but fails due to conflicts, convert it to a list map, and include it
 * in the returned list so that it can be converted across the board.
 *
 * @param instance             The instance to modify
 * @param instanceMapFieldDef  The definitions of the fields to covert
 * @returns                   The list of fields that were converted to non-unique due to duplicates
 */
var convertArraysToMaps = function (instance, instanceMapFieldDef) {
    // fields that were intended to be unique, but have multiple values under to the same map key
    var nonUniqueMapFields = [];
    var convertField = function (values, keyFunc, useList, fieldName) {
        if (!useList) {
            var res = lodash_1["default"].keyBy(values, function (item) { return keyFunc(item); });
            if (Object.keys(res).length === values.length) {
                return res;
            }
            nonUniqueMapFields.push(fieldName);
        }
        return lodash_1["default"].groupBy(values, function (item) { return keyFunc(item); });
    };
    Object.entries(instanceMapFieldDef).filter(function (_a) {
        var fieldName = _a[0];
        return lodash_1["default"].get(instance.value, fieldName) !== undefined;
    }).forEach(function (_a) {
        var _b;
        var fieldName = _a[0], mapDef = _a[1];
        var mapper = (_b = mapDef.mapper) !== null && _b !== void 0 ? _b : exports.defaultMapper;
        if (mapDef.nested) {
            var firstLevelGroups = lodash_1["default"].groupBy(makeArray(lodash_1["default"].get(instance.value, fieldName)), (function (item) { return mapper(item[mapDef.key])[0]; }));
            lodash_1["default"].set(instance.value, fieldName, lodash_1["default"].mapValues(firstLevelGroups, function (firstLevelValues) { return convertField(firstLevelValues, function (item) { return mapper(item[mapDef.key])[1]; }, !!mapDef.mapToList, fieldName); }));
        }
        else {
            lodash_1["default"].set(instance.value, fieldName, convertField(makeArray(lodash_1["default"].get(instance.value, fieldName)), function (item) { return mapper(item[mapDef.key])[0]; }, !!mapDef.mapToList, fieldName));
        }
    });
    return nonUniqueMapFields;
};
/**
 * Make sure all values in the specified non-unique fields are arrays.
 *
 * @param instance             The instance instance to update
 * @param nonUniqueMapFields  The list of fields to convert to arrays
 * @param instanceMapFieldDef  The original field mapping definition
 */
var convertValuesToMapArrays = function (instance, nonUniqueMapFields, instanceMapFieldDef) {
    nonUniqueMapFields.forEach(function (fieldName) {
        var _a;
        if ((_a = instanceMapFieldDef[fieldName]) === null || _a === void 0 ? void 0 : _a.nested) {
            lodash_1["default"].set(instance.value, fieldName, lodash_1["default"].mapValues(lodash_1["default"].get(instance.value, fieldName), function (val) { return lodash_1["default"].mapValues(val, makeArray); }));
        }
        else {
            lodash_1["default"].set(instance.value, fieldName, lodash_1["default"].mapValues(lodash_1["default"].get(instance.value, fieldName), makeArray));
        }
    });
};
/**
 * Update the instance object type's fields to use maps.
 *
 * @param instanceType          The instance to update
 * @param nonUniqueMapFields  The list of fields to convert to arrays
 * @param instanceMapFieldDef  The original field mapping definition
 */
var updateFieldTypes = function (instanceType, nonUniqueMapFields, instanceMapFieldDef) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        Object.entries(instanceMapFieldDef).forEach(function (_a) {
            var fieldName = _a[0], mapDef = _a[1];
            return __awaiter(void 0, void 0, void 0, function () {
                var field, fieldType, innerType, _b, deepInnerType, keyFieldType;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, adapter_api_1.getField(instanceType, fieldName.split('.'))];
                        case 1:
                            field = _c.sent();
                            if (!isDefined(field)) return [3 /*break*/, 7];
                            return [4 /*yield*/, field.getType()
                                // navigate to the right field type
                            ];
                        case 2:
                            fieldType = _c.sent();
                            if (!!adapter_api_1.isMapType(fieldType)) return [3 /*break*/, 7];
                            if (!adapter_api_1.isContainerType(fieldType)) return [3 /*break*/, 4];
                            return [4 /*yield*/, fieldType.getInnerType()];
                        case 3:
                            _b = _c.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            _b = fieldType;
                            _c.label = 5;
                        case 5:
                            innerType = _b;
                            if (mapDef.mapToList || nonUniqueMapFields.includes(fieldName)) {
                                innerType = new adapter_api_1.ListType(innerType);
                            }
                            if (mapDef.nested) {
                                field.refType = adapter_api_1.createRefToElmWithValue(new adapter_api_1.MapType(new adapter_api_1.MapType(innerType)));
                            }
                            else {
                                field.refType = adapter_api_1.createRefToElmWithValue(new adapter_api_1.MapType(innerType));
                            }
                            return [4 /*yield*/, adapter_api_1.getDeepInnerType(innerType)];
                        case 6:
                            deepInnerType = _c.sent();
                            if (adapter_api_1.isObjectType(deepInnerType)) {
                                keyFieldType = deepInnerType.fields[mapDef.key];
                                if (!keyFieldType) {
                                    log.error('could not find key field %s for field %s', mapDef.key, field.elemID.getFullName());
                                    return [2 /*return*/];
                                }
                                keyFieldType.annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true;
                            }
                            _c.label = 7;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        });
        return [2 /*return*/];
    });
}); };
var convertInstanceFieldsToMaps = function (instancesToConvert, instanceMapFieldDef) { return __awaiter(void 0, void 0, void 0, function () {
    var nonUniqueMapFields, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                nonUniqueMapFields = lodash_1["default"].uniq(instancesToConvert.flatMap(function (instance) { return convertArraysToMaps(instance, instanceMapFieldDef); }));
                if (!(nonUniqueMapFields.length > 0)) return [3 /*break*/, 2];
                _b = (_a = log).info;
                _c = "Converting the following fields to non-unique maps: " + nonUniqueMapFields + ",\n     instances types are: ";
                return [4 /*yield*/, awu(instancesToConvert).map(function (inst) { return transformer_1.metadataType(inst); }).toArray()];
            case 1:
                _b.apply(_a, [_c + (_d.sent())]);
                instancesToConvert.forEach(function (instance) {
                    convertValuesToMapArrays(instance, nonUniqueMapFields, instanceMapFieldDef);
                });
                _d.label = 2;
            case 2: return [2 /*return*/, nonUniqueMapFields];
        }
    });
}); };
/**
 * Convert instance field values from maps back to arrays before deploy.
 *
 * @param instanceChanges          The instance changes to deploy
 * @param instanceMapFieldDef      The definitions of the fields to covert
 */
var convertFieldsBackToLists = function (instanceChanges, instanceMapFieldDef) { return __awaiter(void 0, void 0, void 0, function () {
    var toVals, backToArrays;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                toVals = function (values) { return Object.values(values).flat(); };
                backToArrays = function (instance) {
                    Object.keys(instanceMapFieldDef).filter(function (fieldName) { return lodash_1["default"].get(instance.value, fieldName) !== undefined; }).forEach(function (fieldName) {
                        if (Array.isArray(lodash_1["default"].get(instance.value, fieldName))) {
                            // should not happen
                            return;
                        }
                        if (instanceMapFieldDef[fieldName].nested) {
                            // first convert the inner levels to arrays, then merge into one array
                            lodash_1["default"].set(instance.value, fieldName, lodash_1["default"].mapValues(lodash_1["default"].get(instance.value, fieldName), toVals));
                        }
                        lodash_1["default"].set(instance.value, fieldName, toVals(lodash_1["default"].get(instance.value, fieldName)));
                    });
                    return instance;
                };
                return [4 /*yield*/, awu(instanceChanges).forEach(function (instanceChange) {
                        return adapter_utils_1.applyFunctionToChangeData(instanceChange, backToArrays);
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
/**
 * Convert instance's field values from arrays back to maps after deploy.
 *
 * @param instanceChanges  The instance changes to deploy
 * @param instanceMapFieldDef      The definitions of the fields to covert
 */
var convertFieldsBackToMaps = function (instanceChanges, instanceMapFieldDef) {
    instanceChanges.forEach(function (instanceChange) {
        return adapter_utils_1.applyFunctionToChangeData(instanceChange, function (instance) {
            convertArraysToMaps(instance, instanceMapFieldDef);
            return instance;
        });
    });
};
/**
 * Convert fields from maps back to lists pre-deploy.
 *
 * @param instanceType          The type to update
 * @param instanceMapFieldDef  The field mapping definition
 */
var convertFieldTypesBackToLists = function (instanceType, instanceMapFieldDef) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        Object.entries(instanceMapFieldDef).forEach(function (_a) {
            var fieldName = _a[0];
            return __awaiter(void 0, void 0, void 0, function () {
                var field, fieldType, _b, _c, newFieldType, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0: return [4 /*yield*/, adapter_api_1.getField(instanceType, fieldName.split('.'))];
                        case 1:
                            field = _f.sent();
                            if (!isDefined(field)) return [3 /*break*/, 7];
                            return [4 /*yield*/, field.getType()];
                        case 2:
                            fieldType = _f.sent();
                            if (!adapter_api_1.isMapType(fieldType)) return [3 /*break*/, 4];
                            _b = field;
                            _c = adapter_api_1.createRefToElmWithValue;
                            return [4 /*yield*/, fieldType.getInnerType()];
                        case 3:
                            _b.refType = _c.apply(void 0, [_f.sent()]);
                            _f.label = 4;
                        case 4: return [4 /*yield*/, field.getType()];
                        case 5:
                            newFieldType = _f.sent();
                            if (!adapter_api_1.isMapType(newFieldType)) return [3 /*break*/, 7];
                            _d = field;
                            _e = adapter_api_1.createRefToElmWithValue;
                            return [4 /*yield*/, newFieldType.getInnerType()];
                        case 6:
                            _d.refType = _e.apply(void 0, [_f.sent()]);
                            _f.label = 7;
                        case 7: return [2 /*return*/];
                    }
                });
            });
        });
        return [2 /*return*/];
    });
}); };
var getInstanceChanges = function (changes, targetMetadataType) { return (awu(changes)
    .filter(adapter_api_1.isAdditionOrModificationChange)
    .filter(adapter_api_1.isInstanceChange)
    .filter(function (change) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    switch (_a.label) {
        case 0: return [4 /*yield*/, transformer_1.metadataType(adapter_api_1.getChangeData(change))];
        case 1: return [2 /*return*/, (_a.sent()) === targetMetadataType];
    }
}); }); })
    .toArray()); };
exports.getInstanceChanges = getInstanceChanges;
var findInstancesToConvert = function (elements, targetMetadataType) {
    var instances = elements.filter(adapter_api_1.isInstanceElement);
    return awu(instances).filter(function (e) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, transformer_1.metadataType(e)];
            case 1: return [2 /*return*/, (_a.sent()) === targetMetadataType];
        }
    }); }); }).toArray();
};
exports.findInstancesToConvert = findInstancesToConvert;
var findTypeToConvert = function (elements, targetMetadataType) { return __awaiter(void 0, void 0, void 0, function () {
    var types;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                types = elements.filter(adapter_api_1.isObjectType);
                return [4 /*yield*/, awu(types).filter(function (e) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, transformer_1.metadataType(e)];
                            case 1: return [2 /*return*/, (_a.sent()) === targetMetadataType];
                        }
                    }); }); }).toArray()];
            case 1: return [2 /*return*/, (_a.sent())[0]];
        }
    });
}); };
exports.findTypeToConvert = findTypeToConvert;
/**
 * Convert certain instances' fields into maps, so that they are easier to view,
 * could be referenced, and can be split across multiple files.
 */
var filter = function () { return ({
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, awu(Object.keys(exports.metadataTypeToFieldToMapDef)).forEach(function (targetMetadataType) { return __awaiter(void 0, void 0, void 0, function () {
                        var instancesToConvert, typeToConvert, mapFieldDef, nonUniqueMapFields;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, exports.findInstancesToConvert(elements, targetMetadataType)];
                                case 1:
                                    instancesToConvert = _a.sent();
                                    return [4 /*yield*/, exports.findTypeToConvert(elements, targetMetadataType)];
                                case 2:
                                    typeToConvert = _a.sent();
                                    mapFieldDef = exports.metadataTypeToFieldToMapDef[targetMetadataType];
                                    if (!isDefined(typeToConvert)) return [3 /*break*/, 7];
                                    if (!(instancesToConvert.length === 0)) return [3 /*break*/, 4];
                                    return [4 /*yield*/, updateFieldTypes(typeToConvert, [], mapFieldDef)];
                                case 3:
                                    _a.sent();
                                    return [3 /*break*/, 7];
                                case 4: return [4 /*yield*/, convertInstanceFieldsToMaps(instancesToConvert, mapFieldDef)];
                                case 5:
                                    nonUniqueMapFields = _a.sent();
                                    return [4 /*yield*/, updateFieldTypes(typeToConvert, nonUniqueMapFields, mapFieldDef)];
                                case 6:
                                    _a.sent();
                                    _a.label = 7;
                                case 7: return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, awu(Object.keys(exports.metadataTypeToFieldToMapDef)).forEach(function (targetMetadataType) { return __awaiter(void 0, void 0, void 0, function () {
                        var instanceChanges, mapFieldDef, instanceType;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, exports.getInstanceChanges(changes, targetMetadataType)];
                                case 1:
                                    instanceChanges = _a.sent();
                                    if (instanceChanges.length === 0) {
                                        return [2 /*return*/];
                                    }
                                    mapFieldDef = exports.metadataTypeToFieldToMapDef[targetMetadataType];
                                    // since transformElement and salesforce do not require list fields to be defined as lists,
                                    // we only mark fields as lists of their map inner value is a list,
                                    // so that we can convert the object back correctly in onDeploy
                                    return [4 /*yield*/, convertFieldsBackToLists(instanceChanges, mapFieldDef)];
                                case 2:
                                    // since transformElement and salesforce do not require list fields to be defined as lists,
                                    // we only mark fields as lists of their map inner value is a list,
                                    // so that we can convert the object back correctly in onDeploy
                                    _a.sent();
                                    return [4 /*yield*/, adapter_api_1.getChangeData(instanceChanges[0]).getType()];
                                case 3:
                                    instanceType = _a.sent();
                                    return [4 /*yield*/, convertFieldTypesBackToLists(instanceType, mapFieldDef)];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, awu(Object.keys(exports.metadataTypeToFieldToMapDef)).forEach(function (targetMetadataType) { return __awaiter(void 0, void 0, void 0, function () {
                        var instanceChanges, mapFieldDef, instanceType, nonUniqueMapFields;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, exports.getInstanceChanges(changes, targetMetadataType)];
                                case 1:
                                    instanceChanges = _a.sent();
                                    if (instanceChanges.length === 0) {
                                        return [2 /*return*/];
                                    }
                                    mapFieldDef = exports.metadataTypeToFieldToMapDef[targetMetadataType];
                                    convertFieldsBackToMaps(instanceChanges, mapFieldDef);
                                    return [4 /*yield*/, adapter_api_1.getChangeData(instanceChanges[0]).getType()
                                        // after preDeploy, the fields with lists are exactly the ones that should be converted
                                        // back to lists
                                    ];
                                case 2:
                                    instanceType = _a.sent();
                                    return [4 /*yield*/, awu(Object.keys(instanceType.fields)).filter(function (fieldName) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    _a = adapter_api_1.isListType;
                                                    return [4 /*yield*/, (instanceType.fields[fieldName].getType())];
                                                case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                                            }
                                        }); }); }).toArray()];
                                case 3:
                                    nonUniqueMapFields = _a.sent();
                                    return [4 /*yield*/, updateFieldTypes(instanceType, nonUniqueMapFields, mapFieldDef)];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
}); };
exports["default"] = filter;
