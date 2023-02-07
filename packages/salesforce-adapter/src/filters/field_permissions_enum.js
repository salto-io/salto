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
var _a, _b;
exports.__esModule = true;
exports.profileFieldLevelSecurity = exports.enumFieldPermissions = void 0;
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
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var logging_1 = require("@salto-io/logging");
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
var metadataTypesWithFieldPermissions = [
    constants_1.PROFILE_METADATA_TYPE,
    constants_1.PERMISSION_SET_METADATA_TYPE,
];
var FIELD_PERMISSIONS = 'fieldPermissions';
var isTypeWithFieldPermissions = function (elem) {
    return (Object.prototype.hasOwnProperty.call(elem.fields, FIELD_PERMISSIONS));
};
var fieldPermissionsEnumStrings = ['ReadOnly', 'ReadWrite', 'NoAccess'];
exports.enumFieldPermissions = new adapter_api_1.PrimitiveType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'FieldPermissionEnum'),
    primitive: adapter_api_1.PrimitiveTypes.STRING,
    annotations: (_a = {},
        _a[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
            values: fieldPermissionsEnumStrings,
            enforce_value: true,
        }),
        _a),
    path: [constants_1.SALESFORCE, constants_1.TYPES_PATH, constants_1.SUBTYPES_PATH, 'FieldPermissionEnum'],
});
exports.profileFieldLevelSecurity = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'ProfileFieldLevelSecurity'),
    fields: {
        field: { refType: adapter_api_1.BuiltinTypes.STRING },
        editable: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        readable: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
    },
    annotations: (_b = {},
        _b[constants_1.METADATA_TYPE] = 'ProfileFieldLevelSecurity',
        _b),
});
var mapOfMapOfEnumFieldPermissions = adapter_api_1.createRefToElmWithValue(new adapter_api_1.MapType(new adapter_api_1.MapType(exports.enumFieldPermissions)));
var mapOfProfileFieldLevelSecurity = adapter_api_1.createRefToElmWithValue(new adapter_api_1.MapType(new adapter_api_1.MapType(exports.profileFieldLevelSecurity)));
var fieldPermissionsObjectToEnum = function (fieldPermissionsObject) {
    if (fieldPermissionsObject.editable && fieldPermissionsObject.readable) {
        return 'ReadWrite';
    }
    if (fieldPermissionsObject.readable) {
        return 'ReadOnly';
    }
    return 'NoAccess';
};
var permissionsEnumToObject = function (fieldName, fieldPermissionEnum) {
    switch (fieldPermissionEnum) {
        case 'ReadWrite':
            return {
                field: fieldName,
                readable: true,
                editable: true,
            };
        case 'ReadOnly':
            return {
                field: fieldName,
                readable: true,
                editable: false,
            };
        case 'NoAccess':
            return {
                field: fieldName,
                readable: false,
                editable: false,
            };
        default:
            log.warn('Deploying unexpected value as fieldPermission for field %s, NaCL value is - %s', fieldName, fieldPermissionEnum);
            return {
                field: fieldName,
                readable: false,
                editable: false,
            };
    }
};
var isValidFieldPermissions = function (instance) {
    var fieldPermissions = instance.value.fieldPermissions;
    if (fieldPermissions === undefined) {
        log.warn('Instance of type %s does not have fieldPermissions value (as expected)', instance.elemID.typeName);
        return false;
    }
    if (!lodash_1["default"].isPlainObject(fieldPermissions)) {
        log.warn('Instance of type %s does not have fieldPermissions field as Map (as expected)', instance.elemID.typeName);
        return false;
    }
    return true;
};
var fieldPermissionValuesToEnum = function (instance) {
    if (!isValidFieldPermissions(instance)) {
        return instance;
    }
    instance.value.fieldPermissions = lodash_1["default"].mapValues(instance.value.fieldPermissions, function (objectPermission) { return lodash_1["default"].mapValues(objectPermission, function (fieldPermission) {
        if (lodash_1["default"].isPlainObject(fieldPermission)
            && lodash_1["default"].isBoolean(fieldPermission.readable) && lodash_1["default"].isBoolean(fieldPermission.editable)) {
            return fieldPermissionsObjectToEnum(fieldPermission);
        }
        return fieldPermission;
    }); });
    return instance;
};
var fieldPermissionValuesToObject = function (instance) {
    if (!isValidFieldPermissions(instance)) {
        return instance;
    }
    instance.value.fieldPermissions = lodash_1["default"].mapValues(instance.value.fieldPermissions, function (objectPermission, objectName) { return lodash_1["default"].mapValues(objectPermission, function (fieldPermissionValue, fieldName) { return (permissionsEnumToObject(objectName + "." + fieldName, fieldPermissionValue)); }); });
    return instance;
};
var fieldPermissionFieldToEnum = function (objectType) { return __awaiter(void 0, void 0, void 0, function () {
    var fieldType;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!isTypeWithFieldPermissions(objectType)) return [3 /*break*/, 2];
                return [4 /*yield*/, objectType.fields.fieldPermissions.getType()];
            case 1:
                fieldType = _a.sent();
                if (!adapter_api_1.isMapType(fieldType)) {
                    log.warn('Type %s does not have fieldPermissions field as Map (as expected)', objectType.elemID.typeName);
                    return [2 /*return*/];
                }
                objectType.fields.fieldPermissions.refType = mapOfMapOfEnumFieldPermissions;
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); };
var fieldPermissionsFieldToOriginalType = function (objectType) {
    if (isTypeWithFieldPermissions(objectType)) {
        objectType.fields.fieldPermissions.refType = mapOfProfileFieldLevelSecurity;
    }
};
var getInstanceChangesWithFieldPermissions = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (awu(changes)
                .filter(adapter_api_1.isAdditionOrModificationChange)
                .filter(utils_1.isInstanceOfTypeChange.apply(void 0, metadataTypesWithFieldPermissions))
                .filter(adapter_api_1.isInstanceChange)
                .toArray())];
    });
}); };
var shouldRunDeployFilters;
// The decision if to run the deploy filters is based on the fieldPermissions type
// which indicates if it this filter ran onFetch or not
var shouldRunDeployFiltersAccordingToInstanceType = function (instanceType) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = isTypeWithFieldPermissions(instanceType);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, instanceType.fields.fieldPermissions.getType()];
            case 1:
                _a = (_b.sent()).elemID
                    .isEqual(mapOfMapOfEnumFieldPermissions.elemID);
                _b.label = 2;
            case 2: return [2 /*return*/, (_a)];
        }
    });
}); };
var removeUnfethcedCustomObjects = function (instance, customObjects) {
    if (isValidFieldPermissions(instance)) {
        instance.value.fieldPermissions = lodash_1["default"].pick(instance.value.fieldPermissions, customObjects);
    }
};
var filter = function (_a) {
    var config = _a.config;
    return ({
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var relevantInstances, elementSource, customObjects, relevantObjectTypes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        log.info('Running fieldPermissionsEnum onFetch - reducing fieldPermissions size');
                        return [4 /*yield*/, awu(elements)
                                .filter(adapter_api_1.isInstanceElement)
                                .filter(function (element) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, utils_1.isInstanceOfType.apply(void 0, metadataTypesWithFieldPermissions)(element)];
                            }); }); })
                                .toArray()];
                    case 1:
                        relevantInstances = _a.sent();
                        if (relevantInstances.length === 0) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, utils_1.buildElementsSourceForFetch(elements, config).getAll()];
                    case 2:
                        elementSource = _a.sent();
                        return [4 /*yield*/, awu(elementSource)
                                .filter(transformer_1.isCustomObject)
                                .map(function (element) { return transformer_1.apiName(element); })
                                .toArray()];
                    case 3:
                        customObjects = _a.sent();
                        relevantInstances.forEach(function (element) {
                            removeUnfethcedCustomObjects(element, customObjects);
                        });
                        if (config.enumFieldPermissions === false) {
                            return [2 /*return*/];
                        }
                        log.info('fieldPermissionsEnum onFetch - converting fieldPermissions to enum');
                        relevantInstances.forEach(function (element) {
                            fieldPermissionValuesToEnum(element);
                        });
                        return [4 /*yield*/, awu(elements)
                                .filter(adapter_api_1.isObjectType)
                                .filter(function (element) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _b = (_a = metadataTypesWithFieldPermissions).includes;
                                        return [4 /*yield*/, transformer_1.apiName(element)];
                                    case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                                }
                            }); }); })
                                .toArray()];
                    case 4:
                        relevantObjectTypes = _a.sent();
                        if (relevantObjectTypes.length === 0) {
                            return [2 /*return*/];
                        }
                        relevantObjectTypes.forEach(function (element) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fieldPermissionFieldToEnum(element)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); });
                        elements.push(exports.enumFieldPermissions);
                        return [2 /*return*/];
                }
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var instanceChangesWithFieldPermissions, instanceType, instanceTypes, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, getInstanceChangesWithFieldPermissions(changes)];
                    case 1:
                        instanceChangesWithFieldPermissions = _c.sent();
                        if (instanceChangesWithFieldPermissions.length === 0) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, adapter_api_1.getChangeData(instanceChangesWithFieldPermissions[0]).getType()];
                    case 2:
                        instanceType = _c.sent();
                        return [4 /*yield*/, shouldRunDeployFiltersAccordingToInstanceType(instanceType)];
                    case 3:
                        shouldRunDeployFilters = _c.sent();
                        if (!shouldRunDeployFilters) {
                            return [2 /*return*/];
                        }
                        log.info('Running enumFieldPermissions preDeploy');
                        instanceChangesWithFieldPermissions.forEach(function (instanceChange) { return (adapter_utils_1.applyFunctionToChangeData(instanceChange, fieldPermissionValuesToObject)); });
                        _b = (_a = Object).values;
                        return [4 /*yield*/, awu(instanceChangesWithFieldPermissions.map(adapter_api_1.getChangeData))
                                .map(function (inst) { return inst.getType(); })
                                .keyBy(function (type) { return transformer_1.apiName(type); })];
                    case 4:
                        instanceTypes = _b.apply(_a, [_c.sent()]);
                        instanceTypes.forEach(fieldPermissionsFieldToOriginalType);
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var instanceChangesWithFieldPermissions, instanceTypes, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!shouldRunDeployFilters) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, getInstanceChangesWithFieldPermissions(changes)];
                    case 1:
                        instanceChangesWithFieldPermissions = _c.sent();
                        if (instanceChangesWithFieldPermissions.length === 0) {
                            return [2 /*return*/];
                        }
                        log.info('Running enumFieldPermissions onDeploy');
                        instanceChangesWithFieldPermissions.forEach(function (instanceChange) { return (adapter_utils_1.applyFunctionToChangeData(instanceChange, fieldPermissionValuesToEnum)); });
                        _b = (_a = Object).values;
                        return [4 /*yield*/, awu(instanceChangesWithFieldPermissions.map(adapter_api_1.getChangeData))
                                .map(function (inst) { return inst.getType(); })
                                .keyBy(function (type) { return transformer_1.apiName(type); })];
                    case 2:
                        instanceTypes = _b.apply(_a, [_c.sent()]);
                        instanceTypes.forEach(fieldPermissionFieldToEnum);
                        return [2 /*return*/];
                }
            });
        }); },
    });
};
exports["default"] = filter;
