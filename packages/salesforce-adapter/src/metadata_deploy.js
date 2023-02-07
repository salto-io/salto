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
exports.quickDeploy = exports.deployMetadata = exports.DEPLOY_WRAPPER_INSTANCE_MARKER = void 0;
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
var xml_transformer_1 = require("./transformers/xml_transformer");
var transformer_1 = require("./transformers/transformer");
var utils_1 = require("./filters/utils");
var constants_1 = require("./constants");
var user_facing_errors_1 = require("./client/user_facing_errors");
var awu = lowerdash_1.collections.asynciterable.awu;
var isDefined = lowerdash_1.values.isDefined;
var makeArray = lowerdash_1.collections.array.makeArray;
var log = logging_1.logger(module);
// Put this marker in the value of an instance if it is just a wrapper for child instances
// and is not meant to actually be deployed
exports.DEPLOY_WRAPPER_INSTANCE_MARKER = '_magic_constant_that_means_this_is_a_wrapper_instance';
var addNestedInstancesToPackageManifest = function (pkg, nestedTypeInfo, change, addNestedAfterInstances) { return __awaiter(void 0, void 0, void 0, function () {
    var changeElem, getNestedInstanceApiName, addNestedInstancesFromField, _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                changeElem = adapter_api_1.getChangeData(change);
                getNestedInstanceApiName = function (name) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                if (!nestedTypeInfo.isNestedApiNameRelative) return [3 /*break*/, 2];
                                _b = utils_1.fullApiName;
                                return [4 /*yield*/, transformer_1.apiName(changeElem)];
                            case 1:
                                _a = _b.apply(void 0, [_c.sent(), name]);
                                return [3 /*break*/, 3];
                            case 2:
                                _a = name;
                                _c.label = 3;
                            case 3: return [2 /*return*/, (_a)];
                        }
                    });
                }); };
                addNestedInstancesFromField = function (fieldName) { return __awaiter(void 0, void 0, void 0, function () {
                    var rawFieldType, fieldType, _a, nestedAfter, nestedBefore, removedNestedInstances, idsToDelete, idsToAdd, _b;
                    var _c;
                    var _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0: return [4 /*yield*/, changeElem.getType()];
                            case 1: return [4 /*yield*/, ((_d = (_e.sent()).fields[fieldName]) === null || _d === void 0 ? void 0 : _d.getType())];
                            case 2:
                                rawFieldType = _e.sent();
                                if (!adapter_api_1.isContainerType(rawFieldType)) return [3 /*break*/, 4];
                                return [4 /*yield*/, rawFieldType.getInnerType()];
                            case 3:
                                _a = _e.sent();
                                return [3 /*break*/, 5];
                            case 4:
                                _a = rawFieldType;
                                _e.label = 5;
                            case 5:
                                fieldType = _a;
                                if (!transformer_1.isMetadataObjectType(fieldType)) {
                                    log.error('cannot deploy nested instances in %s field %s because the field type %s is not a metadata type', changeElem.elemID.getFullName(), fieldName, fieldType === null || fieldType === void 0 ? void 0 : fieldType.elemID.getFullName());
                                    return [2 /*return*/, {}];
                                }
                                nestedAfter = new Set(adapter_api_1.isRemovalChange(change)
                                    ? []
                                    : makeArray(change.data.after.value[fieldName])
                                        .map(function (item) { return item[constants_1.INSTANCE_FULL_NAME_FIELD]; }));
                                nestedBefore = adapter_api_1.isAdditionChange(change)
                                    ? []
                                    : makeArray(change.data.before.value[fieldName])
                                        .map(function (item) { return item[constants_1.INSTANCE_FULL_NAME_FIELD]; });
                                removedNestedInstances = nestedBefore.filter(function (instName) { return !nestedAfter.has(instName); });
                                return [4 /*yield*/, Promise.all(removedNestedInstances
                                        .map(getNestedInstanceApiName))];
                            case 6:
                                idsToDelete = _e.sent();
                                idsToDelete.forEach(function (nestedInstName) {
                                    pkg["delete"](fieldType, nestedInstName);
                                });
                                if (!addNestedAfterInstances) return [3 /*break*/, 8];
                                return [4 /*yield*/, Promise.all(__spreadArrays(nestedAfter).map(getNestedInstanceApiName))];
                            case 7:
                                _b = _e.sent();
                                return [3 /*break*/, 9];
                            case 8:
                                _b = [];
                                _e.label = 9;
                            case 9:
                                idsToAdd = _b;
                                idsToAdd.forEach(function (nestedInstName) {
                                    pkg.addToManifest(fieldType, nestedInstName);
                                });
                                _c = {};
                                return [4 /*yield*/, transformer_1.metadataType(fieldType)];
                            case 10: return [2 /*return*/, (_c[_e.sent()] = new Set(__spreadArrays(idsToDelete, idsToAdd)), _c)];
                        }
                    });
                }); };
                _b = (_a = Object.assign).apply;
                _c = [Object];
                _d = [[{}]];
                return [4 /*yield*/, Promise.all(nestedTypeInfo.nestedInstanceFields.map(addNestedInstancesFromField))];
            case 1: return [2 /*return*/, _b.apply(_a, _c.concat([__spreadArrays.apply(void 0, _d.concat([_e.sent()]))]))];
        }
    });
}); };
var addChangeToPackage = function (pkg, change, nestedMetadataTypes) { return __awaiter(void 0, void 0, void 0, function () {
    var instance, isWrapperInstance, addInstanceToManifest, addedIds, _a, _b, _c, _d, _e, _f, _g, nestedTypeInfo, _h, addChildInstancesToManifest, nestedInstanceIds;
    var _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                instance = adapter_api_1.getChangeData(change);
                isWrapperInstance = lodash_1["default"].get(instance.value, exports.DEPLOY_WRAPPER_INSTANCE_MARKER) === true;
                addInstanceToManifest = !isWrapperInstance;
                if (!addInstanceToManifest) return [3 /*break*/, 3];
                _j = {};
                return [4 /*yield*/, transformer_1.metadataType(instance)];
            case 1:
                _b = _k.sent();
                _c = Set.bind;
                return [4 /*yield*/, transformer_1.apiName(instance)];
            case 2:
                _a = (_j[_b] = new (_c.apply(Set, [void 0, [_k.sent()]]))(), _j);
                return [3 /*break*/, 4];
            case 3:
                _a = {};
                _k.label = 4;
            case 4:
                addedIds = _a;
                if (!adapter_api_1.isRemovalChange(change)) return [3 /*break*/, 7];
                _e = (_d = pkg)["delete"];
                _f = transformer_1.assertMetadataObjectType;
                return [4 /*yield*/, instance.getType()];
            case 5:
                _g = [_f.apply(void 0, [_k.sent()])];
                return [4 /*yield*/, transformer_1.apiName(instance)];
            case 6:
                _e.apply(_d, _g.concat([_k.sent()]));
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, pkg.add(instance, addInstanceToManifest)];
            case 8:
                _k.sent();
                _k.label = 9;
            case 9:
                _h = nestedMetadataTypes;
                return [4 /*yield*/, transformer_1.metadataType(instance)];
            case 10:
                nestedTypeInfo = _h[_k.sent()];
                if (!(nestedTypeInfo !== undefined)) return [3 /*break*/, 12];
                addChildInstancesToManifest = isWrapperInstance;
                return [4 /*yield*/, addNestedInstancesToPackageManifest(pkg, nestedTypeInfo, change, addChildInstancesToManifest)];
            case 11:
                nestedInstanceIds = _k.sent();
                Object.assign(addedIds, nestedInstanceIds);
                _k.label = 12;
            case 12: return [2 /*return*/, addedIds];
        }
    });
}); };
var getUnFoundDeleteName = function (message, deletionsPackageName) {
    var _a;
    var match = (message.fullName === deletionsPackageName && message.problemType === 'Warning')
        ? message.problem.match(/No.*named: (?<fullName>.*) found/)
        : undefined;
    var fullName = (_a = match === null || match === void 0 ? void 0 : match.groups) === null || _a === void 0 ? void 0 : _a.fullName;
    return fullName === undefined ? undefined : { type: message.componentType, fullName: fullName };
};
var isUnFoundDelete = function (message, deletionsPackageName) { return (getUnFoundDeleteName(message, deletionsPackageName) !== undefined); };
var processDeployResponse = function (result, deletionsPackageName, checkOnly) {
    var allFailureMessages = makeArray(result.details)
        .flatMap(function (detail) { return makeArray(detail.componentFailures); });
    var testFailures = makeArray(result.details)
        .flatMap(function (detail) { var _a; return makeArray((_a = detail.runTestResult) === null || _a === void 0 ? void 0 : _a.failures); });
    var testErrors = testFailures
        .map(function (failure) { return new Error("Test failed for class " + failure.name + " method " + failure.methodName + " with error:\n" + failure.message + "\n" + failure.stackTrace); });
    var componentErrors = allFailureMessages
        .filter(function (failure) { return !isUnFoundDelete(failure, deletionsPackageName); })
        .map(user_facing_errors_1.getUserFriendlyDeployMessage)
        .map(function (failure) { return new Error("Failed to " + (checkOnly ? 'validate' : 'deploy') + " " + failure.fullName + " with error: " + failure.problem + " (" + failure.problemType + ")"); });
    var codeCoverageWarningErrors = makeArray(result.details)
        .map(function (detail) { return detail.runTestResult; })
        .flatMap(function (runTestResult) { return makeArray(runTestResult === null || runTestResult === void 0 ? void 0 : runTestResult.codeCoverageWarnings); })
        .map(function (codeCoverageWarning) { return codeCoverageWarning.message; })
        .map(function (message) { return new Error(message); });
    var errors = __spreadArrays(testErrors, componentErrors, codeCoverageWarningErrors);
    if (isDefined(result.errorMessage)) {
        errors.push(Error(result.errorMessage));
    }
    // In checkOnly none of the changes are actually applied
    if (!result.checkOnly && result.rollbackOnError && !result.success) {
        // if rollbackOnError and we did not succeed, nothing was applied as well
        return { successfulFullNames: [], errors: errors };
    }
    var allSuccessMessages = makeArray(result.details)
        .flatMap(function (detail) { return makeArray(detail.componentSuccesses); });
    // We want to treat deletes for things we haven't found as success
    // Note that if we deploy with ignoreWarnings, these might show up in the success list
    // so we have to look for these messages in both lists
    var unFoundDeleteNames = __spreadArrays(allSuccessMessages, allFailureMessages).map(function (message) { return getUnFoundDeleteName(message, deletionsPackageName); })
        .filter(isDefined);
    var successfulFullNames = allSuccessMessages
        .map(function (success) { return ({ type: success.componentType, fullName: success.fullName }); })
        .concat(unFoundDeleteNames);
    return { successfulFullNames: successfulFullNames, errors: errors };
};
var getChangeError = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var changeElem, beforeName, afterName, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                changeElem = adapter_api_1.getChangeData(change);
                return [4 /*yield*/, transformer_1.apiName(changeElem)];
            case 1:
                if ((_b.sent()) === undefined) {
                    return [2 /*return*/, "Cannot " + change.action + " element because it has no api name"];
                }
                if (!adapter_api_1.isModificationChange(change)) return [3 /*break*/, 4];
                return [4 /*yield*/, transformer_1.apiName(change.data.before)];
            case 2:
                beforeName = _b.sent();
                return [4 /*yield*/, transformer_1.apiName(change.data.after)];
            case 3:
                afterName = _b.sent();
                if (beforeName !== afterName) {
                    return [2 /*return*/, "Failed to update element because api names prev=" + beforeName + " and new=" + afterName + " are different"];
                }
                _b.label = 4;
            case 4:
                _a = !adapter_api_1.isInstanceChange(change);
                if (_a) return [3 /*break*/, 6];
                return [4 /*yield*/, transformer_1.isMetadataInstanceElement(changeElem)];
            case 5:
                _a = !(_b.sent());
                _b.label = 6;
            case 6:
                if (_a) {
                    return [2 /*return*/, 'Cannot deploy because it is not a metadata instance'];
                }
                return [2 /*return*/, undefined];
        }
    });
}); };
var validateChanges = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var changesAndValidation, _a, invalidChanges, validChanges, errors;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, awu(changes)
                    .map(function (change) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = { change: change };
                                return [4 /*yield*/, getChangeError(change)];
                            case 1: return [2 /*return*/, (_a.error = _b.sent(), _a)];
                        }
                    });
                }); })
                    .toArray()];
            case 1:
                changesAndValidation = _b.sent();
                _a = lodash_1["default"].partition(changesAndValidation, function (_a) {
                    var error = _a.error;
                    return isDefined(error);
                }), invalidChanges = _a[0], validChanges = _a[1];
                errors = invalidChanges
                    .map(function (_a) {
                    var change = _a.change, error = _a.error;
                    return (new Error(adapter_api_1.getChangeData(change).elemID.getFullName() + ": " + error + "}"));
                });
                return [2 /*return*/, {
                        // We can cast to MetadataInstanceElement here because we will have an error for changes that
                        // are not metadata instance changes
                        validChanges: validChanges.map(function (_a) {
                            var change = _a.change;
                            return change;
                        }),
                        errors: errors,
                    }];
        }
    });
}); };
var getDeployStatusUrl = function (_a, client) {
    var id = _a.id;
    return __awaiter(void 0, void 0, void 0, function () {
        var baseUrl;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, client.getUrl()];
                case 1:
                    baseUrl = _b.sent();
                    if (baseUrl === undefined) {
                        log.warn('Could not resolve Salesforce deployment URL');
                        return [2 /*return*/, undefined];
                    }
                    return [2 /*return*/, baseUrl + "lightning/setup/DeployStatus/page?address=%2Fchangemgmt%2FmonitorDeploymentsDetails.apexp%3FasyncId%3D" + id];
            }
        });
    });
};
var isQuickDeployable = function (deployRes) {
    return deployRes.id !== undefined && deployRes.checkOnly && deployRes.success && deployRes.numberTestsCompleted >= 1;
};
var deployMetadata = function (changes, client, groupId, nestedMetadataTypes, deleteBeforeUpdate, checkOnly) { return __awaiter(void 0, void 0, void 0, function () {
    var pkg, _a, validChanges, validationErrors, changeToDeployedIds, pkgData, sfDeployRes, _b, errors, successfulFullNames, isSuccessfulChange, deploymentUrl;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                pkg = xml_transformer_1.createDeployPackage(deleteBeforeUpdate);
                return [4 /*yield*/, validateChanges(changes)];
            case 1:
                _a = _d.sent(), validChanges = _a.validChanges, validationErrors = _a.errors;
                if (validChanges.length === 0) {
                    // Skip deploy if there are no valid changes
                    return [2 /*return*/, { appliedChanges: [], errors: validationErrors }];
                }
                changeToDeployedIds = {};
                return [4 /*yield*/, awu(validChanges).forEach(function (change) { return __awaiter(void 0, void 0, void 0, function () {
                        var deployedIds;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, addChangeToPackage(pkg, change, nestedMetadataTypes)];
                                case 1:
                                    deployedIds = _a.sent();
                                    changeToDeployedIds[adapter_api_1.getChangeData(change).elemID.getFullName()] = deployedIds;
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 2:
                _d.sent();
                return [4 /*yield*/, pkg.getZip()];
            case 3:
                pkgData = _d.sent();
                return [4 /*yield*/, client.deploy(pkgData, { checkOnly: checkOnly })];
            case 4:
                sfDeployRes = _d.sent();
                log.debug('deploy result: %s', adapter_utils_1.safeJsonStringify(__assign(__assign({}, sfDeployRes), { details: (_c = sfDeployRes.details) === null || _c === void 0 ? void 0 : _c.map(function (detail) { return (__assign(__assign({}, detail), { 
                        // The test result can be VERY long
                        runTestResult: detail.runTestResult
                            ? adapter_utils_1.safeJsonStringify(detail.runTestResult, undefined, 2).slice(100)
                            : undefined })); }) }), undefined, 2));
                _b = processDeployResponse(sfDeployRes, pkg.getDeletionsPackageName(), checkOnly !== null && checkOnly !== void 0 ? checkOnly : false), errors = _b.errors, successfulFullNames = _b.successfulFullNames;
                isSuccessfulChange = function (change) {
                    var changeElem = adapter_api_1.getChangeData(change);
                    var changeDeployedIds = changeToDeployedIds[changeElem.elemID.getFullName()];
                    // TODO - this logic is not perfect, it might produce false positives when there are
                    // child xml instances (because we pass in everything with a single change)
                    return successfulFullNames.some(function (successfulId) { var _a; return (_a = changeDeployedIds[successfulId.type]) === null || _a === void 0 ? void 0 : _a.has(successfulId.fullName); });
                };
                return [4 /*yield*/, getDeployStatusUrl(sfDeployRes, client)];
            case 5:
                deploymentUrl = _d.sent();
                return [2 /*return*/, {
                        appliedChanges: validChanges.filter(isSuccessfulChange),
                        errors: __spreadArrays(validationErrors, errors),
                        extraProperties: {
                            deploymentUrls: deploymentUrl ? [deploymentUrl] : undefined,
                            groups: isQuickDeployable(sfDeployRes)
                                ? [{ id: groupId, requestId: sfDeployRes.id, hash: log.time(function () { return adapter_utils_1.calculateChangesHash(validChanges); }, 'changes hash calculation'), url: deploymentUrl }]
                                : [{ id: groupId, url: deploymentUrl }],
                        },
                    }];
        }
    });
}); };
exports.deployMetadata = deployMetadata;
var quickDeploy = function (changes, client, groupId, quickDeployParams) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, validChanges, validationErrors, deployRes, deploymentUrl;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, validateChanges(changes)];
            case 1:
                _a = _b.sent(), validChanges = _a.validChanges, validationErrors = _a.errors;
                if (validChanges.length === 0) {
                    // Skip deploy if there are no valid changes
                    return [2 /*return*/, { appliedChanges: [], errors: validationErrors }];
                }
                if (quickDeployParams.hash !== adapter_utils_1.calculateChangesHash(validChanges)) {
                    return [2 /*return*/, {
                            appliedChanges: [],
                            errors: [new Error('Quick deploy option is not available because the current deploy plan is different than the validated one')],
                        }];
                }
                return [4 /*yield*/, client.quickDeploy(quickDeployParams.requestId)];
            case 2:
                deployRes = _b.sent();
                log.debug('deploy result: %s', adapter_utils_1.safeJsonStringify(deployRes, undefined, 2));
                // we are not expecting any deploy error after a successful validation
                if (!lodash_1["default"].isEmpty(makeArray(deployRes.details)
                    .flatMap(function (detail) { return makeArray(detail.componentFailures); }))) {
                    log.error('There were unexpected component failures in the quick deploy, id: %s', quickDeployParams.requestId);
                }
                return [4 /*yield*/, getDeployStatusUrl(deployRes, client)];
            case 3:
                deploymentUrl = _b.sent();
                return [2 /*return*/, {
                        appliedChanges: validChanges,
                        errors: validationErrors,
                        extraProperties: {
                            deploymentUrls: deploymentUrl ? [deploymentUrl] : undefined,
                            groups: [{ id: groupId, url: deploymentUrl }],
                        },
                    }];
        }
    });
}); };
exports.quickDeploy = quickDeploy;
