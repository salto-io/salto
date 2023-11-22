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
var _a;
exports.__esModule = true;
exports.ensureSafeFilterFetch = exports.getDataFromChanges = exports.buildElementsSourceForFetch = exports.queryClient = exports.buildSelectQueries = exports.getFieldNamesForQuery = exports.conditionQueries = exports.getWhereConditions = exports.extractFlatCustomObjectFields = exports.hasApiName = exports.hasInternalId = exports.setInternalId = exports.getInternalId = exports.getFullName = exports.fullApiName = exports.addElementParentReference = exports.parentApiName = exports.apiNameParts = exports.namePartsFromApiName = exports.buildAnnotationsObjectType = exports.extractFullNamesFromValueList = exports.getNamespace = exports.layoutObjAndName = exports.removeCustomSuffix = exports.addDefaults = exports.addMetadataType = exports.addApiName = exports.addKeyPrefix = exports.addPluralLabel = exports.addLabel = exports.getInstancesOfMetadataType = exports.referenceFieldTargetTypes = exports.isReferenceField = exports.isHierarchyField = exports.isReadOnlyField = exports.isHiddenField = exports.isQueryableField = exports.isLookupField = exports.isMasterDetailField = exports.boolValue = exports.isCustomMetadataRecordInstance = exports.isCustomMetadataRecordType = exports.isMetadataInstanceElementSync = exports.apiNameSync = exports.isCustomObjectSync = exports.metadataTypeSync = exports.safeApiName = exports.isInstanceOfTypeChange = exports.isInstanceOfType = exports.isMetadataValues = void 0;
exports.getMostRecentFileProperties = exports.hasValueSetNameAnnotation = exports.isValueSetReference = exports.isPicklistField = exports.getNamespaceSync = exports.getElementAuthorInformation = exports.getAuthorInformationFromFileProps = exports.isElementWithResolvedParent = exports.isDeactivatedFlowChangeOnly = exports.isDeactivatedFlowChange = exports.isInstanceOfTypeChangeSync = exports.isInstanceOfTypeSync = exports.toListType = exports.listMetadataObjects = exports.isCustomType = exports.getChangedAtSingletonInstance = exports.getInstanceAlias = exports.isStandardObject = void 0;
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
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var joi_1 = require("joi");
var types_1 = require("../types");
var constants_1 = require("../constants");
var transformer = require("../transformers/transformer");
var transformer_1 = require("../transformers/transformer");
var config_change_1 = require("../config_change");
var _b = lowerdash_1.collections.asynciterable, toArrayAsync = _b.toArrayAsync, awu = _b.awu;
var splitDuplicates = lowerdash_1.collections.array.splitDuplicates;
var makeArray = lowerdash_1.collections.array.makeArray;
var weightedChunks = lowerdash_1.chunks.weightedChunks;
var isDefined = lowerdash_1.values.isDefined;
var log = logging_1.logger(module);
var METADATA_VALUES_SCHEME = joi_1["default"].object((_a = {},
    _a[constants_1.INSTANCE_FULL_NAME_FIELD] = joi_1["default"].string().required(),
    _a)).unknown(true);
exports.isMetadataValues = adapter_utils_1.createSchemeGuard(METADATA_VALUES_SCHEME);
/**
 * @deprecated use {@link isInstanceOfTypeSync} instead.
 */
var isInstanceOfType = function () {
    var typeNames = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        typeNames[_i] = arguments[_i];
    }
    return (function (elem) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _a = adapter_api_1.isInstanceElement(elem);
                    if (!_a) return [3 /*break*/, 3];
                    _c = (_b = typeNames).includes;
                    _d = transformer_1.apiName;
                    return [4 /*yield*/, elem.getType()];
                case 1: return [4 /*yield*/, _d.apply(void 0, [_e.sent()])];
                case 2:
                    _a = _c.apply(_b, [_e.sent()]);
                    _e.label = 3;
                case 3: return [2 /*return*/, (_a)];
            }
        });
    }); });
};
exports.isInstanceOfType = isInstanceOfType;
/**
 * @deprecated use {@link isInstanceOfTypeChangeSync} instead.
 */
var isInstanceOfTypeChange = function () {
    var typeNames = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        typeNames[_i] = arguments[_i];
    }
    return (function (change) { return (exports.isInstanceOfType.apply(void 0, typeNames)(adapter_api_1.getChangeData(change))); });
};
exports.isInstanceOfTypeChange = isInstanceOfTypeChange;
var safeApiName = function (elem, relative) {
    if (relative === void 0) { relative = false; }
    return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (transformer_1.apiName(elem, relative))];
        });
    });
};
exports.safeApiName = safeApiName;
var metadataTypeSync = function (element) {
    if (adapter_api_1.isInstanceElement(element)) {
        return exports.metadataTypeSync(element.getTypeSync());
    }
    if (adapter_api_1.isField(element)) {
        // We expect to reach to this place only with field of CustomObject
        return constants_1.CUSTOM_FIELD;
    }
    return element.annotations[constants_1.METADATA_TYPE] || 'unknown';
};
exports.metadataTypeSync = metadataTypeSync;
var isCustomObjectSync = function (element) {
    var res = adapter_api_1.isObjectType(element)
        && exports.metadataTypeSync(element) === constants_1.CUSTOM_OBJECT
        // The last part is so we can tell the difference between a custom object
        // and the original "CustomObject" type from salesforce (the latter will not have an API_NAME)
        && element.annotations[constants_1.API_NAME] !== undefined;
    return res;
};
exports.isCustomObjectSync = isCustomObjectSync;
var fullApiNameSync = function (elem) {
    var _a;
    if (adapter_api_1.isInstanceElement(elem)) {
        return (exports.isCustomObjectSync(elem.getTypeSync()))
            ? elem.value[constants_1.CUSTOM_OBJECT_ID_FIELD] : elem.value[constants_1.INSTANCE_FULL_NAME_FIELD];
    }
    return (_a = elem.annotations[constants_1.API_NAME]) !== null && _a !== void 0 ? _a : elem.annotations[constants_1.METADATA_TYPE];
};
var apiNameSync = function (elem, relative) {
    if (relative === void 0) { relative = false; }
    var name = fullApiNameSync(elem);
    return name && relative ? transformer.relativeApiName(name) : name;
};
exports.apiNameSync = apiNameSync;
var isMetadataInstanceElementSync = function (elem) { return (adapter_api_1.isInstanceElement(elem)
    && transformer_1.isMetadataObjectType(elem.getTypeSync())
    && elem.value[constants_1.INSTANCE_FULL_NAME_FIELD] !== undefined); };
exports.isMetadataInstanceElementSync = isMetadataInstanceElementSync;
var isCustomMetadataRecordType = function (elem) { return __awaiter(void 0, void 0, void 0, function () {
    var elementApiName;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, transformer_1.apiName(elem)];
            case 1:
                elementApiName = _b.sent();
                return [2 /*return*/, adapter_api_1.isObjectType(elem) && ((_a = elementApiName === null || elementApiName === void 0 ? void 0 : elementApiName.endsWith(constants_1.CUSTOM_METADATA_SUFFIX)) !== null && _a !== void 0 ? _a : false)];
        }
    });
}); };
exports.isCustomMetadataRecordType = isCustomMetadataRecordType;
var isCustomMetadataRecordInstance = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceType;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, instance.getType()];
            case 1:
                instanceType = _a.sent();
                return [2 /*return*/, exports.isCustomMetadataRecordType(instanceType)];
        }
    });
}); };
exports.isCustomMetadataRecordInstance = isCustomMetadataRecordInstance;
var boolValue = function (val) { return val === 'true' || val === true; };
exports.boolValue = boolValue;
var isMasterDetailField = function (field) { return (field.refType.elemID.isEqual(transformer_1.Types.primitiveDataTypes.MasterDetail.elemID)); };
exports.isMasterDetailField = isMasterDetailField;
var isLookupField = function (field) { return (field.refType.elemID.isEqual(transformer_1.Types.primitiveDataTypes.Lookup.elemID)); };
exports.isLookupField = isLookupField;
var isQueryableField = function (field) { return (field.annotations[constants_1.FIELD_ANNOTATIONS.QUERYABLE] === true); };
exports.isQueryableField = isQueryableField;
var isHiddenField = function (field) { return (field.annotations[adapter_api_1.CORE_ANNOTATIONS.HIDDEN_VALUE] === true); };
exports.isHiddenField = isHiddenField;
var isReadOnlyField = function (field) { return (field.annotations[constants_1.FIELD_ANNOTATIONS.CREATABLE] === false && field.annotations[constants_1.FIELD_ANNOTATIONS.UPDATEABLE] === false); };
exports.isReadOnlyField = isReadOnlyField;
var isHierarchyField = function (field) { return (field.refType.elemID.isEqual(transformer_1.Types.primitiveDataTypes.Hierarchy.elemID)); };
exports.isHierarchyField = isHierarchyField;
var isReferenceField = function (field) { return ((field !== undefined) && (exports.isLookupField(field) || exports.isMasterDetailField(field) || exports.isHierarchyField(field))); };
exports.isReferenceField = isReferenceField;
var referenceFieldTargetTypes = function (field) {
    var _a;
    if (exports.isLookupField(field) || exports.isMasterDetailField(field)) {
        var referredTypes = (_a = field.annotations) === null || _a === void 0 ? void 0 : _a[constants_1.FIELD_ANNOTATIONS.REFERENCE_TO];
        if (referredTypes === undefined) {
            return [];
        }
        return makeArray(referredTypes)
            .map(function (ref) { return (lodash_1["default"].isString(ref) ? ref : exports.apiNameSync(ref.value)); })
            .filter(isDefined);
    }
    if (exports.isHierarchyField(field)) {
        // hierarchy fields always reference the type that contains them
        return makeArray(exports.apiNameSync(field.parent));
    }
    log.warn('Unknown reference field type %s for field %s', field.refType.elemID.getFullName(), field.elemID.getFullName());
    return [];
};
exports.referenceFieldTargetTypes = referenceFieldTargetTypes;
var getInstancesOfMetadataType = function (elements, metadataTypeName) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, awu(elements).filter(adapter_api_1.isInstanceElement)
                .filter(function (element) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, transformer_1.metadataType(element)];
                    case 1: return [2 /*return*/, (_a.sent()) === metadataTypeName];
                }
            }); }); })
                .toArray()];
    });
}); };
exports.getInstancesOfMetadataType = getInstancesOfMetadataType;
var setAnnotationDefault = function (elem, key, defaultValue, type) {
    if (elem.annotations[key] === undefined) {
        log.trace('setting default value on %s: %s=%s', elem.elemID.getFullName(), key, defaultValue);
        elem.annotations[key] = defaultValue;
    }
    if (elem.annotationRefTypes[key] === undefined) {
        log.trace('adding annotation type %s on %s', key, elem.elemID.getFullName());
        elem.annotationRefTypes[key] = adapter_api_1.createRefToElmWithValue(type);
    }
};
var addLabel = function (elem, label) {
    var name = elem.elemID.name;
    setAnnotationDefault(elem, constants_1.LABEL, label !== null && label !== void 0 ? label : name, adapter_api_1.BuiltinTypes.STRING);
};
exports.addLabel = addLabel;
var addPluralLabel = function (elem, pluralLabel) {
    setAnnotationDefault(elem, constants_1.PLURAL_LABEL, pluralLabel, adapter_api_1.BuiltinTypes.STRING);
};
exports.addPluralLabel = addPluralLabel;
var addKeyPrefix = function (elem, keyPrefix) {
    setAnnotationDefault(elem, constants_1.KEY_PREFIX, keyPrefix, adapter_api_1.BuiltinTypes.HIDDEN_STRING);
};
exports.addKeyPrefix = addKeyPrefix;
var addApiName = function (elem, name, parentName) {
    if (!elem.annotations[constants_1.API_NAME]) {
        var newApiName = name !== null && name !== void 0 ? name : transformer_1.defaultApiName(elem);
        var fullApiName_1 = parentName ? [parentName, newApiName].join(constants_1.API_NAME_SEPARATOR) : newApiName;
        elem.annotations[constants_1.API_NAME] = fullApiName_1;
        log.trace("added API_NAME=" + fullApiName_1 + " to " + elem.elemID.name);
    }
    if (!adapter_api_1.isField(elem) && !elem.annotationRefTypes[constants_1.API_NAME]) {
        elem.annotationRefTypes[constants_1.API_NAME] = adapter_api_1.createRefToElmWithValue(adapter_api_1.BuiltinTypes.SERVICE_ID);
    }
};
exports.addApiName = addApiName;
var addMetadataType = function (elem, metadataTypeValue) {
    if (metadataTypeValue === void 0) { metadataTypeValue = constants_1.CUSTOM_OBJECT; }
    setAnnotationDefault(elem, constants_1.METADATA_TYPE, metadataTypeValue, adapter_api_1.BuiltinTypes.SERVICE_ID);
};
exports.addMetadataType = addMetadataType;
var addDefaults = function (element) { return __awaiter(void 0, void 0, void 0, function () {
    var addInstanceDefaults, addFieldDefaults, addCustomObjectDefaults;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                addInstanceDefaults = function (inst) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _a = inst.value[constants_1.INSTANCE_FULL_NAME_FIELD] === undefined;
                                if (!_a) return [3 /*break*/, 3];
                                _b = transformer_1.isCustomObject;
                                return [4 /*yield*/, inst.getType()];
                            case 1: return [4 /*yield*/, _b.apply(void 0, [_c.sent()])];
                            case 2:
                                _a = !(_c.sent());
                                _c.label = 3;
                            case 3:
                                if (_a) {
                                    inst.value[constants_1.INSTANCE_FULL_NAME_FIELD] = transformer_1.defaultApiName(inst);
                                }
                                return [2 /*return*/];
                        }
                    });
                }); };
                addFieldDefaults = function (field) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _a = exports.addApiName;
                                _b = [field, undefined];
                                return [4 /*yield*/, transformer_1.apiName(field.parent)];
                            case 1:
                                _a.apply(void 0, _b.concat([_c.sent()]));
                                exports.addLabel(field);
                                return [2 /*return*/];
                        }
                    });
                }); };
                addCustomObjectDefaults = function (elem) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                exports.addApiName(elem);
                                exports.addMetadataType(elem);
                                exports.addLabel(elem);
                                return [4 /*yield*/, awu(Object.values(elem.fields)).forEach(addFieldDefaults)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); };
                if (!adapter_api_1.isInstanceElement(element)) return [3 /*break*/, 2];
                return [4 /*yield*/, addInstanceDefaults(element)];
            case 1:
                _a.sent();
                return [3 /*break*/, 6];
            case 2:
                if (!adapter_api_1.isObjectType(element)) return [3 /*break*/, 4];
                return [4 /*yield*/, addCustomObjectDefaults(element)];
            case 3:
                _a.sent();
                return [3 /*break*/, 6];
            case 4:
                if (!adapter_api_1.isField(element)) return [3 /*break*/, 6];
                return [4 /*yield*/, addFieldDefaults(element)];
            case 5:
                _a.sent();
                _a.label = 6;
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.addDefaults = addDefaults;
var ENDS_WITH_CUSTOM_SUFFIX_REGEX = new RegExp("__(" + types_1.INSTANCE_SUFFIXES.join('|') + ")$");
var removeCustomSuffix = function (elementApiName) { return (elementApiName.replace(ENDS_WITH_CUSTOM_SUFFIX_REGEX, '')); };
exports.removeCustomSuffix = removeCustomSuffix;
var getNamespaceFromString = function (relativeApiName) {
    var parts = exports.removeCustomSuffix(relativeApiName)
        .split(constants_1.NAMESPACE_SEPARATOR);
    return parts.length !== 1
        ? parts[0]
        : undefined;
};
var specialLayoutObjects = new Map([
    ['CaseClose', 'Case'],
    ['UserAlt', 'User'],
]);
// Layout full name starts with related sobject and then '-'
var layoutObjAndName = function (layoutApiName) {
    var _a;
    var _b = layoutApiName.split('-'), obj = _b[0], name = _b.slice(1);
    return [(_a = specialLayoutObjects.get(obj)) !== null && _a !== void 0 ? _a : obj, name.join('-')];
};
exports.layoutObjAndName = layoutObjAndName;
/**
 * @deprecated use {@link getNamespaceSync} instead.
 */
var getNamespace = function (element) { return __awaiter(void 0, void 0, void 0, function () {
    var elementApiName, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, exports.safeApiName(element, true)];
            case 1:
                elementApiName = _b.sent();
                if (elementApiName === undefined) {
                    return [2 /*return*/, undefined];
                }
                _a = adapter_api_1.isInstanceElement(element);
                if (!_a) return [3 /*break*/, 3];
                return [4 /*yield*/, exports.isInstanceOfType(constants_1.LAYOUT_TYPE_ID_METADATA_TYPE)(element)];
            case 2:
                _a = (_b.sent());
                _b.label = 3;
            case 3: return [2 /*return*/, _a ? getNamespaceFromString(exports.layoutObjAndName(elementApiName)[1])
                    : getNamespaceFromString(elementApiName)];
        }
    });
}); };
exports.getNamespace = getNamespace;
var extractFullNamesFromValueList = function (instanceValues) {
    return instanceValues.map(function (v) { return v[constants_1.INSTANCE_FULL_NAME_FIELD]; });
};
exports.extractFullNamesFromValueList = extractFullNamesFromValueList;
var buildAnnotationsObjectType = function (annotationTypes) {
    var annotationTypesElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, 'AnnotationType');
    return new adapter_api_1.ObjectType({ elemID: annotationTypesElemID, fields: Object.assign.apply(Object, __spreadArrays([{}], Object.entries(annotationTypes)
            .concat(Object.entries(adapter_api_1.CoreAnnotationTypes))
            .map(function (_a) {
            var _b;
            var name = _a[0], type = _a[1];
            return (_b = {}, _b[name] = { refType: adapter_api_1.createRefToElmWithValue(type) }, _b);
        }))) });
};
exports.buildAnnotationsObjectType = buildAnnotationsObjectType;
var namePartsFromApiName = function (elementApiName) { return (elementApiName.split(/\.|-/g)); };
exports.namePartsFromApiName = namePartsFromApiName;
var apiNameParts = function (elem) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
    switch (_b.label) {
        case 0:
            _a = exports.namePartsFromApiName;
            return [4 /*yield*/, transformer_1.apiName(elem)];
        case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
    }
}); }); };
exports.apiNameParts = apiNameParts;
var parentApiName = function (elem) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    switch (_a.label) {
        case 0: return [4 /*yield*/, exports.apiNameParts(elem)];
        case 1: return [2 /*return*/, (_a.sent())[0]];
    }
}); }); };
exports.parentApiName = parentApiName;
var addElementParentReference = function (instance, element) {
    var elemID = element.elemID;
    var instanceDeps = adapter_utils_1.getParents(instance);
    if (instanceDeps.filter(adapter_api_1.isReferenceExpression).some(function (ref) { return ref.elemID.isEqual(elemID); })) {
        return;
    }
    instanceDeps.push(new adapter_api_1.ReferenceExpression(elemID, element));
    instance.annotations[adapter_api_1.CORE_ANNOTATIONS.PARENT] = instanceDeps;
};
exports.addElementParentReference = addElementParentReference;
var fullApiName = function (parent, child) {
    return ([parent, child].join(constants_1.API_NAME_SEPARATOR));
};
exports.fullApiName = fullApiName;
var getFullName = function (obj) {
    var namePrefix = obj.namespacePrefix
        ? "" + obj.namespacePrefix + constants_1.NAMESPACE_SEPARATOR : '';
    return obj.fullName.startsWith(namePrefix) ? obj.fullName : "" + namePrefix + obj.fullName;
};
exports.getFullName = getFullName;
var getInternalId = function (elem) { return ((adapter_api_1.isInstanceElement(elem))
    ? elem.value[constants_1.INTERNAL_ID_FIELD]
    : elem.annotations[constants_1.INTERNAL_ID_ANNOTATION]); };
exports.getInternalId = getInternalId;
var setInternalId = function (elem, val) {
    if (adapter_api_1.isInstanceElement(elem)) {
        elem.value[constants_1.INTERNAL_ID_FIELD] = val;
    }
    else {
        elem.annotations[constants_1.INTERNAL_ID_ANNOTATION] = val;
        // no need to set the annotation type - already defined
    }
};
exports.setInternalId = setInternalId;
var hasInternalId = function (elem) { return (exports.getInternalId(elem) !== undefined && exports.getInternalId(elem) !== ''); };
exports.hasInternalId = hasInternalId;
var hasApiName = function (elem) { return (transformer_1.apiName(elem) !== undefined); };
exports.hasApiName = hasApiName;
var extractFlatCustomObjectFields = function (elem) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, transformer_1.isCustomObject(elem)];
            case 1: return [2 /*return*/, ((_a.sent()) && adapter_api_1.isObjectType(elem)
                    ? __spreadArrays([elem], Object.values(elem.fields)) : [elem])];
        }
    });
}); };
exports.extractFlatCustomObjectFields = extractFlatCustomObjectFields;
var getWhereConditions = function (conditionSets, maxLen) {
    var keys = lodash_1["default"].uniq(conditionSets.flatMap(Object.keys));
    var constConditionPartLen = (lodash_1["default"].sumBy(keys, function (key) { return (key + " IN ()").length; })
        + (' AND '.length * (keys.length - 1)));
    var conditionChunks = weightedChunks(conditionSets, maxLen - constConditionPartLen, 
    // Note - this calculates the condition length as if all values are added to the query.
    // the actual query might end up being shorter if some of the values are not unique.
    // this can be optimized in the future if needed
    function (condition) { return lodash_1["default"].sumBy(Object.values(condition), function (val) { return (val + ",").length; }); });
    var r = conditionChunks.map(function (conditionChunk) {
        var conditionsByKey = lodash_1["default"].groupBy(conditionChunk.flatMap(Object.entries), function (_a) {
            var keyName = _a[0];
            return keyName;
        });
        return Object.entries(conditionsByKey)
            .map(function (_a) {
            var keyName = _a[0], conditionValues = _a[1];
            return (keyName + " IN (" + lodash_1["default"].uniq(conditionValues.map(function (val) { return val[1]; })).join(',') + ")");
        })
            .join(' AND ');
    });
    return r;
};
exports.getWhereConditions = getWhereConditions;
var conditionQueries = function (query, conditionSets, maxQueryLen) {
    if (maxQueryLen === void 0) { maxQueryLen = constants_1.MAX_QUERY_LENGTH; }
    var selectWhereStr = query + " WHERE ";
    var whereConditions = exports.getWhereConditions(conditionSets, maxQueryLen - selectWhereStr.length);
    return whereConditions.map(function (whereCondition) { return "" + selectWhereStr + whereCondition; });
};
exports.conditionQueries = conditionQueries;
var getFieldNamesForQuery = function (field) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, transformer_1.isNameField(field)];
            case 1:
                if (!(_d.sent())) return [3 /*break*/, 3];
                _c = (_b = Object).keys;
                return [4 /*yield*/, field.getType()];
            case 2:
                _a = _c.apply(_b, [(_d.sent()).fields]);
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, transformer_1.apiName(field, true)];
            case 4:
                _a = [_d.sent()];
                _d.label = 5;
            case 5: return [2 /*return*/, (_a)
                /**
                 * Build a set of queries that select records.
                 *
                 * @param typeName The name of the table to query from
                 * @param fields The names of the fields to query
                 * @param conditionSets Each entry specifies field values used to match a specific record
                 * @param maxQueryLen returned queries will be split such that no single query exceeds this length
                 */
            ];
        }
    });
}); };
exports.getFieldNamesForQuery = getFieldNamesForQuery;
/**
 * Build a set of queries that select records.
 *
 * @param typeName The name of the table to query from
 * @param fields The names of the fields to query
 * @param conditionSets Each entry specifies field values used to match a specific record
 * @param maxQueryLen returned queries will be split such that no single query exceeds this length
 */
var buildSelectQueries = function (typeName, fields, conditionSets, maxQueryLen) {
    if (maxQueryLen === void 0) { maxQueryLen = constants_1.MAX_QUERY_LENGTH; }
    return __awaiter(void 0, void 0, void 0, function () {
        var fieldsNameQuery, selectStr;
        return __generator(this, function (_a) {
            fieldsNameQuery = fields.join(',');
            selectStr = "SELECT " + fieldsNameQuery + " FROM " + typeName;
            if (conditionSets === undefined || conditionSets.length === 0) {
                return [2 /*return*/, [selectStr]];
            }
            return [2 /*return*/, exports.conditionQueries(selectStr, conditionSets, maxQueryLen)];
        });
    });
};
exports.buildSelectQueries = buildSelectQueries;
var queryClient = function (client, queries) { return __awaiter(void 0, void 0, void 0, function () {
    var recordsIterables, records;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, Promise.all(queries.map(function (query) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, client.queryAll(query)];
                }); }); }))];
            case 1:
                recordsIterables = _a.sent();
                return [4 /*yield*/, Promise.all(recordsIterables.map(function (recordsIterable) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, toArrayAsync(recordsIterable)];
                            case 1: return [2 /*return*/, (_a.sent()).flat()];
                        }
                    }); }); }))];
            case 2:
                records = (_a.sent()).flat();
                return [2 /*return*/, records];
        }
    });
}); };
exports.queryClient = queryClient;
var buildElementsSourceForFetch = function (elements, config) { return (adapter_utils_1.buildElementsSourceFromElements(elements, config.fetchProfile.metadataQuery.isPartialFetch() ? [config.elementsSource] : [])); };
exports.buildElementsSourceForFetch = buildElementsSourceForFetch;
var getDataFromChanges = function (dataField, changes) { return (changes
    .filter(dataField === 'after' ? adapter_api_1.isAdditionOrModificationChange : adapter_api_1.isRemovalOrModificationChange)
    .map(function (change) { return lodash_1["default"].get(change.data, dataField); })); };
exports.getDataFromChanges = getDataFromChanges;
var ensureSafeFilterFetch = function (_a) {
    var fetchFilterFunc = _a.fetchFilterFunc, warningMessage = _a.warningMessage, config = _a.config, filterName = _a.filterName;
    return function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!config.fetchProfile.isFeatureEnabled(filterName)) {
                        log.debug('skipping %s filter due to configuration', filterName);
                        return [2 /*return*/, undefined];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fetchFilterFunc(elements)];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    e_1 = _a.sent();
                    log.warn('failed to run filter %s (warning \'%s\') with error %o, stack %o', filterName, warningMessage, e_1, e_1.stack);
                    return [2 /*return*/, {
                            errors: [
                                ({
                                    message: warningMessage,
                                    severity: 'Warning',
                                }),
                            ],
                        }];
                case 4: return [2 /*return*/];
            }
        });
    }); };
};
exports.ensureSafeFilterFetch = ensureSafeFilterFetch;
var isStandardObject = function (objectType) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, transformer_1.isCustomObject(objectType)];
            case 1:
                _a = (_e.sent());
                if (!_a) return [3 /*break*/, 3];
                _c = (_b = ENDS_WITH_CUSTOM_SUFFIX_REGEX).test;
                return [4 /*yield*/, exports.safeApiName(objectType)];
            case 2:
                _a = !_c.apply(_b, [(_d = _e.sent()) !== null && _d !== void 0 ? _d : '']);
                _e.label = 3;
            case 3: return [2 /*return*/, (_a)];
        }
    });
}); };
exports.isStandardObject = isStandardObject;
var getInstanceAlias = function (instance, useLabelAsAlias) { return __awaiter(void 0, void 0, void 0, function () {
    var label, namespace;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                label = instance.value[constants_1.LABEL];
                if (!useLabelAsAlias || label === undefined) {
                    return [2 /*return*/, instance.value[constants_1.INSTANCE_FULL_NAME_FIELD]];
                }
                return [4 /*yield*/, exports.getNamespace(instance)];
            case 1:
                namespace = _a.sent();
                return [2 /*return*/, namespace === undefined
                        ? label
                        : label + " (" + namespace + ")"];
        }
    });
}); };
exports.getInstanceAlias = getInstanceAlias;
var getChangedAtSingletonInstance = function (elementsSource) { return __awaiter(void 0, void 0, void 0, function () {
    var element;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, elementsSource.get(new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.CHANGED_AT_SINGLETON, 'instance', adapter_api_1.ElemID.CONFIG_NAME))];
            case 1:
                element = _a.sent();
                return [2 /*return*/, adapter_api_1.isInstanceElement(element) ? element : undefined];
        }
    });
}); };
exports.getChangedAtSingletonInstance = getChangedAtSingletonInstance;
var isCustomType = function (element) {
    var _a;
    return (adapter_api_1.isObjectType(element) && ENDS_WITH_CUSTOM_SUFFIX_REGEX.test((_a = exports.apiNameSync(element)) !== null && _a !== void 0 ? _a : ''));
};
exports.isCustomType = isCustomType;
var removeDuplicateFileProps = function (files) {
    var _a = splitDuplicates(files, function (fileProps) { return fileProps.namespacePrefix + "__" + fileProps.fullName; }), duplicates = _a.duplicates, uniques = _a.uniques;
    duplicates.forEach(function (props) {
        log.debug('Found duplicate file props with the same name in response to listMetadataObjects: %o', props);
    });
    return uniques.concat(duplicates.map(function (props) { return props[0]; }));
};
var listMetadataObjects = function (client, metadataTypeName, isUnhandledError) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, result, errors, elements;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, client.listMetadataObjects({ type: metadataTypeName }, isUnhandledError)
                // Salesforce quirk, we sometimes get the same metadata fullName more than once
            ];
            case 1:
                _a = _b.sent(), result = _a.result, errors = _a.errors;
                elements = removeDuplicateFileProps(result);
                return [2 /*return*/, {
                        elements: elements,
                        configChanges: errors
                            .map(function (e) { return e.input; })
                            .map(config_change_1.createListMetadataObjectsConfigChange),
                    }];
        }
    });
}); };
exports.listMetadataObjects = listMetadataObjects;
var toListType = function (type) { return (adapter_api_1.isListType(type) ? type : new adapter_api_1.ListType(type)); };
exports.toListType = toListType;
// This function checks whether an element is an instance of a certain metadata type
// note that for instances of custom objects this will check the specific type (i.e Lead)
// if you want instances of all custom objects use isInstanceOfCustomObject
var isInstanceOfTypeSync = function () {
    var typeNames = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        typeNames[_i] = arguments[_i];
    }
    return (function (elem) {
        var _a;
        return (adapter_api_1.isInstanceElement(elem) && typeNames.includes((_a = exports.apiNameSync(elem.getTypeSync())) !== null && _a !== void 0 ? _a : ''));
    });
};
exports.isInstanceOfTypeSync = isInstanceOfTypeSync;
var isInstanceOfTypeChangeSync = function () {
    var typeNames = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        typeNames[_i] = arguments[_i];
    }
    return (function (change) { return (exports.isInstanceOfTypeSync.apply(void 0, typeNames)(adapter_api_1.getChangeData(change))); });
};
exports.isInstanceOfTypeChangeSync = isInstanceOfTypeChangeSync;
var isDeactivatedFlowChange = function (change) { return (adapter_api_1.isModificationChange(change)
    && exports.isInstanceOfTypeChangeSync(constants_1.FLOW_METADATA_TYPE)(change)
    && change.data.before.value[constants_1.STATUS] === 'Active'
    && change.data.after.value[constants_1.STATUS] !== 'Active'); };
exports.isDeactivatedFlowChange = isDeactivatedFlowChange;
var isDeactivatedFlowChangeOnly = function (change) {
    if (!exports.isDeactivatedFlowChange(change)) {
        return false;
    }
    var afterClone = change.data.after.clone();
    afterClone.value[constants_1.STATUS] = constants_1.ACTIVE;
    var diffWithoutStatus = adapter_utils_1.detailedCompare(change.data.before, afterClone);
    return lodash_1["default"].isEmpty(diffWithoutStatus);
};
exports.isDeactivatedFlowChangeOnly = isDeactivatedFlowChangeOnly;
var isElementWithResolvedParent = function (element) { return (adapter_utils_1.getParents(element).some(function (parent) { return adapter_api_1.isReferenceExpression(parent) && adapter_api_1.isElement(parent.value); })); };
exports.isElementWithResolvedParent = isElementWithResolvedParent;
var getAuthorInformationFromFileProps = function (fileProps) { return ({
    createdBy: fileProps.createdByName,
    createdAt: fileProps.createdDate,
    changedBy: fileProps.lastModifiedByName,
    changedAt: fileProps.lastModifiedDate,
}); };
exports.getAuthorInformationFromFileProps = getAuthorInformationFromFileProps;
var getElementAuthorInformation = function (_a) {
    var annotations = _a.annotations;
    return ({
        createdBy: annotations[adapter_api_1.CORE_ANNOTATIONS.CREATED_BY],
        createdAt: annotations[adapter_api_1.CORE_ANNOTATIONS.CREATED_AT],
        changedBy: annotations[adapter_api_1.CORE_ANNOTATIONS.CHANGED_BY],
        changedAt: annotations[adapter_api_1.CORE_ANNOTATIONS.CHANGED_AT],
    });
};
exports.getElementAuthorInformation = getElementAuthorInformation;
var getNamespaceSync = function (element) {
    var elementApiName = exports.apiNameSync(element, true);
    if (elementApiName === undefined) {
        return undefined;
    }
    return adapter_api_1.isInstanceElement(element) && exports.isInstanceOfTypeSync(constants_1.LAYOUT_TYPE_ID_METADATA_TYPE)(element)
        ? getNamespaceFromString(exports.layoutObjAndName(elementApiName)[1])
        : getNamespaceFromString(elementApiName);
};
exports.getNamespaceSync = getNamespaceSync;
var isPicklistField = function (changedElement) {
    return adapter_api_1.isField(changedElement)
        && ([
            transformer_1.Types.primitiveDataTypes.Picklist.elemID.getFullName(),
            transformer_1.Types.primitiveDataTypes.MultiselectPicklist.elemID.getFullName(),
        ]).includes(changedElement.refType.elemID.getFullName());
};
exports.isPicklistField = isPicklistField;
var isValueSetReference = function (field) {
    return adapter_api_1.isReferenceExpression(field.annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME]);
};
exports.isValueSetReference = isValueSetReference;
var hasValueSetNameAnnotation = function (field) {
    return !lodash_1["default"].isUndefined(field.annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME]);
};
exports.hasValueSetNameAnnotation = hasValueSetNameAnnotation;
var getMostRecentFileProperties = function (fileProps) { return (lodash_1["default"].maxBy(fileProps.filter(function (_a) {
    var lastModifiedDate = _a.lastModifiedDate;
    return lodash_1["default"].isString(lastModifiedDate) && lastModifiedDate !== '' && lastModifiedDate !== constants_1.UNIX_TIME_ZERO_STRING;
}), function (prop) { return new Date(prop.lastModifiedDate).getTime(); })); };
exports.getMostRecentFileProperties = getMostRecentFileProperties;
