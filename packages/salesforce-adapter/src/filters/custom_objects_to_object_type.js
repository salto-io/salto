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
var _a, _b;
exports.__esModule = true;
exports.createCustomObjectChange = exports.createCustomTypeFromCustomObjectInstance = exports.transformFieldAnnotations = exports.getObjectDirectoryPath = exports.CUSTOM_OBJECT_TYPE_ID = exports.NESTED_INSTANCE_VALUE_TO_TYPE_NAME = exports.NESTED_INSTANCE_TYPE_NAME = exports.NESTED_INSTANCE_VALUE_NAME = exports.INSTANCE_TYPE_FIELD = exports.INSTANCE_REQUIRED_FIELD = void 0;
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
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lodash_1 = require("lodash");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var convert_lists_1 = require("./convert_lists");
var metadata_deploy_1 = require("../metadata_deploy");
var workflow_1 = require("./workflow");
var types_1 = require("../types");
var log = logging_1.logger(module);
var makeArray = lowerdash_1.collections.array.makeArray;
var _c = lowerdash_1.collections.asynciterable, awu = _c.awu, groupByAsync = _c.groupByAsync;
var removeAsync = lowerdash_1.promises.array.removeAsync;
var mapValuesAsync = lowerdash_1.promises.object.mapValuesAsync;
var isDefined = lowerdash_1.values.isDefined;
exports.INSTANCE_REQUIRED_FIELD = 'required';
exports.INSTANCE_TYPE_FIELD = 'type';
exports.NESTED_INSTANCE_VALUE_NAME = {
    WEB_LINKS: 'webLinks',
    VALIDATION_RULES: 'validationRules',
    BUSINESS_PROCESSES: 'businessProcesses',
    RECORD_TYPES: 'recordTypes',
    LIST_VIEWS: 'listViews',
    FIELD_SETS: 'fieldSets',
    COMPACT_LAYOUTS: 'compactLayouts',
    SHARING_REASONS: 'sharingReasons',
    INDEXES: 'indexes',
};
exports.NESTED_INSTANCE_TYPE_NAME = {
    WEB_LINK: constants_1.WEBLINK_METADATA_TYPE,
    VALIDATION_RULE: constants_1.VALIDATION_RULES_METADATA_TYPE,
    BUSINESS_PROCESS: constants_1.BUSINESS_PROCESS_METADATA_TYPE,
    RECORD_TYPE: constants_1.RECORD_TYPE_METADATA_TYPE,
    LIST_VIEW: 'ListView',
    FIELD_SET: 'FieldSet',
    COMPACT_LAYOUT: 'CompactLayout',
    SHARING_REASON: 'SharingReason',
    INDEX: 'Index',
};
// The below metadata types extend Metadata and are mutable using a specific API call
exports.NESTED_INSTANCE_VALUE_TO_TYPE_NAME = (_a = {},
    _a[exports.NESTED_INSTANCE_VALUE_NAME.WEB_LINKS] = exports.NESTED_INSTANCE_TYPE_NAME.WEB_LINK,
    _a[exports.NESTED_INSTANCE_VALUE_NAME.VALIDATION_RULES] = exports.NESTED_INSTANCE_TYPE_NAME.VALIDATION_RULE,
    _a[exports.NESTED_INSTANCE_VALUE_NAME.BUSINESS_PROCESSES] = exports.NESTED_INSTANCE_TYPE_NAME.BUSINESS_PROCESS,
    _a[exports.NESTED_INSTANCE_VALUE_NAME.RECORD_TYPES] = exports.NESTED_INSTANCE_TYPE_NAME.RECORD_TYPE,
    _a[exports.NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS] = exports.NESTED_INSTANCE_TYPE_NAME.LIST_VIEW,
    _a[exports.NESTED_INSTANCE_VALUE_NAME.FIELD_SETS] = exports.NESTED_INSTANCE_TYPE_NAME.FIELD_SET,
    _a[exports.NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS] = exports.NESTED_INSTANCE_TYPE_NAME.COMPACT_LAYOUT,
    _a[exports.NESTED_INSTANCE_VALUE_NAME.SHARING_REASONS] = exports.NESTED_INSTANCE_TYPE_NAME.SHARING_REASON,
    _a[exports.NESTED_INSTANCE_VALUE_NAME.INDEXES] = exports.NESTED_INSTANCE_TYPE_NAME.INDEX,
    _a);
exports.CUSTOM_OBJECT_TYPE_ID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.CUSTOM_OBJECT);
var CUSTOM_ONLY_ANNOTATION_TYPE_NAMES = ['allowInChatterGroups', 'customHelp', 'customHelpPage',
    'customSettingsType', 'deploymentStatus', 'deprecated', 'enableActivities', 'enableBulkApi',
    'enableReports', 'enableSearch', 'enableSharing', 'enableStreamingApi', 'gender',
    'nameField', 'pluralLabel', 'sharingModel', 'startsWith', 'visibility'];
var CUSTOM_SETTINGS_ONLY_ANNOTATION_TYPE_NAMES = ['customSettingsType', 'apiName',
    'metadataType', 'enableFeeds', 'visibility'];
var ANNOTATIONS_TO_IGNORE_FROM_INSTANCE = ['eventType', 'publishBehavior', 'fields',
    constants_1.INSTANCE_FULL_NAME_FIELD, constants_1.LABEL, 'household', 'articleTypeChannelDisplay', constants_1.INTERNAL_ID_FIELD];
var nestedMetadatatypeToReplaceDirName = (_b = {},
    _b[constants_1.WEBLINK_METADATA_TYPE] = 'ButtonsLinksAndActions',
    _b);
var getFieldTypeName = function (annotations) {
    var _a;
    var typeName = (_a = annotations[exports.INSTANCE_TYPE_FIELD]) !== null && _a !== void 0 ? _a : constants_1.INTERNAL_FIELD_TYPE_NAMES.UNKNOWN;
    return annotations[constants_1.FORMULA]
        ? transformer_1.formulaTypeName(typeName)
        : typeName;
};
var annotationTypesForObject = function (typesFromInstance, instance, custom) {
    var annotationTypes = typesFromInstance.standardAnnotationTypes;
    if (transformer_1.isCustomSettings(instance)) {
        annotationTypes = typesFromInstance.customSettingsAnnotationTypes;
    }
    else if (custom) {
        annotationTypes = typesFromInstance.customAnnotationTypes;
    }
    return annotationTypes;
};
var getObjectDirectoryPath = function (obj) { return __awaiter(void 0, void 0, void 0, function () {
    var objFileName, objNamespace;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                objFileName = adapter_utils_1.pathNaclCase(obj.elemID.name);
                return [4 /*yield*/, utils_1.getNamespace(obj)];
            case 1:
                objNamespace = _a.sent();
                if (objNamespace) {
                    return [2 /*return*/, [constants_1.SALESFORCE, constants_1.INSTALLED_PACKAGES_PATH, objNamespace, constants_1.OBJECTS_PATH, objFileName]];
                }
                return [2 /*return*/, [constants_1.SALESFORCE, constants_1.OBJECTS_PATH, objFileName]];
        }
    });
}); };
exports.getObjectDirectoryPath = getObjectDirectoryPath;
var getFieldDependency = function (values) {
    var _a;
    var controllingField = values[constants_1.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD];
    var valueSettingsInfo = values[constants_1.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS];
    if (controllingField && valueSettingsInfo) {
        var valueSettings = makeArray(valueSettingsInfo)
            .map(function (value) {
            var _a;
            return (_a = {},
                _a[constants_1.VALUE_SETTINGS_FIELDS.VALUE_NAME] = value[constants_1.VALUE_SETTINGS_FIELDS.VALUE_NAME],
                _a[constants_1.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE] = makeArray(value[constants_1.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE]),
                _a);
        });
        return _a = {},
            _a[constants_1.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD] = controllingField,
            _a[constants_1.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS] = valueSettings,
            _a;
    }
    return undefined;
};
var transformAnnotationsNames = function (fields, parentName) {
    var annotations = {};
    var typeName = fields[exports.INSTANCE_TYPE_FIELD];
    Object.entries(fields).forEach(function (_a) {
        var k = _a[0], v = _a[1];
        switch (k) {
            case exports.INSTANCE_REQUIRED_FIELD:
                if (utils_1.boolValue(v)) {
                    annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true;
                }
                break;
            case constants_1.INSTANCE_FULL_NAME_FIELD:
                annotations[constants_1.API_NAME] = [parentName, v].join(constants_1.API_NAME_SEPARATOR);
                break;
            case constants_1.FIELD_ANNOTATIONS.DEFAULT_VALUE:
                if (typeName === constants_1.FIELD_TYPE_NAMES.CHECKBOX) {
                    annotations[k] = v;
                }
                else {
                    annotations[constants_1.DEFAULT_VALUE_FORMULA] = v;
                }
                break;
            case constants_1.FIELD_ANNOTATIONS.VALUE_SET:
                // Checks for global value set
                if (!lodash_1["default"].isUndefined(v[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME])) {
                    annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME] = v[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME];
                    annotations[constants_1.FIELD_ANNOTATIONS.RESTRICTED] = true;
                }
                else {
                    var valueSetDefinition = v[constants_1.VALUE_SET_FIELDS.VALUE_SET_DEFINITION];
                    if (valueSetDefinition) {
                        annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET] = makeArray(valueSetDefinition[constants_1.VALUE_SET_DEFINITION_FIELDS.VALUE]);
                        var sorted = valueSetDefinition[constants_1.VALUE_SET_DEFINITION_FIELDS.SORTED];
                        if (sorted !== undefined) {
                            annotations[constants_1.VALUE_SET_DEFINITION_FIELDS.SORTED] = sorted;
                        }
                        annotations[constants_1.FIELD_ANNOTATIONS.RESTRICTED] = v[constants_1.VALUE_SET_FIELDS.RESTRICTED] || false;
                    }
                }
                if (!lodash_1["default"].isUndefined(getFieldDependency(v))) {
                    annotations[constants_1.FIELD_ANNOTATIONS.FIELD_DEPENDENCY] = getFieldDependency(v);
                }
                break;
            case constants_1.FIELD_ANNOTATIONS.LOOKUP_FILTER:
                if (utils_1.boolValue(v[constants_1.LOOKUP_FILTER_FIELDS.IS_OPTIONAL])) {
                    delete v[constants_1.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE];
                }
                annotations[k] = v;
                break;
            default:
                annotations[k] = v;
        }
    });
    return annotations;
};
var transformFieldAnnotations = function (instanceFieldValues, fieldType, parentName) { return __awaiter(void 0, void 0, void 0, function () {
    var annotations, annotationsType, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                annotations = lodash_1["default"].omit(transformAnnotationsNames(instanceFieldValues, parentName), exports.INSTANCE_TYPE_FIELD);
                _a = utils_1.buildAnnotationsObjectType;
                return [4 /*yield*/, fieldType.getAnnotationTypes()];
            case 1:
                annotationsType = _a.apply(void 0, [_b.sent()]);
                return [4 /*yield*/, convert_lists_1.convertList(annotationsType, annotations)];
            case 2:
                _b.sent();
                return [4 /*yield*/, adapter_utils_1.transformValues({
                        values: annotations,
                        type: annotationsType,
                        transformFunc: transformer_1.transformPrimitive,
                        strict: false,
                        allowEmpty: true,
                    })];
            case 3: return [2 /*return*/, (_b.sent()) || {}];
        }
    });
}); };
exports.transformFieldAnnotations = transformFieldAnnotations;
var transformObjectAnnotationValues = function (instance, annotationTypesFromInstance) {
    var annotationsObject = utils_1.buildAnnotationsObjectType(annotationTypesFromInstance);
    return adapter_utils_1.transformValues({
        values: instance.value,
        type: annotationsObject,
        transformFunc: transformer_1.transformPrimitive,
        allowEmpty: true,
    });
};
var transformObjectAnnotations = function (customObject, annotationTypesFromInstance, instance) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                customObject.annotationRefTypes = __assign(__assign({}, customObject.annotationRefTypes), lodash_1["default"].mapValues(annotationTypesFromInstance, function (t) { return adapter_api_1.createRefToElmWithValue(t); }));
                _a = customObject;
                _b = [__assign({}, customObject.annotations)];
                return [4 /*yield*/, transformObjectAnnotationValues(instance, annotationTypesFromInstance)];
            case 1:
                _a.annotations = __assign.apply(void 0, _b.concat([_c.sent()]));
                return [2 /*return*/];
        }
    });
}); };
var createNestedMetadataInstances = function (instance, _a, nestedMetadataTypes) {
    var objElemID = _a.elemID, objPath = _a.path;
    return awu(Object.entries(nestedMetadataTypes))
        .flatMap(function (_a) {
        var name = _a[0], type = _a[1];
        var nestedInstancesValues = makeArray(instance.value[name]);
        if (lodash_1["default"].isEmpty(nestedInstancesValues)) {
            return [];
        }
        var removeDuplicateInstances = function (instances) { return (lodash_1["default"](instances).keyBy(constants_1.INSTANCE_FULL_NAME_FIELD).values().value()); };
        return awu(removeDuplicateInstances(nestedInstancesValues))
            .map(function (nestedInstanceValues) { return __awaiter(void 0, void 0, void 0, function () {
            var nameParts, fullName, instanceName, instanceFileName, typeFolderName, path;
            var _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, transformer_1.apiName(instance)];
                    case 1:
                        nameParts = [
                            _c.sent(),
                            nestedInstanceValues[constants_1.INSTANCE_FULL_NAME_FIELD]
                        ];
                        fullName = nameParts.join(constants_1.API_NAME_SEPARATOR);
                        instanceName = transformer_1.Types.getElemId(nameParts.join('_'), true, transformer_1.createInstanceServiceIds(lodash_1["default"].pick(nestedInstanceValues, constants_1.INSTANCE_FULL_NAME_FIELD), type)).name;
                        instanceFileName = adapter_utils_1.pathNaclCase(instanceName);
                        typeFolderName = adapter_utils_1.pathNaclCase((_b = nestedMetadatatypeToReplaceDirName[type.elemID.name]) !== null && _b !== void 0 ? _b : type.elemID.name);
                        nestedInstanceValues[constants_1.INSTANCE_FULL_NAME_FIELD] = fullName;
                        path = __spreadArrays(objPath.slice(0, -1), [
                            typeFolderName,
                            instanceFileName,
                        ]);
                        return [2 /*return*/, new adapter_api_1.InstanceElement(instanceName, type, nestedInstanceValues, path, (_a = {}, _a[adapter_api_1.CORE_ANNOTATIONS.PARENT] = [new adapter_api_1.ReferenceExpression(objElemID)], _a))];
                }
            });
        }); });
    }).toArray();
};
var hasCustomSuffix = function (objectName) { return (types_1.INSTANCE_SUFFIXES.some(function (suffix) { return objectName.endsWith("__" + suffix); })); };
var createFieldFromMetadataInstance = function (customObject, field, instanceName) { return __awaiter(void 0, void 0, void 0, function () {
    var fieldType, annotations, serviceIds, fieldApiName, fieldName;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                fieldType = transformer_1.Types.getKnownType(getFieldTypeName(field), true);
                if (fieldType === undefined) {
                    log.warn('Got unknown field type %s for field %s in object %s, using unknown type instead', getFieldTypeName(field), field[constants_1.INSTANCE_FULL_NAME_FIELD], customObject.elemID.getFullName());
                    fieldType = transformer_1.Types.getKnownType(constants_1.INTERNAL_FIELD_TYPE_NAMES.UNKNOWN, true);
                }
                return [4 /*yield*/, exports.transformFieldAnnotations(field, fieldType, instanceName)];
            case 1:
                annotations = _c.sent();
                serviceIds = (_a = {},
                    _a[constants_1.API_NAME] = annotations[constants_1.API_NAME],
                    _a[adapter_api_1.OBJECT_SERVICE_ID] = adapter_api_1.toServiceIdsString((_b = {},
                        _b[constants_1.API_NAME] = instanceName,
                        _b[constants_1.METADATA_TYPE] = constants_1.CUSTOM_OBJECT,
                        _b)),
                    _a);
                fieldApiName = field[constants_1.INSTANCE_FULL_NAME_FIELD];
                fieldName = transformer_1.Types.getElemId(adapter_utils_1.naclCase(fieldApiName), true, serviceIds).name;
                return [2 /*return*/, new adapter_api_1.Field(customObject, fieldName, fieldType, annotations)];
        }
    });
}); };
var DEFAULT_TYPES_FROM_INSTANCE = {
    customAnnotationTypes: {},
    customSettingsAnnotationTypes: {},
    nestedMetadataTypes: {},
    standardAnnotationTypes: {},
};
var createCustomTypeFromCustomObjectInstance = function (_a) {
    var instance = _a.instance, _b = _a.typesFromInstance, typesFromInstance = _b === void 0 ? DEFAULT_TYPES_FROM_INSTANCE : _b, _c = _a.fieldsToSkip, fieldsToSkip = _c === void 0 ? [] : _c, objectMetadataType = _a.metadataType;
    return __awaiter(void 0, void 0, void 0, function () {
        var name, label, keyPrefix, serviceIds, object, _d, annotationTypes, instanceFields;
        var _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    name = instance.value[constants_1.INSTANCE_FULL_NAME_FIELD];
                    label = instance.value[constants_1.LABEL];
                    keyPrefix = instance.value[constants_1.KEY_PREFIX];
                    serviceIds = (_e = {},
                        _e[constants_1.API_NAME] = name,
                        _e[constants_1.METADATA_TYPE] = constants_1.CUSTOM_OBJECT,
                        _e);
                    object = transformer_1.Types.createObjectType(name, true, false, serviceIds);
                    utils_1.addApiName(object, name);
                    utils_1.addMetadataType(object, objectMetadataType);
                    utils_1.addLabel(object, label);
                    utils_1.addKeyPrefix(object, keyPrefix === null ? undefined : keyPrefix);
                    _d = object;
                    return [4 /*yield*/, exports.getObjectDirectoryPath(object)];
                case 1:
                    _d.path = __spreadArrays.apply(void 0, [_f.sent(), [adapter_utils_1.pathNaclCase(object.elemID.name)]]);
                    annotationTypes = annotationTypesForObject(typesFromInstance, instance, hasCustomSuffix(name));
                    return [4 /*yield*/, transformObjectAnnotations(object, annotationTypes, instance)];
                case 2:
                    _f.sent();
                    instanceFields = makeArray(instance.value.fields);
                    return [4 /*yield*/, awu(instanceFields)
                            .forEach(function (fieldValues) { return __awaiter(void 0, void 0, void 0, function () {
                            var field;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, createFieldFromMetadataInstance(object, fieldValues, name)];
                                    case 1:
                                        field = _a.sent();
                                        if (!(fieldsToSkip).includes(field.name)) {
                                            object.fields[field.name] = field;
                                        }
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 3:
                    _f.sent();
                    return [2 /*return*/, object];
            }
        });
    });
};
exports.createCustomTypeFromCustomObjectInstance = createCustomTypeFromCustomObjectInstance;
var createFromInstance = function (instance, typesFromInstance, fieldsToSkip) { return __awaiter(void 0, void 0, void 0, function () {
    var object, nestedMetadataInstances;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.createCustomTypeFromCustomObjectInstance({
                    instance: instance,
                    typesFromInstance: typesFromInstance,
                    fieldsToSkip: fieldsToSkip,
                })];
            case 1:
                object = _a.sent();
                return [4 /*yield*/, createNestedMetadataInstances(instance, object, typesFromInstance.nestedMetadataTypes)];
            case 2:
                nestedMetadataInstances = _a.sent();
                return [2 /*return*/, __spreadArrays([object], nestedMetadataInstances)];
        }
    });
}); };
var removeIrrelevantElements = function (elements) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, removeAsync(elements, utils_1.isInstanceOfType(constants_1.CUSTOM_OBJECT))];
            case 1:
                _a.sent();
                return [4 /*yield*/, removeAsync(elements, function (elem) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, transformer_1.apiName(elem)];
                            case 1: return [2 /*return*/, (_a.sent()) === constants_1.CUSTOM_OBJECT];
                        }
                    }); }); })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
// Instances metadataTypes that should be under the customObject folder and have a PARENT reference
var workflowDependentMetadataTypes = new Set(Object.values(workflow_1.WORKFLOW_FIELD_TO_TYPE));
var dependentMetadataTypes = new Set(__spreadArrays([constants_1.CUSTOM_TAB_METADATA_TYPE, constants_1.DUPLICATE_RULE_METADATA_TYPE,
    constants_1.QUICK_ACTION_METADATA_TYPE, constants_1.LEAD_CONVERT_SETTINGS_METADATA_TYPE,
    constants_1.ASSIGNMENT_RULES_METADATA_TYPE, constants_1.CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, constants_1.SHARING_RULES_TYPE,
    constants_1.LIGHTNING_PAGE_TYPE, constants_1.FLEXI_PAGE_TYPE], workflowDependentMetadataTypes.values()));
var hasCustomObjectParent = function (instance) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
    switch (_c.label) {
        case 0:
            _b = (_a = dependentMetadataTypes).has;
            return [4 /*yield*/, transformer_1.metadataType(instance)];
        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
    }
}); }); };
var fixDependentInstancesPathAndSetParent = function (elements, referenceElements) { return __awaiter(void 0, void 0, void 0, function () {
    var setDependingInstancePath, apiNameToCustomObject, _a, _b, hasSobjectField, getDependentObjectID, getDependentCustomObj;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                setDependingInstancePath = function (instance, customObject) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a;
                    var _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _a = instance;
                                return [4 /*yield*/, exports.getObjectDirectoryPath(customObject)];
                            case 1:
                                _a.path = __spreadArrays.apply(void 0, [_c.sent(),
                                    (workflowDependentMetadataTypes.has(instance.elemID.typeName)
                                        ? [workflow_1.WORKFLOW_DIR_NAME, adapter_utils_1.pathNaclCase(lowerdash_1.strings.capitalizeFirstLetter((_b = workflow_1.WORKFLOW_TYPE_TO_FIELD[instance.elemID.typeName]) !== null && _b !== void 0 ? _b : instance.elemID.typeName))]
                                        : [adapter_utils_1.pathNaclCase(instance.elemID.typeName)]), [
                                        adapter_utils_1.pathNaclCase(instance.elemID.name),
                                    ]]);
                                return [2 /*return*/];
                        }
                    });
                }); };
                _b = (_a = lowerdash_1.multiIndex).keyByAsync;
                _c = {};
                return [4 /*yield*/, referenceElements.getAll()];
            case 1: return [4 /*yield*/, _b.apply(_a, [(_c.iter = _d.sent(),
                        _c.filter = transformer_1.isCustomObject,
                        _c.key = function (obj) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, transformer_1.apiName(obj)];
                                case 1: return [2 /*return*/, [_a.sent()]];
                            }
                        }); }); },
                        _c.map = function (obj) { return obj.elemID; },
                        _c)])];
            case 2:
                apiNameToCustomObject = _d.sent();
                hasSobjectField = function (instance) {
                    return isDefined(instance.value.sobjectType);
                };
                getDependentObjectID = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, transformer_1.metadataType(instance)];
                            case 1:
                                switch (_a.sent()) {
                                    case constants_1.LEAD_CONVERT_SETTINGS_METADATA_TYPE:
                                        return [2 /*return*/, 'Lead'];
                                    case constants_1.FLEXI_PAGE_TYPE:
                                        if (hasSobjectField(instance)) {
                                            return [2 /*return*/, instance.value.sobjectType];
                                        }
                                        return [2 /*return*/, undefined];
                                    default:
                                        return [2 /*return*/, utils_1.parentApiName(instance)];
                                }
                                return [2 /*return*/];
                        }
                    });
                }); };
                getDependentCustomObj = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
                    var dependentObjID, objectID, object, _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0: return [4 /*yield*/, getDependentObjectID(instance)];
                            case 1:
                                dependentObjID = _b.sent();
                                objectID = dependentObjID !== undefined
                                    ? apiNameToCustomObject.get(dependentObjID) : undefined;
                                if (!(objectID !== undefined)) return [3 /*break*/, 3];
                                return [4 /*yield*/, referenceElements.get(objectID)];
                            case 2:
                                _a = _b.sent();
                                return [3 /*break*/, 4];
                            case 3:
                                _a = undefined;
                                _b.label = 4;
                            case 4:
                                object = _a;
                                return [2 /*return*/, adapter_api_1.isObjectType(object) ? object : undefined];
                        }
                    });
                }); };
                return [4 /*yield*/, awu(elements)
                        .filter(adapter_api_1.isInstanceElement)
                        .filter(hasCustomObjectParent)
                        .forEach(function (instance) { return __awaiter(void 0, void 0, void 0, function () {
                        var customObj;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, getDependentCustomObj(instance)];
                                case 1:
                                    customObj = _a.sent();
                                    if (lodash_1["default"].isUndefined(customObj)) {
                                        return [2 /*return*/];
                                    }
                                    return [4 /*yield*/, setDependingInstancePath(instance, customObj)];
                                case 2:
                                    _a.sent();
                                    utils_1.addElementParentReference(instance, customObj);
                                    return [2 /*return*/];
                            }
                        });
                    }); })];
            case 3:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); };
var shouldIncludeFieldChange = function (fieldsToSkip) { return (function (fieldChange) { return __awaiter(void 0, void 0, void 0, function () {
    var field, isRelevantField, _a, _b, _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                if (!adapter_api_1.isFieldChange(fieldChange)) {
                    return [2 /*return*/, false];
                }
                field = adapter_api_1.getChangeData(fieldChange);
                _a = adapter_api_1.isField(field) && !transformer_1.isLocalOnly(field);
                if (!_a) return [3 /*break*/, 2];
                _c = (_b = fieldsToSkip).includes;
                return [4 /*yield*/, transformer_1.apiName(field, true)];
            case 1:
                _a = !_c.apply(_b, [_j.sent()]);
                _j.label = 2;
            case 2:
                isRelevantField = (_a);
                _d = isRelevantField;
                if (!_d) return [3 /*break*/, 6];
                _e = adapter_api_1.isAdditionOrRemovalChange(fieldChange);
                if (_e) return [3 /*break*/, 5];
                _g = (_f = lodash_1["default"]).isEqual;
                return [4 /*yield*/, transformer_1.toCustomField(fieldChange.data.before)];
            case 3:
                _h = [_j.sent()];
                return [4 /*yield*/, transformer_1.toCustomField(fieldChange.data.after)];
            case 4:
                _e = !_g.apply(_f, _h.concat([_j.sent()]));
                _j.label = 5;
            case 5:
                _d = (_e);
                _j.label = 6;
            case 6: return [2 /*return*/, _d];
        }
    });
}); }); };
var getNestedCustomObjectValues = function (fullName, changes, fieldsToSkip, dataField) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d, _e;
    var _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                _a = [{ fullName: fullName }];
                return [4 /*yield*/, mapValuesAsync(exports.NESTED_INSTANCE_VALUE_TO_TYPE_NAME, function (fieldType) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b, _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _a = awu;
                                    _b = utils_1.getDataFromChanges;
                                    _c = [dataField];
                                    return [4 /*yield*/, awu(changes).filter(utils_1.isInstanceOfTypeChange(fieldType)).toArray()];
                                case 1: return [2 /*return*/, (_a.apply(void 0, [_b.apply(void 0, _c.concat([_d.sent()]))]).map(function (nestedInstance) { return __awaiter(void 0, void 0, void 0, function () {
                                        var _a, _b, _c;
                                        var _d;
                                        return __generator(this, function (_e) {
                                            switch (_e.label) {
                                                case 0:
                                                    _a = [{}];
                                                    return [4 /*yield*/, transformer_1.toMetadataInfo(nestedInstance)];
                                                case 1:
                                                    _b = [__assign.apply(void 0, _a.concat([_e.sent()]))];
                                                    _d = {};
                                                    _c = constants_1.INSTANCE_FULL_NAME_FIELD;
                                                    return [4 /*yield*/, transformer_1.apiName(nestedInstance, true)];
                                                case 2: return [2 /*return*/, (__assign.apply(void 0, _b.concat([(_d[_c] = _e.sent(), _d)])))];
                                            }
                                        });
                                    }); }).toArray())];
                            }
                        });
                    }); })];
            case 1:
                _b = [__assign.apply(void 0, _a.concat([_g.sent()]))];
                _f = {};
                _c = awu;
                _d = utils_1.getDataFromChanges;
                _e = [dataField];
                return [4 /*yield*/, awu(changes).filter(shouldIncludeFieldChange(fieldsToSkip)).toArray()];
            case 2: return [4 /*yield*/, _c.apply(void 0, [_d.apply(void 0, _e.concat([_g.sent()]))]).map(function (field) { return transformer_1.toCustomField(field); }).toArray()];
            case 3: return [2 /*return*/, (__assign.apply(void 0, _b.concat([(_f.fields = _g.sent(), _f)])))];
        }
    });
}); };
var createCustomObjectInstance = function (values) {
    var _a, _b, _c;
    var customFieldType = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.CUSTOM_FIELD),
        annotations: (_a = {}, _a[constants_1.METADATA_TYPE] = constants_1.CUSTOM_FIELD, _a),
    });
    var customObjectType = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.CUSTOM_OBJECT),
        annotationRefsOrTypes: lodash_1["default"].clone(transformer_1.metadataAnnotationTypes),
        annotations: {
            metadataType: constants_1.CUSTOM_OBJECT,
            dirName: 'objects',
            suffix: 'object',
        },
        fields: __assign((_b = {}, _b[metadata_deploy_1.DEPLOY_WRAPPER_INSTANCE_MARKER] = {
            refType: adapter_api_1.BuiltinTypes.BOOLEAN,
            annotations: (_c = {},
                _c[constants_1.FIELD_ANNOTATIONS.LOCAL_ONLY] = true,
                _c),
        }, _b.fields = {
            refType: new adapter_api_1.ListType(customFieldType),
        }, _b), lodash_1["default"].mapValues(exports.NESTED_INSTANCE_VALUE_TO_TYPE_NAME, function (fieldType) {
            var _a;
            return ({
                refType: new adapter_api_1.ListType(new adapter_api_1.ObjectType({
                    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, fieldType),
                    annotations: (_a = {}, _a[constants_1.METADATA_TYPE] = fieldType, _a),
                })),
            });
        })),
    });
    return transformer_1.createInstanceElement(values, customObjectType);
};
var getCustomObjectFromChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var elem, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                elem = adapter_api_1.getChangeData(change);
                _a = adapter_api_1.isObjectType(elem);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, transformer_1.isCustomObject(elem)];
            case 1:
                _a = (_b.sent());
                _b.label = 2;
            case 2:
                if (_a) {
                    return [2 /*return*/, elem];
                }
                if (adapter_api_1.isField(elem)) {
                    return [2 /*return*/, elem.parent];
                }
                // If we reach here this is a child instance.
                // If it passed the isCustomObjectRelatedChange filter then it must have a custom object parent
                return [2 /*return*/, awu(adapter_utils_1.getParents(elem)).filter(transformer_1.isCustomObject).peek()];
        }
    });
}); };
var getCustomObjectApiName = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = transformer_1.apiName;
                return [4 /*yield*/, getCustomObjectFromChange(change)];
            case 1: return [2 /*return*/, (_a.apply(void 0, [_b.sent()]))];
        }
    });
}); };
var isCustomObjectChildInstance = function (instance) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
    switch (_c.label) {
        case 0:
            _b = (_a = Object.values(exports.NESTED_INSTANCE_VALUE_TO_TYPE_NAME)).includes;
            return [4 /*yield*/, transformer_1.metadataType(instance)];
        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
    }
}); }); };
var isCustomObjectRelatedChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var elem, _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                elem = adapter_api_1.getChangeData(change);
                return [4 /*yield*/, transformer_1.isCustomObject(elem)];
            case 1:
                _b = (_f.sent());
                if (_b) return [3 /*break*/, 4];
                _c = adapter_api_1.isField(elem);
                if (!_c) return [3 /*break*/, 3];
                return [4 /*yield*/, transformer_1.isFieldOfCustomObject(elem)];
            case 2:
                _c = (_f.sent());
                _f.label = 3;
            case 3:
                _b = (_c);
                _f.label = 4;
            case 4:
                _a = _b;
                if (_a) return [3 /*break*/, 9];
                _e = adapter_api_1.isInstanceElement(elem);
                if (!_e) return [3 /*break*/, 6];
                return [4 /*yield*/, isCustomObjectChildInstance(elem)];
            case 5:
                _e = (_f.sent());
                _f.label = 6;
            case 6:
                _d = _e;
                if (!_d) return [3 /*break*/, 8];
                return [4 /*yield*/, getCustomObjectFromChange(change)];
            case 7:
                _d = (_f.sent()) !== undefined;
                _f.label = 8;
            case 8:
                _a = (_d);
                _f.label = 9;
            case 9: return [2 /*return*/, _a];
        }
    });
}); };
var createCustomObjectChange = function (fieldsToSkip, fullName, changes) {
    if (fieldsToSkip === void 0) { fieldsToSkip = []; }
    return __awaiter(void 0, void 0, void 0, function () {
        var objectChange, masterDetailFieldRemovals, _a, _b, _c, getAfterInstanceValues, after, _d, beforeParent, before, _e, _f, _g, _h;
        var _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0: return [4 /*yield*/, awu(changes)
                        .filter(adapter_api_1.isObjectTypeChange)
                        .find(function (change) { return transformer_1.isCustomObject(adapter_api_1.getChangeData(change)); })];
                case 1:
                    objectChange = _l.sent();
                    if (!(objectChange !== undefined && objectChange.action === 'remove')) return [3 /*break*/, 4];
                    masterDetailFieldRemovals = Object.values(objectChange.data.before.fields)
                        .filter(utils_1.isMasterDetailField)
                        .map(function (field) { return adapter_api_1.toChange({ before: field }); });
                    _j = {
                        action: 'remove'
                    };
                    _k = {};
                    _a = createCustomObjectInstance;
                    _b = [{}];
                    return [4 /*yield*/, transformer_1.toCustomProperties(objectChange.data.before, false)];
                case 2:
                    _c = [__assign.apply(void 0, _b.concat([_l.sent()]))];
                    return [4 /*yield*/, getNestedCustomObjectValues(fullName, masterDetailFieldRemovals, fieldsToSkip, 'before')];
                case 3: return [2 /*return*/, (_j.data = (_k.before = _a.apply(void 0, [__assign.apply(void 0, _c.concat([_l.sent()]))]),
                        _k),
                        _j)];
                case 4:
                    getAfterInstanceValues = function () { return __awaiter(void 0, void 0, void 0, function () {
                        var nestedValues, afterParent, includeFieldsFromParent, parentValues, _a, allFields;
                        var _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0: return [4 /*yield*/, getNestedCustomObjectValues(fullName, changes, fieldsToSkip, 'after')];
                                case 1:
                                    nestedValues = _c.sent();
                                    afterParent = objectChange === null || objectChange === void 0 ? void 0 : objectChange.data.after;
                                    if (afterParent === undefined) {
                                        return [2 /*return*/, __assign(__assign({}, nestedValues), (_b = {}, _b[metadata_deploy_1.DEPLOY_WRAPPER_INSTANCE_MARKER] = true, _b))];
                                    }
                                    includeFieldsFromParent = (objectChange === null || objectChange === void 0 ? void 0 : objectChange.action) === 'add';
                                    return [4 /*yield*/, transformer_1.toCustomProperties(afterParent, includeFieldsFromParent, fieldsToSkip)];
                                case 2:
                                    parentValues = _c.sent();
                                    if (!(parentValues.sharingModel === 'ControlledByParent' && !includeFieldsFromParent)) return [3 /*break*/, 4];
                                    // If we have to deploy the custom object and it is controlled by parent we must include
                                    // master-detail fields in the deployment, otherwise the deploy request will fail validation
                                    _a = parentValues;
                                    return [4 /*yield*/, awu(Object.values(afterParent.fields))
                                            .filter(utils_1.isMasterDetailField)
                                            .map(function (field) { return transformer_1.toCustomField(field); })
                                            // new fields in the custom object can have an undefined fullName if they are new and rely
                                            // on our "addDefaults" to get an api name - in that case the field with the api name will
                                            // be in nestedValues so it is safe to filter it out here
                                            .filter(function (field) { return field.fullName !== undefined; })
                                            .toArray()];
                                case 3:
                                    // If we have to deploy the custom object and it is controlled by parent we must include
                                    // master-detail fields in the deployment, otherwise the deploy request will fail validation
                                    _a.fields = _c.sent();
                                    _c.label = 4;
                                case 4:
                                    allFields = __spreadArrays(makeArray(nestedValues.fields), makeArray(parentValues.fields));
                                    return [2 /*return*/, __assign(__assign(__assign({}, parentValues), nestedValues), { fields: lodash_1["default"].uniqBy(allFields, function (field) { return field.fullName; }) })];
                            }
                        });
                    }); };
                    _d = createCustomObjectInstance;
                    return [4 /*yield*/, getAfterInstanceValues()];
                case 5:
                    after = _d.apply(void 0, [_l.sent()]);
                    if (objectChange !== undefined && objectChange.action === 'add') {
                        return [2 /*return*/, { action: 'add', data: { after: after } }];
                    }
                    beforeParent = objectChange === null || objectChange === void 0 ? void 0 : objectChange.data.before;
                    _e = createCustomObjectInstance;
                    _f = [{}];
                    return [4 /*yield*/, getNestedCustomObjectValues(fullName, changes, fieldsToSkip, 'before')];
                case 6:
                    _g = [__assign.apply(void 0, _f.concat([_l.sent()]))];
                    if (!(beforeParent === undefined)) return [3 /*break*/, 7];
                    _h = {};
                    return [3 /*break*/, 9];
                case 7: return [4 /*yield*/, transformer_1.toCustomProperties(beforeParent, false)];
                case 8:
                    _h = _l.sent();
                    _l.label = 9;
                case 9:
                    before = _e.apply(void 0, [__assign.apply(void 0, _g.concat([(_h)]))]);
                    return [2 /*return*/, { action: 'modify', data: { before: before, after: after } }];
            }
        });
    });
};
exports.createCustomObjectChange = createCustomObjectChange;
var getParentCustomObjectName = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var parent;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, awu(adapter_utils_1.getParents(adapter_api_1.getChangeData(change))).find(transformer_1.isCustomObject)];
            case 1:
                parent = _a.sent();
                return [2 /*return*/, parent === undefined ? undefined : transformer_1.apiName(parent)];
        }
    });
}); };
var isSideEffectRemoval = function (removedObjectNames) { return function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var parentName;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getParentCustomObjectName(change)];
            case 1:
                parentName = _a.sent();
                return [2 /*return*/, adapter_api_1.isInstanceChange(change)
                        && adapter_api_1.isRemovalChange(change)
                        && parentName !== undefined && removedObjectNames.includes(parentName)];
        }
    });
}); }; };
var typesToMergeFromInstance = function (elements) { return __awaiter(void 0, void 0, void 0, function () {
    var fixTypesDefinitions, getAllTypesFromInstance, typesFromInstance, nestedMetadataTypes, customOnlyAnnotationTypes, customSettingsOnlyAnnotationTypes, standardAnnotationTypes;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                fixTypesDefinitions = function (typesFromInstance) { return __awaiter(void 0, void 0, void 0, function () {
                    var listViewType, _a, _b, _c, _d, _e, _f, fieldSetType, _g, _h, _j, _k, _l, _m, compactLayoutType, _o, _p, _q;
                    return __generator(this, function (_r) {
                        switch (_r.label) {
                            case 0:
                                listViewType = typesFromInstance[exports.NESTED_INSTANCE_VALUE_NAME.LIST_VIEWS];
                                _a = listViewType.fields.columns;
                                _b = adapter_api_1.createRefToElmWithValue;
                                _c = adapter_api_1.ListType.bind;
                                return [4 /*yield*/, listViewType.fields.columns.getType()];
                            case 1:
                                _a.refType = _b.apply(void 0, [new (_c.apply(adapter_api_1.ListType, [void 0, _r.sent()]))()]);
                                _d = listViewType.fields.filters;
                                _e = adapter_api_1.createRefToElmWithValue;
                                _f = adapter_api_1.ListType.bind;
                                return [4 /*yield*/, listViewType.fields.filters.getType()];
                            case 2:
                                _d.refType = _e.apply(void 0, [new (_f.apply(adapter_api_1.ListType, [void 0, _r.sent()]))()]);
                                fieldSetType = typesFromInstance[exports.NESTED_INSTANCE_VALUE_NAME.FIELD_SETS];
                                _g = fieldSetType.fields.availableFields;
                                _h = adapter_api_1.createRefToElmWithValue;
                                _j = adapter_api_1.ListType.bind;
                                return [4 /*yield*/, fieldSetType.fields.availableFields.getType()];
                            case 3:
                                _g.refType = _h.apply(void 0, [new (_j.apply(adapter_api_1.ListType, [void 0, _r.sent()]))()]);
                                _k = fieldSetType.fields.displayedFields;
                                _l = adapter_api_1.createRefToElmWithValue;
                                _m = adapter_api_1.ListType.bind;
                                return [4 /*yield*/, fieldSetType.fields.displayedFields.getType()];
                            case 4:
                                _k.refType = _l.apply(void 0, [new (_m.apply(adapter_api_1.ListType, [void 0, _r.sent()]))()]);
                                compactLayoutType = typesFromInstance[exports.NESTED_INSTANCE_VALUE_NAME.COMPACT_LAYOUTS];
                                _o = compactLayoutType.fields.fields;
                                _p = adapter_api_1.createRefToElmWithValue;
                                _q = adapter_api_1.ListType.bind;
                                return [4 /*yield*/, compactLayoutType.fields.fields.getType()];
                            case 5:
                                _o.refType = _p.apply(void 0, [new (_q.apply(adapter_api_1.ListType, [void 0, _r.sent()]))()]);
                                // internalId is also the name of a field on the custom object instances, therefore
                                // we override it here to have the right type for the annotation.
                                // we don't want to use HIDDEN_STRING as the type for the field because on fields
                                // we can set annotations directly.
                                typesFromInstance[constants_1.INTERNAL_ID_ANNOTATION] = adapter_api_1.BuiltinTypes.HIDDEN_STRING;
                                return [2 /*return*/];
                        }
                    });
                }); };
                getAllTypesFromInstance = function () { return __awaiter(void 0, void 0, void 0, function () {
                    var customObjectType, typesFromInstance, _a, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                customObjectType = adapter_utils_1.findObjectType(elements, exports.CUSTOM_OBJECT_TYPE_ID);
                                if (lodash_1["default"].isUndefined(customObjectType)) {
                                    return [2 /*return*/, {}];
                                }
                                _b = (_a = Object).fromEntries;
                                return [4 /*yield*/, awu(Object.entries(customObjectType.fields))
                                        .filter(function (_a) {
                                        var name = _a[0], _field = _a[1];
                                        return !ANNOTATIONS_TO_IGNORE_FROM_INSTANCE.includes(name);
                                    })
                                        .map(function (_a) {
                                        var name = _a[0], field = _a[1];
                                        return __awaiter(void 0, void 0, void 0, function () { var _b; return __generator(this, function (_c) {
                                            switch (_c.label) {
                                                case 0:
                                                    _b = [name];
                                                    return [4 /*yield*/, field.getType()];
                                                case 1: return [2 /*return*/, _b.concat([_c.sent()])];
                                            }
                                        }); });
                                    })
                                        .toArray()];
                            case 1:
                                typesFromInstance = _b.apply(_a, [_c.sent()]);
                                return [4 /*yield*/, fixTypesDefinitions(typesFromInstance)];
                            case 2:
                                _c.sent();
                                return [2 /*return*/, typesFromInstance];
                        }
                    });
                }); };
                return [4 /*yield*/, getAllTypesFromInstance()];
            case 1:
                typesFromInstance = _a.sent();
                nestedMetadataTypes = lodash_1["default"].pick(typesFromInstance, Object.keys(exports.NESTED_INSTANCE_VALUE_TO_TYPE_NAME));
                customOnlyAnnotationTypes = lodash_1["default"].pick(typesFromInstance, CUSTOM_ONLY_ANNOTATION_TYPE_NAMES);
                customSettingsOnlyAnnotationTypes = lodash_1["default"].pick(typesFromInstance, CUSTOM_SETTINGS_ONLY_ANNOTATION_TYPE_NAMES);
                standardAnnotationTypes = lodash_1["default"].omit(typesFromInstance, Object.keys(exports.NESTED_INSTANCE_VALUE_TO_TYPE_NAME), CUSTOM_ONLY_ANNOTATION_TYPE_NAMES);
                return [2 /*return*/, {
                        standardAnnotationTypes: standardAnnotationTypes,
                        customAnnotationTypes: __assign(__assign({}, standardAnnotationTypes), customOnlyAnnotationTypes),
                        customSettingsAnnotationTypes: __assign(__assign({}, standardAnnotationTypes), customSettingsOnlyAnnotationTypes),
                        nestedMetadataTypes: nestedMetadataTypes,
                    }];
        }
    });
}); };
var removeDuplicateElements = function (elements) {
    var ids = new Set();
    return elements.filter(function (elem) {
        var elemID = elem.elemID.getFullName();
        if (ids.has(elemID)) {
            log.warn('Removing duplicate element ID %s', elemID);
            return false;
        }
        ids.add(elemID);
        return true;
    });
};
/**
 * Convert custom object instance elements into object types
 */
var filterCreator = function (_a) {
    var config = _a.config;
    var originalChanges = {};
    return {
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var typesFromInstance, existingElementIDs, fieldsToSkip, customObjectInstances, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        log.debug('Replacing custom object instances with object types');
                        return [4 /*yield*/, typesToMergeFromInstance(elements)];
                    case 1:
                        typesFromInstance = _b.sent();
                        existingElementIDs = new Set(elements.map(function (elem) { return elem.elemID.getFullName(); }));
                        fieldsToSkip = config.unsupportedSystemFields;
                        _a = removeDuplicateElements;
                        return [4 /*yield*/, awu(elements)
                                .filter(adapter_api_1.isInstanceElement)
                                .filter(utils_1.isInstanceOfType(constants_1.CUSTOM_OBJECT))
                                .toArray()];
                    case 2:
                        customObjectInstances = _a.apply(void 0, [_b.sent()]);
                        return [4 /*yield*/, awu(customObjectInstances)
                                .flatMap(function (instance) { return createFromInstance(instance, typesFromInstance, fieldsToSkip); })
                                // Make sure we do not override existing metadata types with custom objects
                                // this can happen with standard objects having the same name as a metadata type
                                .filter(function (elem) { return !existingElementIDs.has(elem.elemID.getFullName()); })
                                .forEach(function (newElem) { return elements.push(newElem); })];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, removeIrrelevantElements(elements)];
                    case 4:
                        _b.sent();
                        log.debug('Changing paths for instances that are nested under custom objects');
                        return [4 /*yield*/, fixDependentInstancesPathAndSetParent(elements, utils_1.buildElementsSourceForFetch(elements, config))];
                    case 5:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var originalChangeMapping, deployableCustomObjectChanges, removedCustomObjectNames, sideEffectRemovalsByObject, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, groupByAsync(awu(changes).filter(isCustomObjectRelatedChange), getCustomObjectApiName)];
                    case 1:
                        originalChangeMapping = _b.sent();
                        return [4 /*yield*/, awu(Object.entries(originalChangeMapping))
                                .map(function (entry) { return exports.createCustomObjectChange.apply(void 0, __spreadArrays([config.systemFields], entry)); })
                                .toArray()
                            // Handle known side effects - if we remove a custom object we don't need to also remove
                            // its dependent instances (like layouts, custom object translations and so on)
                        ];
                    case 2:
                        deployableCustomObjectChanges = _b.sent();
                        removedCustomObjectNames = Object.keys(originalChangeMapping)
                            .filter(function (name) { return originalChangeMapping[name].filter(adapter_api_1.isObjectTypeChange).some(adapter_api_1.isRemovalChange); });
                        _a = groupByAsync;
                        return [4 /*yield*/, awu(changes)
                                .filter(isSideEffectRemoval(removedCustomObjectNames))
                                .toArray()];
                    case 3: return [4 /*yield*/, _a.apply(void 0, [_b.sent(),
                            function (c) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, getParentCustomObjectName(c)];
                                    case 1: return [2 /*return*/, (_a = _b.sent()) !== null && _a !== void 0 ? _a : ''];
                                }
                            }); }); }])];
                    case 4:
                        sideEffectRemovalsByObject = _b.sent();
                        if (!!lodash_1["default"].isEmpty(sideEffectRemovalsByObject)) return [3 /*break*/, 6];
                        // Store the changes we are about to remove in the original changes so we will restore
                        // them if the custom object is deleted successfully
                        Object.entries(sideEffectRemovalsByObject).forEach(function (_a) {
                            var _b;
                            var objectName = _a[0], sideEffects = _a[1];
                            (_b = originalChangeMapping[objectName]).push.apply(_b, sideEffects);
                        });
                        return [4 /*yield*/, removeAsync(changes, isSideEffectRemoval(removedCustomObjectNames))];
                    case 5:
                        _b.sent();
                        _b.label = 6;
                    case 6:
                        // Remove all the non-deployable custom object changes from the original list and replace them
                        // with the deployable changes we created here
                        originalChanges = originalChangeMapping;
                        return [4 /*yield*/, removeAsync(changes, isCustomObjectRelatedChange)];
                    case 7:
                        _b.sent();
                        changes.push.apply(changes, deployableCustomObjectChanges);
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var appliedCustomObjectApiNames, appliedOriginalChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(utils_1.isInstanceOfTypeChange(constants_1.CUSTOM_OBJECT))
                            .map(function (change) { return transformer_1.apiName(adapter_api_1.getChangeData(change)); })
                            .toArray()];
                    case 1:
                        appliedCustomObjectApiNames = _a.sent();
                        appliedOriginalChanges = appliedCustomObjectApiNames.flatMap(function (objectApiName) { var _a; return (_a = originalChanges[objectApiName]) !== null && _a !== void 0 ? _a : []; });
                        // Remove the changes we generated in preDeploy and replace them with the original changes
                        return [4 /*yield*/, removeAsync(changes, utils_1.isInstanceOfTypeChange(constants_1.CUSTOM_OBJECT))];
                    case 2:
                        // Remove the changes we generated in preDeploy and replace them with the original changes
                        _a.sent();
                        changes.push.apply(changes, appliedOriginalChanges);
                        return [2 /*return*/];
                }
            });
        }); },
    };
};
exports["default"] = filterCreator;
