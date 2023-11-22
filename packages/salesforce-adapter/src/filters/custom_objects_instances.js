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
exports.getCustomObjectsFetchSettings = exports.getIdFields = exports.getAllInstances = exports.transformRecordToValues = void 0;
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
var logging_1 = require("@salto-io/logging");
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var config_change_1 = require("../config_change");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var _a = lowerdash_1.promises.object, mapValuesAsync = _a.mapValuesAsync, pickAsync = _a.pickAsync;
var isDefined = lowerdash_1.values.isDefined;
var makeArray = lowerdash_1.collections.array.makeArray;
var _b = lowerdash_1.collections.asynciterable, keyByAsync = _b.keyByAsync, awu = _b.awu;
var log = logging_1.logger(module);
var defaultRecordKeysToOmit = ['attributes'];
var nameSeparator = '___';
var aliasSeparator = ' ';
var getQueryableFields = function (object) { return (Object.values(object.fields).filter(utils_1.isQueryableField)); };
var buildQueryStrings = function (typeName, fields, ids, managedBySaltoField) { return __awaiter(void 0, void 0, void 0, function () {
    var fieldNames, queryConditions;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, awu(fields)
                    .flatMap(utils_1.getFieldNamesForQuery)
                    .toArray()];
            case 1:
                fieldNames = _b.sent();
                queryConditions = __spreadArrays(makeArray(ids).map(function (id) { return ({ Id: "'" + id + "'" }); }), (managedBySaltoField !== undefined ? [(_a = {}, _a[managedBySaltoField] = 'TRUE', _a)] : []));
                return [2 /*return*/, utils_1.buildSelectQueries(typeName, fieldNames, queryConditions)];
        }
    });
}); };
var getRecords = function (_a) {
    var client = _a.client, _b = _a.customObjectFetchSettings, objectType = _b.objectType, managedBySaltoField = _b.managedBySaltoField, omittedFields = _b.omittedFields, ids = _a.ids;
    return __awaiter(void 0, void 0, void 0, function () {
        var typeName, queryableFields, queryableFieldNames, queries, records;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    typeName = utils_1.apiNameSync(objectType);
                    if (!typeName) {
                        log.warn('Object %s has no API name', objectType.elemID.getFullName());
                        return [2 /*return*/, {}];
                    }
                    queryableFields = getQueryableFields(objectType)
                        .filter(function (field) { var _a; return !omittedFields.includes((_a = utils_1.apiNameSync(field)) !== null && _a !== void 0 ? _a : ''); });
                    if (lodash_1["default"].isEmpty(queryableFields)) {
                        queryableFieldNames = queryableFields.map(function (field) { return utils_1.apiNameSync(field); });
                        log.debug('Type %s had no queryable fields or they were all omitted. %o', typeName, { omittedFields: omittedFields, queryableFieldNames: queryableFieldNames });
                        return [2 /*return*/, {}];
                    }
                    log.debug('Fetching records for type %s%s', typeName, managedBySaltoField ? ", filtering by " + managedBySaltoField : '');
                    return [4 /*yield*/, buildQueryStrings(typeName, queryableFields, ids, managedBySaltoField)];
                case 1:
                    queries = _c.sent();
                    log.debug('Queries: %o', queries);
                    return [4 /*yield*/, utils_1.queryClient(client, queries)];
                case 2:
                    records = _c.sent();
                    log.debug("Fetched " + records.length + " records of type " + typeName);
                    return [2 /*return*/, lodash_1["default"].keyBy(records, function (record) { return record[constants_1.CUSTOM_OBJECT_ID_FIELD]; })];
            }
        });
    });
};
var transformCompoundNameValues = function (type, recordValue) { return __awaiter(void 0, void 0, void 0, function () {
    var nameSubFields, nameFieldName, _a, _b, subNameValues;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                nameSubFields = Object.keys(transformer_1.Types.compoundDataTypes.Name.fields);
                _b = (_a = Object).keys;
                return [4 /*yield*/, pickAsync(type.fields, transformer_1.isNameField)];
            case 1:
                nameFieldName = _b.apply(_a, [_d.sent()])[0];
                subNameValues = lodash_1["default"].pick(recordValue, nameSubFields);
                return [2 /*return*/, (lodash_1["default"].isUndefined(nameFieldName) || lodash_1["default"].isEmpty(subNameValues))
                        ? recordValue
                        : __assign(__assign({}, lodash_1["default"].omit(recordValue, nameSubFields)), (_c = {}, _c[nameFieldName] = subNameValues, _c[constants_1.CUSTOM_OBJECT_ID_FIELD] = recordValue[constants_1.CUSTOM_OBJECT_ID_FIELD], _c))];
        }
    });
}); };
var omitDefaultKeys = function (recordValue) {
    var _a;
    return (__assign(__assign({}, lodash_1["default"].omit(recordValue, defaultRecordKeysToOmit)), (_a = {}, _a[constants_1.CUSTOM_OBJECT_ID_FIELD] = recordValue[constants_1.CUSTOM_OBJECT_ID_FIELD], _a)));
};
var transformRecordToValues = function (type, recordValue) { return __awaiter(void 0, void 0, void 0, function () {
    var valuesWithTransformedName;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, transformCompoundNameValues(type, recordValue)];
            case 1:
                valuesWithTransformedName = _a.sent();
                return [2 /*return*/, omitDefaultKeys(valuesWithTransformedName)];
        }
    });
}); };
exports.transformRecordToValues = transformRecordToValues;
var recordToInstance = function (_a) {
    var type = _a.type, record = _a.record, instanceSaltoName = _a.instanceSaltoName, instanceAlias = _a.instanceAlias;
    return __awaiter(void 0, void 0, void 0, function () {
        var getInstancePath, name, _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    getInstancePath = function (instanceName) { return __awaiter(void 0, void 0, void 0, function () {
                        var typeNamespace, instanceFileName;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, utils_1.getNamespace(type)];
                                case 1:
                                    typeNamespace = _a.sent();
                                    instanceFileName = adapter_utils_1.pathNaclCase(instanceName);
                                    if (typeNamespace) {
                                        return [2 /*return*/, [constants_1.SALESFORCE, constants_1.INSTALLED_PACKAGES_PATH, typeNamespace,
                                                constants_1.RECORDS_PATH, type.elemID.typeName, instanceFileName]];
                                    }
                                    return [2 /*return*/, [constants_1.SALESFORCE, constants_1.RECORDS_PATH, type.elemID.typeName, instanceFileName]];
                            }
                        });
                    }); };
                    name = transformer_1.Types.getElemId(instanceSaltoName, true, transformer_1.createInstanceServiceIds(lodash_1["default"].pick(record, constants_1.CUSTOM_OBJECT_ID_FIELD), type)).name;
                    _b = adapter_api_1.InstanceElement.bind;
                    _c = [void 0, name,
                        type];
                    return [4 /*yield*/, exports.transformRecordToValues(type, record)];
                case 1:
                    _c = _c.concat([_e.sent()]);
                    return [4 /*yield*/, getInstancePath(name)];
                case 2: return [2 /*return*/, new (_b.apply(adapter_api_1.InstanceElement, _c.concat([_e.sent(),
                        instanceAlias !== undefined && instanceAlias !== ''
                            ? (_d = {}, _d[adapter_api_1.CORE_ANNOTATIONS.ALIAS] = instanceAlias, _d) : {}])))()];
            }
        });
    });
};
var typesRecordsToInstances = function (recordByIdAndType, customObjectFetchSetting) { return __awaiter(void 0, void 0, void 0, function () {
    var typesToUnresolvedRefFields, addUnresolvedRefFieldByType, saltoNameByIdAndType, aliasByIdAndType, setSaltoName, getSaltoName, getAlias, setAlias, getRecordSaltoName, getRecordAlias, instances, configChangeSuggestions;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                typesToUnresolvedRefFields = {};
                addUnresolvedRefFieldByType = function (typeName, unresolvedFieldName) {
                    if (typesToUnresolvedRefFields[typeName] === undefined) {
                        typesToUnresolvedRefFields[typeName] = new Set([unresolvedFieldName]);
                    }
                    typesToUnresolvedRefFields[typeName].add(unresolvedFieldName);
                };
                saltoNameByIdAndType = {};
                aliasByIdAndType = {};
                setSaltoName = function (typeName, recordId, saltoName) {
                    if (saltoNameByIdAndType[typeName] === undefined) {
                        saltoNameByIdAndType[typeName] = {};
                    }
                    saltoNameByIdAndType[typeName][recordId] = saltoName;
                };
                getSaltoName = function (typeName, recordId) { var _a; return (_a = saltoNameByIdAndType[typeName]) === null || _a === void 0 ? void 0 : _a[recordId]; };
                getAlias = function (typeName, recordId) { var _a; return (_a = aliasByIdAndType[typeName]) === null || _a === void 0 ? void 0 : _a[recordId]; };
                setAlias = function (typeName, recordId, alias) {
                    if (aliasByIdAndType[typeName] === undefined) {
                        aliasByIdAndType[typeName] = {};
                    }
                    aliasByIdAndType[typeName][recordId] = alias;
                };
                getRecordSaltoName = function (typeName, record) { return __awaiter(void 0, void 0, void 0, function () {
                    var fieldToSaltoName, saltoName, saltoIdFields, saltoIdsValues, fullName;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                fieldToSaltoName = function (field) { return __awaiter(void 0, void 0, void 0, function () {
                                    var fieldValue, referencedTypeNames, referencedName;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                fieldValue = record[field.name];
                                                if (fieldValue === null || fieldValue === undefined) {
                                                    return [2 /*return*/, undefined];
                                                }
                                                if (!utils_1.isReferenceField(field)) {
                                                    return [2 /*return*/, fieldValue.toString()];
                                                }
                                                referencedTypeNames = utils_1.referenceFieldTargetTypes(field);
                                                return [4 /*yield*/, awu(referencedTypeNames).map(function (referencedTypeName) {
                                                        var _a;
                                                        var rec = (_a = recordByIdAndType[referencedTypeName]) === null || _a === void 0 ? void 0 : _a[fieldValue];
                                                        if (rec === undefined) {
                                                            log.debug("Failed to find record with id " + fieldValue + " of type " + referencedTypeName + " when looking for reference");
                                                            return undefined;
                                                        }
                                                        return getRecordSaltoName(referencedTypeName, rec);
                                                    }).find(isDefined)];
                                            case 1:
                                                referencedName = _a.sent();
                                                if (referencedName === undefined) {
                                                    addUnresolvedRefFieldByType(typeName, field.name);
                                                }
                                                return [2 /*return*/, referencedName];
                                        }
                                    });
                                }); };
                                saltoName = getSaltoName(typeName, record[constants_1.CUSTOM_OBJECT_ID_FIELD]);
                                if (saltoName !== undefined) {
                                    return [2 /*return*/, saltoName];
                                }
                                saltoIdFields = customObjectFetchSetting[typeName].idFields;
                                return [4 /*yield*/, awu(saltoIdFields)
                                        .map(function (field) { return fieldToSaltoName(field); })
                                        .filter(isDefined)
                                        .toArray()];
                            case 1:
                                saltoIdsValues = _a.sent();
                                fullName = saltoIdsValues.join(nameSeparator);
                                setSaltoName(typeName, record[constants_1.CUSTOM_OBJECT_ID_FIELD], fullName);
                                return [2 /*return*/, fullName];
                        }
                    });
                }); };
                getRecordAlias = function (typeName, record) { return __awaiter(void 0, void 0, void 0, function () {
                    var fieldToAlias, existingAlias, alias;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                fieldToAlias = function (field) { return __awaiter(void 0, void 0, void 0, function () {
                                    var fieldValue, referencedTypeNames;
                                    return __generator(this, function (_a) {
                                        fieldValue = record[field.name];
                                        if (fieldValue === null || fieldValue === undefined) {
                                            return [2 /*return*/, undefined];
                                        }
                                        if (!utils_1.isReferenceField(field)) {
                                            return [2 /*return*/, fieldValue.toString()];
                                        }
                                        referencedTypeNames = utils_1.referenceFieldTargetTypes(field);
                                        return [2 /*return*/, awu(referencedTypeNames).map(function (referencedTypeName) {
                                                var _a;
                                                var rec = (_a = recordByIdAndType[referencedTypeName]) === null || _a === void 0 ? void 0 : _a[fieldValue];
                                                if (rec === undefined) {
                                                    log.debug("Failed to find record with id " + fieldValue + " of type " + referencedTypeName + " when looking for reference");
                                                    return undefined;
                                                }
                                                return getRecordAlias(referencedTypeName, rec);
                                            }).find(isDefined)];
                                    });
                                }); };
                                existingAlias = getAlias(typeName, record[constants_1.CUSTOM_OBJECT_ID_FIELD]);
                                if (existingAlias !== undefined) {
                                    return [2 /*return*/, existingAlias];
                                }
                                return [4 /*yield*/, awu(customObjectFetchSetting[typeName].aliasFields)
                                        .map(function (field) { return fieldToAlias(field); })
                                        .filter(function (fieldAlias) { return fieldAlias !== undefined && fieldAlias !== ''; })
                                        .toArray()];
                            case 1:
                                alias = (_a.sent()).join(aliasSeparator);
                                setAlias(typeName, record[constants_1.CUSTOM_OBJECT_ID_FIELD], alias);
                                return [2 /*return*/, alias];
                        }
                    });
                }); };
                return [4 /*yield*/, awu(Object.entries(recordByIdAndType))
                        .flatMap(function (_a) {
                        var typeName = _a[0], idToRecord = _a[1];
                        return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_b) {
                                return [2 /*return*/, (awu(Object.values(idToRecord))
                                        .map(function (record) { return __awaiter(void 0, void 0, void 0, function () {
                                        var _a;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    _a = {
                                                        type: customObjectFetchSetting[typeName].objectType,
                                                        record: record
                                                    };
                                                    return [4 /*yield*/, getRecordSaltoName(typeName, record)];
                                                case 1:
                                                    _a.instanceSaltoName = _b.sent();
                                                    return [4 /*yield*/, getRecordAlias(typeName, record)];
                                                case 2: return [2 /*return*/, (_a.instanceAlias = _b.sent(),
                                                        _a)];
                                            }
                                        });
                                    }); })
                                        .filter(function (recToInstanceParams) { return __awaiter(void 0, void 0, void 0, function () {
                                        var _a, _b;
                                        return __generator(this, function (_c) {
                                            switch (_c.label) {
                                                case 0:
                                                    _b = (_a = Object.keys(typesToUnresolvedRefFields)).includes;
                                                    return [4 /*yield*/, transformer_1.apiName(recToInstanceParams.type)];
                                                case 1: return [2 /*return*/, !_b.apply(_a, [_c.sent()])];
                                            }
                                        });
                                    }); })
                                        .map(recordToInstance))];
                            });
                        });
                    }).toArray()];
            case 1:
                instances = _a.sent();
                configChangeSuggestions = Object.entries(typesToUnresolvedRefFields)
                    .map(function (_a) {
                    var typeName = _a[0], unresolvedRefFields = _a[1];
                    return config_change_1.createUnresolvedRefIdFieldConfigChange(typeName, __spreadArrays(unresolvedRefFields));
                });
                return [2 /*return*/, {
                        instances: instances,
                        configChangeSuggestions: configChangeSuggestions,
                    }];
        }
    });
}); };
var getTargetRecordIds = function (type, records, allowedRefToTypeNames) {
    var referenceFieldsToTargets = Object.fromEntries(Object.values(type.fields)
        .filter(utils_1.isReferenceField)
        .map(function (field) { return [
        field.name,
        utils_1.referenceFieldTargetTypes(field).filter(function (typeName) { return allowedRefToTypeNames.includes(typeName); }),
    ]; }));
    return records.flatMap(function (record) {
        return Object.entries(referenceFieldsToTargets)
            .filter(function (_a) {
            var fieldName = _a[0];
            return lodash_1["default"].isString(record[fieldName]);
        })
            .flatMap(function (_a) {
            var fieldName = _a[0], targets = _a[1];
            return (targets.map(function (targetTypeName) { return ({ targetTypeName: targetTypeName, id: record[fieldName] }); }));
        });
    });
};
var getReferencedRecords = function (client, customObjectFetchSetting, baseRecordByIdAndType) { return __awaiter(void 0, void 0, void 0, function () {
    var allReferenceRecords, allowedRefToTypeNames, getMissingReferencedIds, getReferencedRecordsRecursively;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                allReferenceRecords = {};
                allowedRefToTypeNames = Object.keys(lodash_1["default"].pickBy(customObjectFetchSetting, function (setting) { return !setting.isBase; }));
                getMissingReferencedIds = function (records) {
                    var missingReferencedRecordIds = Object.entries(records)
                        .flatMap(function (_a) {
                        var typeName = _a[0], idToRecords = _a[1];
                        var type = customObjectFetchSetting[typeName].objectType;
                        var sfRecords = Object.values(idToRecords);
                        var targetRecordIds = getTargetRecordIds(type, sfRecords, allowedRefToTypeNames);
                        return targetRecordIds
                            // Filter out already fetched target records
                            .filter(function (_a) {
                            var _b;
                            var targetTypeName = _a.targetTypeName, id = _a.id;
                            return ((_b = allReferenceRecords[targetTypeName]) === null || _b === void 0 ? void 0 : _b[id]) === undefined;
                        });
                    });
                    var referencedRecordsById = lodash_1["default"].groupBy(missingReferencedRecordIds, function (t) { return t.targetTypeName; });
                    return lodash_1["default"].mapValues(referencedRecordsById, function (tuples) { return lodash_1["default"].uniq(tuples.map(function (t) { return t.id; })); });
                };
                getReferencedRecordsRecursively = function (currentLevelRecords) { return __awaiter(void 0, void 0, void 0, function () {
                    var typeToMissingIds, newReferencedRecords;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                typeToMissingIds = getMissingReferencedIds(currentLevelRecords);
                                return [4 /*yield*/, mapValuesAsync(typeToMissingIds, function (ids, typeName) {
                                        var fetchSettings = customObjectFetchSetting[typeName];
                                        return getRecords({ client: client, customObjectFetchSettings: fetchSettings, ids: ids });
                                    })];
                            case 1:
                                newReferencedRecords = _a.sent();
                                if (lodash_1["default"].isEmpty(newReferencedRecords)) {
                                    return [2 /*return*/];
                                }
                                lodash_1["default"].merge(allReferenceRecords, newReferencedRecords);
                                return [4 /*yield*/, getReferencedRecordsRecursively(newReferencedRecords)];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); };
                return [4 /*yield*/, getReferencedRecordsRecursively(baseRecordByIdAndType)];
            case 1:
                _a.sent();
                return [2 /*return*/, allReferenceRecords];
        }
    });
}); };
var getAllInstances = function (client, customObjectFetchSetting) { return __awaiter(void 0, void 0, void 0, function () {
    var baseTypesSettings, baseRecordByTypeAndId, referencedRecordsByTypeAndId, mergedRecords;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                baseTypesSettings = lodash_1["default"].pickBy(customObjectFetchSetting, function (setting) { return setting.isBase; });
                log.debug('Base types: %o', lodash_1["default"].keys(baseTypesSettings));
                return [4 /*yield*/, mapValuesAsync(baseTypesSettings, function (setting) { return getRecords({ client: client, customObjectFetchSettings: setting }); })
                    // Get reference to records
                ];
            case 1:
                baseRecordByTypeAndId = _a.sent();
                return [4 /*yield*/, getReferencedRecords(client, customObjectFetchSetting, baseRecordByTypeAndId)];
            case 2:
                referencedRecordsByTypeAndId = _a.sent();
                mergedRecords = __assign(__assign({}, referencedRecordsByTypeAndId), baseRecordByTypeAndId);
                return [2 /*return*/, typesRecordsToInstances(mergedRecords, customObjectFetchSetting)];
        }
    });
}); };
exports.getAllInstances = getAllInstances;
var getParentFieldNames = function (fields) {
    return fields
        .filter(utils_1.isMasterDetailField)
        .map(function (field) { return field.name; });
};
var getIdFields = function (type, dataManagement) { return __awaiter(void 0, void 0, void 0, function () {
    var typeName, idFieldsNames, idFieldsWithParents, aliasFieldNames, aliasFieldsWithParents, invalidIdFieldNames, _a, aliasFields, invalidAliasFields;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, transformer_1.apiName(type)];
            case 1:
                typeName = _b.sent();
                idFieldsNames = dataManagement.getObjectIdsFields(typeName);
                idFieldsWithParents = idFieldsNames.flatMap(function (fieldName) {
                    return ((fieldName === constants_1.DETECTS_PARENTS_INDICATOR)
                        ? getParentFieldNames(Object.values(type.fields)) : fieldName);
                });
                aliasFieldNames = dataManagement.getObjectAliasFields(typeName);
                aliasFieldsWithParents = aliasFieldNames.flatMap(function (fieldName) {
                    return ((fieldName === constants_1.DETECTS_PARENTS_INDICATOR)
                        ? getParentFieldNames(Object.values(type.fields)) : fieldName);
                });
                invalidIdFieldNames = idFieldsWithParents.filter(function (fieldName) { return (type.fields[fieldName] === undefined || !utils_1.isQueryableField(type.fields[fieldName])); });
                _a = lodash_1["default"].partition(aliasFieldsWithParents, function (fieldName) { return type.fields[fieldName] !== undefined && utils_1.isQueryableField(type.fields[fieldName]); }), aliasFields = _a[0], invalidAliasFields = _a[1];
                if (invalidIdFieldNames.length > 0) {
                    return [2 /*return*/, { idFields: [], aliasFields: [], invalidIdFields: invalidIdFieldNames, invalidAliasFields: invalidAliasFields }];
                }
                return [2 /*return*/, {
                        idFields: idFieldsWithParents.map(function (fieldName) { return type.fields[fieldName]; }),
                        aliasFields: aliasFields.map((function (fieldName) { return type.fields[fieldName]; })),
                        invalidIdFields: [],
                        invalidAliasFields: invalidAliasFields,
                    }];
        }
    });
}); };
exports.getIdFields = getIdFields;
var getCustomObjectsFetchSettings = function (types, dataManagement) { return __awaiter(void 0, void 0, void 0, function () {
    var isInvalidManagedBySaltoField, typeToFetchSettings;
    return __generator(this, function (_a) {
        isInvalidManagedBySaltoField = function (type) {
            var _a;
            var managedBySaltoFieldName = dataManagement.managedBySaltoFieldForType(type);
            if (managedBySaltoFieldName === undefined) {
                return false;
            }
            return ((_a = type.fields[managedBySaltoFieldName].annotations[constants_1.FIELD_ANNOTATIONS.QUERYABLE]) !== null && _a !== void 0 ? _a : true) === false;
        };
        typeToFetchSettings = function (type) { return __awaiter(void 0, void 0, void 0, function () {
            var managedBySaltoFieldName, typeApiName, _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        managedBySaltoFieldName = dataManagement.managedBySaltoFieldForType(type);
                        typeApiName = utils_1.apiNameSync(type);
                        _b = { objectType: type };
                        return [4 /*yield*/, dataManagement.shouldFetchObjectType(type)];
                    case 1:
                        _a = [(_b.isBase = (_c.sent()) === 'Always', _b)];
                        return [4 /*yield*/, exports.getIdFields(type, dataManagement)];
                    case 2: return [2 /*return*/, __assign.apply(void 0, [__assign.apply(void 0, _a.concat([_c.sent()])), { managedBySaltoField: managedBySaltoFieldName, invalidManagedBySaltoField: isInvalidManagedBySaltoField(type) ? managedBySaltoFieldName : undefined, omittedFields: typeApiName ? dataManagement.omittedFieldsForType(typeApiName) : [] }])];
                }
            });
        }); };
        return [2 /*return*/, awu(types)
                .filter(function (type) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, dataManagement.shouldFetchObjectType(type)];
                    case 1: return [2 /*return*/, (_a.sent()) !== 'Never'];
                }
            }); }); })
                .map(typeToFetchSettings)
                .toArray()];
    });
}); };
exports.getCustomObjectsFetchSettings = getCustomObjectsFetchSettings;
var filterTypesWithManyInstances = function (_a) {
    var validChangesFetchSettings = _a.validChangesFetchSettings, maxInstancesPerType = _a.maxInstancesPerType, client = _a.client;
    return __awaiter(void 0, void 0, void 0, function () {
        var typesToFilter, heavyTypesSuggestions;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (maxInstancesPerType === constants_1.UNLIMITED_INSTANCES_VALUE) {
                        return [2 /*return*/, { filteredChangesFetchSettings: validChangesFetchSettings, heavyTypesSuggestions: [] }];
                    }
                    typesToFilter = [];
                    heavyTypesSuggestions = [];
                    // Creates a lists of typeNames and changeSuggestions for types with too many instances
                    return [4 /*yield*/, awu(Object.keys(validChangesFetchSettings))
                            .forEach(function (typeName) { return __awaiter(void 0, void 0, void 0, function () {
                            var instancesCount;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, client.countInstances(typeName)];
                                    case 1:
                                        instancesCount = _a.sent();
                                        if (instancesCount > maxInstancesPerType) {
                                            typesToFilter.push(typeName);
                                            heavyTypesSuggestions.push(config_change_1.createManyInstancesExcludeConfigChange({ typeName: typeName, instancesCount: instancesCount, maxInstancesPerType: maxInstancesPerType }));
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    // Creates a lists of typeNames and changeSuggestions for types with too many instances
                    _b.sent();
                    return [2 /*return*/, {
                            filteredChangesFetchSettings: lodash_1["default"].omit(validChangesFetchSettings, typesToFilter),
                            heavyTypesSuggestions: heavyTypesSuggestions,
                        }];
            }
        });
    });
};
var getInaccessibleCustomFields = function (objectType) { return (Object.values(objectType.fields)
    .filter(function (field) { return !utils_1.isQueryableField(field); })
    // these fields are either hidden or will end up being hidden
    .filter(function (field) { return !utils_1.isHiddenField(field) && !utils_1.isReadOnlyField(field); })
    .map(function (field) { return utils_1.apiNameSync(field); })
    .filter(isDefined)); };
var createInvalidAliasFieldFetchWarning = function (_a) {
    var objectType = _a.objectType, invalidAliasFields = _a.invalidAliasFields;
    return __awaiter(void 0, void 0, void 0, function () {
        var _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _c = {};
                    _b = "Invalid alias fields for type ";
                    return [4 /*yield*/, utils_1.safeApiName(objectType)];
                case 1: return [2 /*return*/, (_c.message = _b + (_d.sent()) + ": " + adapter_utils_1.safeJsonStringify(invalidAliasFields) + ". Value of these fields will be omitted from the Alias",
                        _c.severity = 'Warning',
                        _c)];
            }
        });
    });
};
var createInvalidManagedBySaltoFieldFetchWarning = function (_a) {
    var objectType = _a.objectType, invalidManagedBySaltoField = _a.invalidManagedBySaltoField;
    return __awaiter(void 0, void 0, void 0, function () {
        var _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _d = {};
                    _b = "The field ";
                    return [4 /*yield*/, transformer_1.apiName(objectType)];
                case 1:
                    _c = _b + (_e.sent()) + constants_1.API_NAME_SEPARATOR + invalidManagedBySaltoField + " is configured as the filter field in the saltoManagementFieldSettings.defaultFieldName section of the Salto environment configuration. However, the user configured for fetch does not have read access to this field. Records of type ";
                    return [4 /*yield*/, transformer_1.apiName(objectType)];
                case 2: return [2 /*return*/, (_d.message = _c + (_e.sent()) + " will not be fetched.",
                        _d.severity = 'Warning',
                        _d)];
            }
        });
    });
};
var createInaccessibleFieldsFetchWarning = function (objectType, inaccessibleFields) { return ({
    message: "There are " + inaccessibleFields.length + " fields in the " + utils_1.apiNameSync(objectType) + " object that the fetch user does not have access to. These are the fields: " + inaccessibleFields.join(',') + ". If " + utils_1.apiNameSync(objectType) + " records are deployed from this environment, values of these fields will appear as deletions.",
    severity: 'Info',
}); };
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        name: 'customObjectsInstancesFilter',
        remote: true,
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var dataManagement, customObjects, customObjectFetchSetting, _a, validFetchSettings, invalidFetchSettings, validChangesFetchSettings, _b, filteredChangesFetchSettings, heavyTypesSuggestions, _c, instances, configChangeSuggestions, invalidFieldSuggestions, invalidAliasFieldWarnings, invalidManagedBySaltoFieldWarnings, typesOfFetchedInstances, invalidPermissionsWarnings;
            var _d;
            var _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        dataManagement = config.fetchProfile.dataManagement;
                        if (dataManagement === undefined) {
                            return [2 /*return*/, {}];
                        }
                        return [4 /*yield*/, awu(elements).filter(transformer_1.isCustomObject).toArray()];
                    case 1:
                        customObjects = _f.sent();
                        return [4 /*yield*/, exports.getCustomObjectsFetchSettings(customObjects, dataManagement)];
                    case 2:
                        customObjectFetchSetting = _f.sent();
                        _a = lodash_1["default"].partition(customObjectFetchSetting, function (setting) { return setting.invalidIdFields.length === 0 && setting.invalidManagedBySaltoField === undefined; }), validFetchSettings = _a[0], invalidFetchSettings = _a[1];
                        return [4 /*yield*/, keyByAsync(validFetchSettings, function (setting) { return transformer_1.apiName(setting.objectType); })];
                    case 3:
                        validChangesFetchSettings = _f.sent();
                        return [4 /*yield*/, filterTypesWithManyInstances({
                                validChangesFetchSettings: validChangesFetchSettings,
                                maxInstancesPerType: config.fetchProfile.maxInstancesPerType,
                                client: client,
                            })];
                    case 4:
                        _b = _f.sent(), filteredChangesFetchSettings = _b.filteredChangesFetchSettings, heavyTypesSuggestions = _b.heavyTypesSuggestions;
                        return [4 /*yield*/, exports.getAllInstances(client, filteredChangesFetchSettings)];
                    case 5:
                        _c = _f.sent(), instances = _c.instances, configChangeSuggestions = _c.configChangeSuggestions;
                        instances.forEach(function (instance) { return elements.push(instance); });
                        log.debug("Fetched " + instances.length + " instances of Custom Objects");
                        return [4 /*yield*/, awu(invalidFetchSettings)
                                .map(function (setting) { return __awaiter(void 0, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _a = config_change_1.createInvlidIdFieldConfigChange;
                                            return [4 /*yield*/, transformer_1.apiName(setting.objectType)];
                                        case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent(), makeArray(setting.invalidIdFields)])];
                                    }
                                });
                            }); })
                                .toArray()];
                    case 6:
                        invalidFieldSuggestions = _f.sent();
                        invalidAliasFieldWarnings = awu(customObjectFetchSetting)
                            .filter(function (setting) { return setting.invalidAliasFields.length > 0; })
                            .map(createInvalidAliasFieldFetchWarning);
                        invalidManagedBySaltoFieldWarnings = awu(invalidFetchSettings)
                            .filter(function (setting) { return setting.invalidManagedBySaltoField !== undefined; })
                            .map(createInvalidManagedBySaltoFieldFetchWarning);
                        typesOfFetchedInstances = new Set(elements
                            .filter(adapter_api_1.isInstanceElement)
                            .map(function (instance) { return instance.getTypeSync(); })
                            .filter(utils_1.isCustomObjectSync) // we don't deploy metadata objects, so no reason to warn about them.
                        );
                        invalidPermissionsWarnings = [];
                        if ((_e = config.fetchProfile.isWarningEnabled('nonQueryableFields')) !== null && _e !== void 0 ? _e : false) {
                            invalidPermissionsWarnings = customObjectFetchSetting
                                .map(function (fetchSettings) { return fetchSettings.objectType; })
                                .filter(utils_1.isCustomObjectSync)
                                .map(function (objectType) { return ({ type: objectType, fields: getInaccessibleCustomFields(objectType) }); })
                                .filter(function (_a) {
                                var fields = _a.fields;
                                return fields.length > 0;
                            })
                                .filter(function (_a) {
                                var type = _a.type;
                                return typesOfFetchedInstances.has(type);
                            })
                                .map(function (_a) {
                                var type = _a.type, fields = _a.fields;
                                return createInaccessibleFieldsFetchWarning(type, fields);
                            });
                        }
                        _d = {
                            configSuggestions: __spreadArrays(invalidFieldSuggestions, heavyTypesSuggestions, configChangeSuggestions)
                        };
                        return [4 /*yield*/, invalidAliasFieldWarnings
                                .concat(invalidManagedBySaltoFieldWarnings)
                                .concat(invalidPermissionsWarnings)
                                .toArray()];
                    case 7: return [2 /*return*/, (_d.errors = _f.sent(),
                            _d)];
                }
            });
        }); },
    });
};
exports["default"] = filterCreator;
