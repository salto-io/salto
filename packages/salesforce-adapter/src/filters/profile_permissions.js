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
var adapter_api_1 = require("@salto-io/adapter-api");
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var removeAsync = lowerdash_1.promises.array.removeAsync;
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
// We can't set permissions for master detail / required fields / system fields
var shouldSetDefaultPermissions = function (field) { return (transformer_1.isCustom(field.annotations[constants_1.API_NAME])
    && field.annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] !== true
    && !utils_1.isMasterDetailField(field)); };
var getFieldPermissions = function (field) { return ({
    field: field,
    editable: true,
    readable: true,
}); };
var getObjectPermissions = function (object) { return ({
    object: object,
    allowCreate: true,
    allowDelete: true,
    allowEdit: true,
    allowRead: true,
    modifyAllRecords: true,
    viewAllRecords: true,
}); };
var createAdminProfile = function () { return transformer_1.createInstanceElement({
    fullName: constants_1.ADMIN_PROFILE,
    fieldPermissions: [],
    objectPermissions: [],
}, new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.PROFILE_METADATA_TYPE),
    annotationRefsOrTypes: lodash_1["default"].clone(transformer_1.metadataAnnotationTypes),
    annotations: {
        metadataType: constants_1.PROFILE_METADATA_TYPE,
        dirName: 'profiles',
        suffix: 'profile',
    },
})); };
var addMissingPermissions = function (profile, elemType, newElements) { return __awaiter(void 0, void 0, void 0, function () {
    var profileValues, existingIds, missingIds;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (newElements.length === 0) {
                    return [2 /*return*/];
                }
                profileValues = profile.value;
                existingIds = new Set(elemType === 'object'
                    ? profileValues.objectPermissions.map(function (permission) { return permission.object; })
                    : profileValues.fieldPermissions.map(function (permission) { return permission.field; }));
                return [4 /*yield*/, awu(newElements)
                        .map(function (elem) { return transformer_1.apiName(elem); })
                        .filter(function (id) { return !existingIds.has(id); })
                        .toArray()];
            case 1:
                missingIds = _c.sent();
                if (missingIds.length === 0) {
                    return [2 /*return*/];
                }
                log.info('adding admin read / write permissions to new %ss: %s', elemType, missingIds.join(', '));
                if (elemType === 'object') {
                    (_a = profileValues.objectPermissions).push.apply(_a, missingIds.map(getObjectPermissions));
                }
                else {
                    (_b = profileValues.fieldPermissions).push.apply(_b, missingIds.map(getFieldPermissions));
                }
                return [2 /*return*/];
        }
    });
}); };
var isAdminProfileChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var changeElem, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                changeElem = adapter_api_1.getChangeData(change);
                return [4 /*yield*/, utils_1.isInstanceOfType(constants_1.PROFILE_METADATA_TYPE)(changeElem)];
            case 1:
                _a = (_b.sent());
                if (!_a) return [3 /*break*/, 3];
                return [4 /*yield*/, transformer_1.apiName(changeElem)];
            case 2:
                _a = (_b.sent()) === constants_1.ADMIN_PROFILE;
                _b.label = 3;
            case 3: return [2 /*return*/, _a];
        }
    });
}); };
/**
 * Profile permissions filter.
 * creates default Admin Profile.fieldsPermissions and Profile.objectsPermissions.
 */
var filterCreator = function () {
    var isPartialAdminProfile = false;
    return {
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var allAdditions, newCustomObjects, newFields, adminProfileChange, adminProfile;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        allAdditions = changes.filter(adapter_api_1.isAdditionChange);
                        return [4 /*yield*/, awu(allAdditions)
                                .map(adapter_api_1.getChangeData)
                                .filter(transformer_1.isCustomObject)
                                .toArray()];
                    case 1:
                        newCustomObjects = _a.sent();
                        newFields = __spreadArrays(newCustomObjects.flatMap(function (objType) { return Object.values(objType.fields); }), allAdditions.filter(adapter_api_1.isFieldChange).map(adapter_api_1.getChangeData)).filter(shouldSetDefaultPermissions);
                        if (newCustomObjects.length === 0 && newFields.length === 0) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, awu(changes).find(isAdminProfileChange)];
                    case 2:
                        adminProfileChange = _a.sent();
                        adminProfile = adminProfileChange !== undefined
                            ? adapter_api_1.getChangeData(adminProfileChange)
                            : createAdminProfile();
                        return [4 /*yield*/, addMissingPermissions(adminProfile, 'object', newCustomObjects)];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, addMissingPermissions(adminProfile, 'field', newFields)];
                    case 4:
                        _a.sent();
                        if (adminProfileChange === undefined) {
                            // If we did not originally have a change to the admin profile, we need to create a new one
                            isPartialAdminProfile = true;
                            changes.push({ action: 'modify', data: { before: createAdminProfile(), after: adminProfile } });
                        }
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!isPartialAdminProfile) return [3 /*break*/, 2];
                        // we created a partial admin profile change, we have to remove it here otherwise it will
                        // override the real admin profile
                        return [4 /*yield*/, removeAsync(changes, isAdminProfileChange)];
                    case 1:
                        // we created a partial admin profile change, we have to remove it here otherwise it will
                        // override the real admin profile
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); },
    };
};
exports["default"] = filterCreator;
