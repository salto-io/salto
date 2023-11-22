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
exports.deployCustomObjectInstancesGroup = exports.isCustomObjectInstanceChanges = exports.isInstanceOfCustomObjectChange = exports.deleteInstances = exports.retryFlow = void 0;
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
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var os_1 = require("os");
var transformer_1 = require("./transformers/transformer");
var constants_1 = require("./constants");
var custom_objects_instances_1 = require("./filters/custom_objects_instances");
var utils_1 = require("./filters/utils");
var custom_settings_filter_1 = require("./filters/custom_settings_filter");
var data_management_1 = require("./fetch_profile/data_management");
var toArrayAsync = lowerdash_1.collections.asynciterable.toArrayAsync;
var partition = lowerdash_1.promises.array.partition;
var sleep = lowerdash_1.promises.timeout.sleep;
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, keyByAsync = _a.keyByAsync;
var toMD5 = lowerdash_1.hash.toMD5;
var log = logging_1.logger(module);
var logErroredInstances = function (instancesAndResults) { return (instancesAndResults.forEach(function (_a) {
    var instance = _a.instance, result = _a.result;
    if (result.errors !== undefined) {
        log.error("Instance " + instance.elemID.getFullName() + " had deploy errors - " + __spreadArrays([''], result.errors).join('\n\t') + "\n\nand values -\n" + adapter_utils_1.inspectValue(instance.value) + "\n");
    }
})); };
var getErrorInstancesFromInstAndResults = function (instancesAndResults) {
    return instancesAndResults.flatMap(function (_a) {
        var instance = _a.instance, result = _a.result;
        return (lowerdash_1.values.isDefined(result.errors)
            ? result.errors
                .filter(Boolean)
                .map(function (error) { return ({
                elemID: instance.elemID,
                message: error,
                severity: 'Error',
            }); })
            : []);
    });
};
var getAndLogErrors = function (instancesAndResults) {
    var errored = instancesAndResults
        .filter(function (_a) {
        var result = _a.result;
        return !result.success && result.errors !== undefined;
    });
    logErroredInstances(errored);
    return getErrorInstancesFromInstAndResults(errored);
};
var groupInstancesAndResultsByIndex = function (results, instances) {
    return (instances.map(function (instance, index) {
        return ({ instance: instance, result: results[index] });
    }));
};
var escapeWhereStr = function (str) {
    return str.replace(/(\\)|(')/g, function (escaped) { return "\\" + escaped; });
};
var formatValueForWhere = function (field, value) { return __awaiter(void 0, void 0, void 0, function () {
    var fieldType;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (value === undefined) {
                    return [2 /*return*/, 'null'];
                }
                return [4 /*yield*/, field.getType()];
            case 1:
                fieldType = _a.sent();
                if (adapter_api_1.isPrimitiveType(fieldType)) {
                    if (fieldType.primitive === adapter_api_1.PrimitiveTypes.STRING) {
                        return [2 /*return*/, "'" + escapeWhereStr(value) + "'"];
                    }
                    return [2 /*return*/, value.toString()];
                }
                throw new Error("Can not create WHERE clause for non-primitive field " + field.name);
        }
    });
}); };
var isCompoundFieldType = function (type) { return (adapter_api_1.isObjectType(type)
    && Object.values(transformer_1.Types.compoundDataTypes).some(function (compoundType) { return compoundType.isEqual(type); })); };
var MANDATORY_FIELDS_FOR_UPDATE = [constants_1.CUSTOM_OBJECT_ID_FIELD, constants_1.OWNER_ID];
var getRecordsBySaltoIds = function (type, instances, saltoIdFields, client) { return __awaiter(void 0, void 0, void 0, function () {
    var getFieldNamesToValues, instanceIdValues, fieldsToQuery, _a, _b, _c, _d, queries, _e, recordsIterable;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                getFieldNamesToValues = function (instance, field) { return __awaiter(void 0, void 0, void 0, function () {
                    var fieldType, _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, field.getType()];
                            case 1:
                                fieldType = _b.sent();
                                if (isCompoundFieldType(fieldType)) {
                                    return [2 /*return*/, Promise.all(Object.values(fieldType.fields)
                                            .map(function (innerField) { return __awaiter(void 0, void 0, void 0, function () {
                                            var _a;
                                            var _b;
                                            return __generator(this, function (_c) {
                                                switch (_c.label) {
                                                    case 0:
                                                        _a = [lowerdash_1.strings.capitalizeFirstLetter(innerField.name)];
                                                        return [4 /*yield*/, formatValueForWhere(innerField, (_b = instance.value[field.name]) === null || _b === void 0 ? void 0 : _b[innerField.name])];
                                                    case 1: return [2 /*return*/, _a.concat([
                                                            _c.sent()
                                                        ])];
                                                }
                                            });
                                        }); }))];
                                }
                                return [4 /*yield*/, transformer_1.apiName(field, true)];
                            case 2:
                                _a = [_b.sent()];
                                return [4 /*yield*/, formatValueForWhere(field, instance.value[field.name])];
                            case 3: return [2 /*return*/, [
                                    _a.concat([_b.sent()])
                                ]];
                        }
                    });
                }); };
                return [4 /*yield*/, Promise.all(instances.map(function (inst) { return __awaiter(void 0, void 0, void 0, function () {
                        var idFieldsNameToValue, r;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, Promise.all(saltoIdFields.map(function (field) { return getFieldNamesToValues(inst, field); }))];
                                case 1:
                                    idFieldsNameToValue = (_a.sent()).flat();
                                    r = Object.fromEntries(idFieldsNameToValue);
                                    return [2 /*return*/, r];
                            }
                        });
                    }); }))];
            case 1:
                instanceIdValues = _f.sent();
                _b = (_a = lodash_1["default"]).uniq;
                // Should always query these fields along the SaltoIdFields as they're mandatory for update operation
                _d = (_c = MANDATORY_FIELDS_FOR_UPDATE
                    // Some mandatory fields might not be in the type (e.g. for custom settings or the detail side of
                    // master-detail relationship for CustomObjects)
                    .filter(function (mandatoryField) { return Object.keys(type.fields).includes(mandatoryField); }))
                    .concat;
                return [4 /*yield*/, awu(saltoIdFields).flatMap(utils_1.getFieldNamesForQuery).toArray()];
            case 2:
                fieldsToQuery = _b.apply(_a, [
                    // Should always query these fields along the SaltoIdFields as they're mandatory for update operation
                    _d.apply(_c, [(_f.sent())])]);
                _e = utils_1.buildSelectQueries;
                return [4 /*yield*/, transformer_1.apiName(type)];
            case 3: return [4 /*yield*/, _e.apply(void 0, [_f.sent(), fieldsToQuery,
                    instanceIdValues])];
            case 4:
                queries = _f.sent();
                recordsIterable = awu(queries).flatMap(function (query) { return client.queryAll(query); });
                return [4 /*yield*/, toArrayAsync(recordsIterable)];
            case 5: 
            // Possible REBASE issue
            // const selectStr = await buildSelectStr(saltoIdFieldsWithIdField)
            // const fieldsWheres = await awu(saltoIdFields)
            //   .flatMap(async e => makeArray(await computeWhereConditions(e)))
            //   .toArray()
            // const whereStr = fieldsWheres.join(' AND ')
            // const query = `SELECT ${selectStr} FROM ${await apiName(type)} WHERE ${whereStr}`
            // const recordsIterable = await client.queryAll(query)
            return [2 /*return*/, (_f.sent()).flat()];
        }
    });
}); };
var getDataManagementFromCustomSettings = function (instances) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = data_management_1.buildDataManagement;
                _d = {};
                _b = "^";
                _c = transformer_1.apiName;
                return [4 /*yield*/, instances[0].getType()];
            case 1: return [4 /*yield*/, _c.apply(void 0, [_e.sent()])];
            case 2: return [2 /*return*/, _a.apply(void 0, [(_d.includeObjects = [_b + (_e.sent())],
                        _d.saltoIDSettings = {
                            defaultIdFields: ['Name'],
                        },
                        _d)])];
        }
    });
}); };
var isRetryableErr = function (retryableFailures) {
    return function (instAndRes) {
        return lodash_1["default"].every(instAndRes.result.errors, function (salesforceErr) {
            return lodash_1["default"].some(retryableFailures, function (retryableFailure) {
                return salesforceErr.includes(retryableFailure);
            });
        });
    };
};
var retryFlow = function (crudFn, crudFnArgs, retriesLeft) { return __awaiter(void 0, void 0, void 0, function () {
    var client, _a, retryDelay, retryableFailures, successes, errors, instanceResults, _b, succeeded, failed, _c, recoverable, notRecoverable, _d, successInstances, errorInstances;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                client = crudFnArgs.client;
                _a = client.dataRetry, retryDelay = _a.retryDelay, retryableFailures = _a.retryableFailures;
                successes = [];
                errors = [];
                return [4 /*yield*/, crudFn(crudFnArgs)];
            case 1:
                instanceResults = _e.sent();
                _b = lodash_1["default"].partition(instanceResults, function (instanceResult) {
                    return instanceResult.result.success;
                }), succeeded = _b[0], failed = _b[1];
                _c = lodash_1["default"].partition(failed, isRetryableErr(retryableFailures)), recoverable = _c[0], notRecoverable = _c[1];
                successes = successes.concat(succeeded.map(function (instAndRes) { return instAndRes.instance; }));
                errors = errors.concat(getAndLogErrors(notRecoverable));
                if (lodash_1["default"].isEmpty(recoverable)) {
                    return [2 /*return*/, { successInstances: successes, errorInstances: errors }];
                }
                if (retriesLeft === 0) {
                    return [2 /*return*/, {
                            successInstances: successes,
                            errorInstances: errors.concat(getAndLogErrors(recoverable)),
                        }];
                }
                return [4 /*yield*/, sleep(retryDelay)];
            case 2:
                _e.sent();
                log.debug("in custom object deploy retry-flow. retries left: " + retriesLeft + ",\n                  remaining retryable failures are: " + recoverable);
                return [4 /*yield*/, exports.retryFlow(crudFn, __assign(__assign({}, crudFnArgs), { instances: recoverable.map(function (instAndRes) { return instAndRes.instance; }) }), retriesLeft - 1)];
            case 3:
                _d = _e.sent(), successInstances = _d.successInstances, errorInstances = _d.errorInstances;
                return [2 /*return*/, {
                        successInstances: successes.concat(successInstances),
                        errorInstances: errors.concat(errorInstances),
                    }];
        }
    });
}); };
exports.retryFlow = retryFlow;
var insertInstances = function (_a) {
    var typeName = _a.typeName, instances = _a.instances, client = _a.client;
    return __awaiter(void 0, void 0, void 0, function () {
        var results, _b, _c, _d, instancesAndResults;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (instances.length === 0) {
                        return [2 /*return*/, []];
                    }
                    _c = (_b = client).bulkLoadOperation;
                    _d = [typeName,
                        'insert'];
                    return [4 /*yield*/, transformer_1.instancesToCreateRecords(instances)];
                case 1: return [4 /*yield*/, _c.apply(_b, _d.concat([_e.sent()]))];
                case 2:
                    results = _e.sent();
                    instancesAndResults = groupInstancesAndResultsByIndex(results, instances);
                    // Add IDs to success instances
                    instancesAndResults.filter(function (instAndRes) { return instAndRes.result.success; })
                        .forEach(function (_a) {
                        var instance = _a.instance, result = _a.result;
                        instance.value[constants_1.CUSTOM_OBJECT_ID_FIELD] = result.id;
                    });
                    return [2 /*return*/, instancesAndResults];
            }
        });
    });
};
var updateInstances = function (_a) {
    var typeName = _a.typeName, instances = _a.instances, client = _a.client, groupId = _a.groupId;
    return __awaiter(void 0, void 0, void 0, function () {
        var results, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (instances.length === 0) {
                        return [2 /*return*/, []];
                    }
                    _c = (_b = client).bulkLoadOperation;
                    _d = [typeName,
                        'update'];
                    // For this special group, we know it's safe to update without adding nulls, since the Record
                    // was previously added by us, and no Data could be deleted by the user during this process.
                    return [4 /*yield*/, transformer_1.instancesToUpdateRecords(instances, groupId !== constants_1.ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP)];
                case 1: return [4 /*yield*/, _c.apply(_b, _d.concat([
                        // For this special group, we know it's safe to update without adding nulls, since the Record
                        // was previously added by us, and no Data could be deleted by the user during this process.
                        _e.sent()]))];
                case 2:
                    results = _e.sent();
                    return [2 /*return*/, groupInstancesAndResultsByIndex(results, instances)];
            }
        });
    });
};
var ALREADY_DELETED_ERROR = 'ENTITY_IS_DELETED:entity is deleted:--';
var removeSilencedDeleteErrors = function (result) {
    if (!lodash_1["default"].isEmpty(result.errors)) {
        var _a = lodash_1["default"].partition(result.errors, function (error) { return error === ALREADY_DELETED_ERROR; }), silencedErrors = _a[0], realErrors = _a[1];
        log.debug('Ignoring delete errors: %s%s', os_1.EOL, silencedErrors.join(os_1.EOL));
        return __assign(__assign({}, result), { success: result.success || lodash_1["default"].isEmpty(realErrors), errors: realErrors });
    }
    return result;
};
var deleteInstances = function (_a) {
    var typeName = _a.typeName, instances = _a.instances, client = _a.client;
    return __awaiter(void 0, void 0, void 0, function () {
        var results;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, client.bulkLoadOperation(typeName, 'delete', transformer_1.instancesToDeleteRecords(instances))];
                case 1:
                    results = (_b.sent()).map(removeSilencedDeleteErrors);
                    return [2 /*return*/, groupInstancesAndResultsByIndex(results, instances)];
            }
        });
    });
};
exports.deleteInstances = deleteInstances;
var cloneWithoutNulls = function (val) {
    return (Object.fromEntries(Object.entries(val).filter(function (_a) {
        var _k = _a[0], v = _a[1];
        return (v !== null);
    }).map(function (_a) {
        var k = _a[0], v = _a[1];
        if (lodash_1["default"].isObject(v)) {
            return [k, cloneWithoutNulls(v)];
        }
        return [k, v];
    })));
};
var deployAddInstances = function (instances, idFields, client, groupId) { return __awaiter(void 0, void 0, void 0, function () {
    var instancesReferencingToBeDeployedInstances, instanceByElemId, type, typeName, idFieldsNames, computeSaltoIdHash, computeRecordSaltoIdHash, existingRecordsLookup, _a, _b, existingInstances, newInstances, _c, successInsertInstances, insertErrorInstances, _d, successUpdateInstances, errorUpdateInstances, _e, _f, allSuccessInstances;
    var _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                instancesReferencingToBeDeployedInstances = instances
                    .filter(function (instance) { return (Object.values(instance.value)
                    // Only successfully deployed Instances have Id
                    .some(function (v) { return adapter_api_1.isInstanceElement(v) && v.value[constants_1.CUSTOM_OBJECT_ID_FIELD] === undefined; })); });
                instanceByElemId = lodash_1["default"].keyBy(instances, function (instance) { return instance.elemID.getFullName(); });
                return [4 /*yield*/, awu(instancesReferencingToBeDeployedInstances).forEach(function (instance) {
                        instance.value = lodash_1["default"].mapValues(instance.value, function (val) {
                            var _a;
                            return (adapter_api_1.isInstanceElement(val)
                                ? (_a = instanceByElemId[val.elemID.getFullName()]) !== null && _a !== void 0 ? _a : val : val);
                        });
                    })];
            case 1:
                _h.sent();
                return [4 /*yield*/, instances[0].getType()];
            case 2:
                type = _h.sent();
                return [4 /*yield*/, transformer_1.apiName(type)];
            case 3:
                typeName = _h.sent();
                idFieldsNames = idFields.map(function (field) { return field.name; });
                computeSaltoIdHash = function (vals) {
                    // Building the object this way because order of keys is important
                    var idFieldsValues = Object.fromEntries(idFieldsNames.map(function (fieldName) { return [fieldName, vals[fieldName]]; }));
                    return toMD5(adapter_utils_1.safeJsonStringify(idFieldsValues));
                };
                computeRecordSaltoIdHash = function (record) { return __awaiter(void 0, void 0, void 0, function () {
                    var recordValues, recordValuesWithoutNulls;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, custom_objects_instances_1.transformRecordToValues(type, record)
                                // Remove null values from the record result to compare it to instance values
                            ];
                            case 1:
                                recordValues = _a.sent();
                                recordValuesWithoutNulls = cloneWithoutNulls(recordValues);
                                return [2 /*return*/, computeSaltoIdHash(recordValuesWithoutNulls)];
                        }
                    });
                }); };
                _a = keyByAsync;
                return [4 /*yield*/, getRecordsBySaltoIds(type, instances, idFields, client)];
            case 4: return [4 /*yield*/, _a.apply(void 0, [_h.sent(), computeRecordSaltoIdHash])];
            case 5:
                existingRecordsLookup = _h.sent();
                _b = lodash_1["default"].partition(instances, function (instance) {
                    return existingRecordsLookup[computeSaltoIdHash(instance.value)] !== undefined;
                }), existingInstances = _b[0], newInstances = _b[1];
                return [4 /*yield*/, exports.retryFlow(insertInstances, { typeName: typeName, instances: newInstances, client: client, groupId: groupId }, client.dataRetry.maxAttempts)];
            case 6:
                _c = _h.sent(), successInsertInstances = _c.successInstances, insertErrorInstances = _c.errorInstances;
                existingInstances.forEach(function (instance) {
                    var existingRecordLookup = existingRecordsLookup[computeSaltoIdHash(instance.value)];
                    MANDATORY_FIELDS_FOR_UPDATE.forEach(function (mandatoryField) {
                        if (instance.value[mandatoryField] === undefined && existingRecordLookup[mandatoryField] !== undefined) {
                            instance.value[mandatoryField] = existingRecordLookup[mandatoryField];
                        }
                    });
                });
                _e = exports.retryFlow;
                _f = [updateInstances];
                _g = {};
                return [4 /*yield*/, transformer_1.apiName(type)];
            case 7: return [4 /*yield*/, _e.apply(void 0, _f.concat([(_g.typeName = _h.sent(),
                        _g.instances = existingInstances.concat(instancesReferencingToBeDeployedInstances),
                        _g.client = client,
                        _g.groupId = groupId,
                        _g), client.dataRetry.maxAttempts]))];
            case 8:
                _d = _h.sent(), successUpdateInstances = _d.successInstances, errorUpdateInstances = _d.errorInstances;
                allSuccessInstances = __spreadArrays(successInsertInstances, successUpdateInstances);
                return [2 /*return*/, {
                        appliedChanges: allSuccessInstances.map(function (instance) { return ({ action: 'add', data: { after: instance } }); }),
                        errors: __spreadArrays(insertErrorInstances, errorUpdateInstances),
                        extraProperties: {
                            groups: [{ id: groupId }],
                        },
                    }];
        }
    });
}); };
var deployRemoveInstances = function (instances, client, groupId) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, successInstances, errorInstances, _b, _c, _d;
    var _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _b = exports.retryFlow;
                _c = [exports.deleteInstances];
                _e = {};
                _d = transformer_1.apiName;
                return [4 /*yield*/, instances[0].getType()];
            case 1: return [4 /*yield*/, _d.apply(void 0, [_f.sent()])];
            case 2: return [4 /*yield*/, _b.apply(void 0, _c.concat([(_e.typeName = _f.sent(), _e.instances = instances, _e.client = client, _e.groupId = groupId, _e), client.dataRetry.maxAttempts]))];
            case 3:
                _a = _f.sent(), successInstances = _a.successInstances, errorInstances = _a.errorInstances;
                return [2 /*return*/, {
                        appliedChanges: successInstances.map(function (instance) { return ({ action: 'remove', data: { before: instance } }); }),
                        errors: errorInstances,
                        extraProperties: {
                            groups: [{ id: groupId }],
                        },
                    }];
        }
    });
}); };
var deployModifyChanges = function (changes, client, groupId) { return __awaiter(void 0, void 0, void 0, function () {
    var changesData, instancesType, _a, _b, validData, diffApiNameData, afters, _c, successInstances, errorInstances, successData, diffApiNameErrors, errors;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                changesData = changes
                    .map(function (change) { return change.data; });
                _a = transformer_1.apiName;
                return [4 /*yield*/, changesData[0].after.getType()];
            case 1: return [4 /*yield*/, _a.apply(void 0, [_d.sent()])];
            case 2:
                instancesType = _d.sent();
                return [4 /*yield*/, partition(changesData, function (changeData) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, transformer_1.apiName(changeData.before)];
                            case 1:
                                _a = (_b.sent());
                                return [4 /*yield*/, transformer_1.apiName(changeData.after)];
                            case 2: return [2 /*return*/, _a === (_b.sent())];
                        }
                    }); }); })];
            case 3:
                _b = _d.sent(), validData = _b[0], diffApiNameData = _b[1];
                afters = validData.map(function (data) { return data.after; });
                return [4 /*yield*/, exports.retryFlow(updateInstances, { typeName: instancesType, instances: afters, client: client, groupId: groupId }, client.dataRetry.maxAttempts)];
            case 4:
                _c = _d.sent(), successInstances = _c.successInstances, errorInstances = _c.errorInstances;
                successData = validData
                    .filter(function (changeData) {
                    return successInstances.find(function (instance) { return instance.isEqual(changeData.after); });
                });
                return [4 /*yield*/, awu(diffApiNameData).map(function (data) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b;
                        var _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _c = {
                                        elemID: data.before.elemID
                                    };
                                    _a = "Failed to update as api name prev=";
                                    return [4 /*yield*/, transformer_1.apiName(data.before)];
                                case 1:
                                    _b = _a + (_d.sent()) + " and new=";
                                    return [4 /*yield*/, transformer_1.apiName(data.after)];
                                case 2: return [2 /*return*/, (_c.message = _b + (_d.sent()) + " are different",
                                        _c.severity = 'Error',
                                        _c)];
                            }
                        });
                    }); }).toArray()];
            case 5:
                diffApiNameErrors = _d.sent();
                errors = __spreadArrays(errorInstances, diffApiNameErrors);
                return [2 /*return*/, {
                        appliedChanges: successData.map(function (data) { return ({ action: 'modify', data: data }); }),
                        errors: errors,
                        extraProperties: {
                            groups: [{ id: groupId }],
                        },
                    }];
        }
    });
}); };
var isInstanceOfCustomObjectChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (transformer_1.isInstanceOfCustomObject(adapter_api_1.getChangeData(change)))];
    });
}); };
exports.isInstanceOfCustomObjectChange = isInstanceOfCustomObjectChange;
var isCustomObjectInstanceChanges = function (changes) {
    return awu(changes).every(exports.isInstanceOfCustomObjectChange);
};
exports.isCustomObjectInstanceChanges = isCustomObjectInstanceChanges;
var isModificationChangeList = function (changes) { return (changes.every(adapter_api_1.isModificationChange)); };
var customObjectInstancesDeployError = function (message) { return ({
    appliedChanges: [],
    errors: [{ message: message, severity: 'Error' }],
}); };
var deploySingleTypeAndActionCustomObjectInstancesGroup = function (changes, client, groupId, dataManagement) { return __awaiter(void 0, void 0, void 0, function () {
    var instances, instanceTypes, _a, actualDataManagement, _b, _c, _d, idFields, invalidIdFields, _e, error_1;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 14, , 15]);
                instances = changes.map(function (change) { return adapter_api_1.getChangeData(change); });
                _a = Set.bind;
                return [4 /*yield*/, awu(instances)
                        .map(function (inst) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = transformer_1.apiName;
                                return [4 /*yield*/, inst.getType()];
                            case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                        }
                    }); }); }).toArray()];
            case 1:
                instanceTypes = __spreadArrays.apply(void 0, [new (_a.apply(Set, [void 0, _f.sent()]))()]);
                if (instanceTypes.length > 1) {
                    return [2 /*return*/, customObjectInstancesDeployError("Custom Object Instances change group should have a single type but got: " + instanceTypes)];
                }
                _c = custom_settings_filter_1.isListCustomSettingsObject;
                return [4 /*yield*/, instances[0].getType()];
            case 2:
                if (!_c.apply(void 0, [_f.sent()])) return [3 /*break*/, 4];
                return [4 /*yield*/, getDataManagementFromCustomSettings(instances)];
            case 3:
                _b = _f.sent();
                return [3 /*break*/, 5];
            case 4:
                _b = dataManagement;
                _f.label = 5;
            case 5:
                actualDataManagement = _b;
                if (actualDataManagement === undefined) {
                    return [2 /*return*/, customObjectInstancesDeployError('dataManagement must be defined in the salesforce.nacl config to deploy Custom Object instances')];
                }
                if (!changes.every(adapter_api_1.isAdditionChange)) return [3 /*break*/, 9];
                _e = custom_objects_instances_1.getIdFields;
                return [4 /*yield*/, instances[0].getType()];
            case 6: return [4 /*yield*/, _e.apply(void 0, [_f.sent(), actualDataManagement])];
            case 7:
                _d = _f.sent(), idFields = _d.idFields, invalidIdFields = _d.invalidIdFields;
                if (invalidIdFields !== undefined && invalidIdFields.length > 0) {
                    return [2 /*return*/, customObjectInstancesDeployError("Failed to add instances of type " + instanceTypes[0] + " due to invalid SaltoIdFields - " + invalidIdFields)];
                }
                return [4 /*yield*/, deployAddInstances(instances, idFields, client, groupId)];
            case 8: return [2 /*return*/, _f.sent()];
            case 9:
                if (!changes.every(adapter_api_1.isRemovalChange)) return [3 /*break*/, 11];
                return [4 /*yield*/, deployRemoveInstances(instances, client, groupId)];
            case 10: return [2 /*return*/, _f.sent()];
            case 11:
                if (!isModificationChangeList(changes)) return [3 /*break*/, 13];
                return [4 /*yield*/, deployModifyChanges(changes, client, groupId)];
            case 12: return [2 /*return*/, _f.sent()];
            case 13: return [2 /*return*/, customObjectInstancesDeployError('Custom Object Instances change group must have one action')];
            case 14:
                error_1 = _f.sent();
                log.error('Unknown error occurred for Data Deploy group %s: %o', groupId, error_1);
                return [2 /*return*/, customObjectInstancesDeployError('Unknown error occurred')];
            case 15: return [2 /*return*/];
        }
    });
}); };
var createNonDeployableConditionChangeError = function (change) { return ({
    message: "Cannot deploy ApprovalCondition instance " + adapter_api_1.getChangeData(change).elemID.getFullName() + " since it depends on an ApprovalRule instance that was not deployed successfully",
    severity: 'Error',
    elemID: adapter_api_1.getChangeData(change).elemID,
}); };
var deployAddCustomApprovalRulesAndConditions = function (changes, client, dataManagement) { return __awaiter(void 0, void 0, void 0, function () {
    var approvalRuleChanges, approvalConditionChanges, approvalRuleByElemID, approvalRulesWithAllConditionsMetDeployResult, _a, deployableConditionChanges, nonDeployableConditionChanges, conditionsDeployResult, firstDeployAppliedChanges, approvalRulesWithCustomDeployResult;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, awu(changes)
                    .filter(utils_1.isInstanceOfTypeChange(constants_1.SBAA_APPROVAL_RULE))
                    .toArray()];
            case 1:
                approvalRuleChanges = _b.sent();
                return [4 /*yield*/, awu(changes)
                        .filter(utils_1.isInstanceOfTypeChange(constants_1.SBAA_APPROVAL_CONDITION))
                        .toArray()];
            case 2:
                approvalConditionChanges = _b.sent();
                if (approvalRuleChanges.map(adapter_api_1.getChangeData).some(function (instance) { return instance.value[constants_1.SBAA_CONDITIONS_MET] !== 'Custom'; })) {
                    throw new Error('Received ApprovalRule instance without Custom ConditionsMet');
                }
                approvalRuleByElemID = lodash_1["default"].keyBy(approvalRuleChanges.map(adapter_api_1.getChangeData), function (instance) { return instance.elemID.getFullName(); });
                return [4 /*yield*/, awu(approvalConditionChanges.map(adapter_api_1.getChangeData)).forEach(function (instance) {
                        instance.value = lodash_1["default"].mapValues(instance.value, function (val) {
                            var _a;
                            return (adapter_api_1.isInstanceElement(val)
                                ? (_a = approvalRuleByElemID[val.elemID.getFullName()]) !== null && _a !== void 0 ? _a : val : val);
                        });
                    })];
            case 3:
                _b.sent();
                log.debug('Deploying ApprovalRule instances with "All" ConditionsMet instead of "Custom"');
                approvalRuleChanges
                    .map(adapter_api_1.getChangeData)
                    .forEach(function (instance) {
                    instance.value[constants_1.SBAA_CONDITIONS_MET] = 'All';
                });
                return [4 /*yield*/, deploySingleTypeAndActionCustomObjectInstancesGroup(approvalRuleChanges, client, constants_1.ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP, dataManagement)];
            case 4:
                approvalRulesWithAllConditionsMetDeployResult = _b.sent();
                log.debug('Deploying ApprovalCondition instances');
                _a = lodash_1["default"].partition(approvalConditionChanges, function (change) {
                    var instance = adapter_api_1.getChangeData(change);
                    var approvalRule = instance.value[constants_1.SBAA_APPROVAL_RULE];
                    if (!adapter_api_1.isInstanceElement(approvalRule)) {
                        log.error('Expected ApprovalCondition with name %s to contain InstanceElement for the sbaa__ApprovalRule__c field', instance.elemID.getFullName());
                        return false;
                    }
                    // Only successfully deployed Instances have Id
                    if (approvalRule.value[constants_1.CUSTOM_OBJECT_ID_FIELD] === undefined) {
                        log.error('The ApprovalCondition with name %s is not referencing a successfully deployed ApprovalRule instance with name %s', instance.elemID.getFullName(), approvalRule.elemID.getFullName());
                        return false;
                    }
                    return true;
                }), deployableConditionChanges = _a[0], nonDeployableConditionChanges = _a[1];
                return [4 /*yield*/, deploySingleTypeAndActionCustomObjectInstancesGroup(deployableConditionChanges, client, constants_1.ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP, dataManagement)];
            case 5:
                conditionsDeployResult = _b.sent();
                log.debug('Updating the ApprovalRule instances with Custom ConditionsMet');
                firstDeployAppliedChanges = approvalRulesWithAllConditionsMetDeployResult.appliedChanges
                    .filter(adapter_api_1.isInstanceChange);
                firstDeployAppliedChanges
                    .map(adapter_api_1.getChangeData)
                    .forEach(function (instance) {
                    instance.value[constants_1.SBAA_CONDITIONS_MET] = 'Custom';
                });
                return [4 /*yield*/, deploySingleTypeAndActionCustomObjectInstancesGroup(
                    // Transforming to modification changes to trigger "update" instead of "insert"
                    firstDeployAppliedChanges.map(function (change) { return adapter_api_1.toChange({ before: adapter_api_1.getChangeData(change), after: adapter_api_1.getChangeData(change) }); }), client, constants_1.ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP, dataManagement)];
            case 6:
                approvalRulesWithCustomDeployResult = _b.sent();
                return [2 /*return*/, {
                        appliedChanges: approvalRulesWithCustomDeployResult.appliedChanges
                            // Transforming back to addition changes
                            .map(function (change) { return adapter_api_1.toChange({ after: adapter_api_1.getChangeData(change) }); })
                            .concat(conditionsDeployResult.appliedChanges),
                        errors: approvalRulesWithAllConditionsMetDeployResult.errors.concat(conditionsDeployResult.errors, approvalRulesWithCustomDeployResult.errors, nonDeployableConditionChanges.map(createNonDeployableConditionChangeError)),
                    }];
        }
    });
}); };
var deployCustomObjectInstancesGroup = function (changes, client, groupId, dataManagement) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (groupId === constants_1.ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP
                ? deployAddCustomApprovalRulesAndConditions(changes, client, dataManagement)
                : deploySingleTypeAndActionCustomObjectInstancesGroup(changes, client, groupId, dataManagement))];
    });
}); };
exports.deployCustomObjectInstancesGroup = deployCustomObjectInstancesGroup;
