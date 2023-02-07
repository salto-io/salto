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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20;
exports.__esModule = true;
exports.createMetadataTypeElements = exports.getTypePath = exports.getAuthorAnnotations = exports.createInstanceElement = exports.isMetadataInstanceElement = exports.assertMetadataObjectType = exports.createMetadataObjectType = exports.isMetadataObjectType = exports.metadataAnnotationTypes = exports.createInstanceServiceIds = exports.toMetadataInfo = exports.fromMetadataInfo = exports.toDeployableInstance = exports.getSObjectFieldElement = exports.transformPrimitive = exports.isNull = exports.getValueTypeFieldElement = exports.toCustomProperties = exports.isLocalOnly = exports.toCustomField = exports.instancesToDeleteRecords = exports.instancesToCreateRecords = exports.instancesToUpdateRecords = exports.isNameField = exports.Types = exports.METADATA_TYPES_TO_RENAME = exports.fieldTypeName = exports.formulaTypeName = exports.apiName = exports.relativeApiName = exports.defaultApiName = exports.isCustomSettingsObject = exports.isCustomSettings = exports.isCustom = exports.isInstanceOfCustomObject = exports.isFieldOfCustomObject = exports.isCustomObject = exports.metadataType = void 0;
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
/* eslint-disable camelcase */
var lodash_1 = require("lodash");
var adapter_api_1 = require("@salto-io/adapter-api");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var types_1 = require("../client/types");
var constants_1 = require("../constants");
var salesforce_types_1 = require("./salesforce_types");
var missing_fields_1 = require("./missing_fields");
var _21 = lowerdash_1.promises.object, mapValuesAsync = _21.mapValuesAsync, pickAsync = _21.pickAsync;
var awu = lowerdash_1.collections.asynciterable.awu;
var makeArray = lowerdash_1.collections.array.makeArray;
var isDefined = lowerdash_1.values.isDefined;
var xsdTypes = [
    'xsd:boolean',
    'xsd:date',
    'xsd:dateTime',
    'xsd:picklist',
    'xsd:string',
    'xsd:int',
    'xsd:double',
    'xsd:long',
];
var metadataType = function (element) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!adapter_api_1.isInstanceElement(element)) return [3 /*break*/, 2];
                _a = exports.metadataType;
                return [4 /*yield*/, element.getType()];
            case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
            case 2:
                if (adapter_api_1.isField(element)) {
                    // We expect to reach to this place only with field of CustomObject
                    return [2 /*return*/, constants_1.CUSTOM_FIELD];
                }
                return [2 /*return*/, element.annotations[constants_1.METADATA_TYPE] || 'unknown'];
        }
    });
}); };
exports.metadataType = metadataType;
var isCustomObject = function (element) { return __awaiter(void 0, void 0, void 0, function () {
    var res, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = adapter_api_1.isObjectType(element);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, exports.metadataType(element)];
            case 1:
                _a = (_b.sent()) === constants_1.CUSTOM_OBJECT;
                _b.label = 2;
            case 2:
                res = _a 
                // The last part is so we can tell the difference between a custom object
                // and the original "CustomObject" type from salesforce (the latter will not have an API_NAME)
                && element.annotations[constants_1.API_NAME] !== undefined;
                return [2 /*return*/, res];
        }
    });
}); };
exports.isCustomObject = isCustomObject;
var isFieldOfCustomObject = function (field) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, exports.isCustomObject(field.parent)
        // This function checks whether an element is an instance of any custom object type.
        // Note that this does not apply to custom object definitions themselves, e.g, this will be true
        // for instances of Lead, but it will not be true for Lead itself when it is still an instance
        // (before the custom objects filter turns it into a type).
        // To filter for instances like the Lead definition, use isInstanceOfType(CUSTOM_OBJECT) instead
    ];
}); }); };
exports.isFieldOfCustomObject = isFieldOfCustomObject;
// This function checks whether an element is an instance of any custom object type.
// Note that this does not apply to custom object definitions themselves, e.g, this will be true
// for instances of Lead, but it will not be true for Lead itself when it is still an instance
// (before the custom objects filter turns it into a type).
// To filter for instances like the Lead definition, use isInstanceOfType(CUSTOM_OBJECT) instead
var isInstanceOfCustomObject = function (element) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
    switch (_c.label) {
        case 0:
            _a = adapter_api_1.isInstanceElement(element);
            if (!_a) return [3 /*break*/, 2];
            _b = exports.isCustomObject;
            return [4 /*yield*/, element.getType()];
        case 1:
            _a = _b.apply(void 0, [_c.sent()]);
            _c.label = 2;
        case 2: return [2 /*return*/, _a];
    }
}); }); };
exports.isInstanceOfCustomObject = isInstanceOfCustomObject;
var isCustom = function (fullName) {
    return fullName.endsWith(constants_1.SALESFORCE_CUSTOM_SUFFIX);
};
exports.isCustom = isCustom;
var isCustomSettings = function (instance) {
    return instance.value[constants_1.CUSTOM_SETTINGS_TYPE];
};
exports.isCustomSettings = isCustomSettings;
var isCustomSettingsObject = function (obj) {
    return obj.annotations[constants_1.CUSTOM_SETTINGS_TYPE];
};
exports.isCustomSettingsObject = isCustomSettingsObject;
var defaultApiName = function (element) {
    var name = element.elemID.name;
    return exports.isCustom(name) || adapter_api_1.isInstanceElement(element)
        ? name
        : "" + name + constants_1.SALESFORCE_CUSTOM_SUFFIX;
};
exports.defaultApiName = defaultApiName;
var fullApiName = function (elem) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!adapter_api_1.isInstanceElement(elem)) return [3 /*break*/, 3];
                _a = exports.isCustomObject;
                return [4 /*yield*/, elem.getType()];
            case 1: return [4 /*yield*/, _a.apply(void 0, [_c.sent()])];
            case 2: return [2 /*return*/, (_c.sent())
                    ? elem.value[constants_1.CUSTOM_OBJECT_ID_FIELD] : elem.value[constants_1.INSTANCE_FULL_NAME_FIELD]];
            case 3: return [2 /*return*/, (_b = elem.annotations[constants_1.API_NAME]) !== null && _b !== void 0 ? _b : elem.annotations[constants_1.METADATA_TYPE]];
        }
    });
}); };
var relativeApiName = function (name) { return lodash_1["default"].last(name.split(constants_1.API_NAME_SEPARATOR)); };
exports.relativeApiName = relativeApiName;
var apiName = function (elem, relative) {
    if (relative === void 0) { relative = false; }
    return __awaiter(void 0, void 0, void 0, function () {
        var name;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, fullApiName(elem)];
                case 1:
                    name = _a.sent();
                    return [2 /*return*/, name && relative ? exports.relativeApiName(name) : name];
            }
        });
    });
};
exports.apiName = apiName;
var formulaTypeName = function (baseTypeName) {
    return "" + constants_1.FORMULA_TYPE_NAME + baseTypeName;
};
exports.formulaTypeName = formulaTypeName;
var fieldTypeName = function (typeName) {
    if (typeName.startsWith(constants_1.FORMULA_TYPE_NAME)) {
        return typeName.slice(constants_1.FORMULA_TYPE_NAME.length);
    }
    if (typeName === constants_1.LOCATION_INTERNAL_COMPOUND_FIELD_TYPE_NAME) {
        return constants_1.COMPOUND_FIELD_TYPE_NAMES.LOCATION;
    }
    return typeName;
};
exports.fieldTypeName = fieldTypeName;
var createPicklistValuesAnnotations = function (picklistValues) {
    return picklistValues.map(function (val) {
        var _a;
        return (_a = {},
            _a[constants_1.CUSTOM_VALUE.FULL_NAME] = val.value,
            _a[constants_1.CUSTOM_VALUE.DEFAULT] = val.defaultValue,
            _a[constants_1.CUSTOM_VALUE.LABEL] = val.label || val.value,
            _a[constants_1.CUSTOM_VALUE.IS_ACTIVE] = val.active,
            _a);
    });
};
var addPicklistAnnotations = function (picklistValues, restricted, annotations) {
    if (picklistValues && picklistValues.length > 0) {
        annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET] = createPicklistValuesAnnotations(picklistValues);
        annotations[constants_1.FIELD_ANNOTATIONS.RESTRICTED] = restricted;
    }
};
// Defines SFDC built-in field types & built-in primitive data types
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/field_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/primitive_data_types.htm
// Ref: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_field_types.htm#meta_type_fieldtype
var addressElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.COMPOUND_FIELD_TYPE_NAMES.ADDRESS);
var nameElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME);
var nameNoSalutationElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME_NO_SALUTATION);
// We cannot use "Location" as the Salto ID here because there is a standard object called Location
var geoLocationElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.LOCATION_INTERNAL_COMPOUND_FIELD_TYPE_NAME);
var restrictedNumberTypeDefinitions = {
    TextLength: adapter_api_1.createRestriction({ min: 1, max: 255, enforce_value: false }),
    TextAreaLength: adapter_api_1.createRestriction({ min: 1, max: 131072, enforce_value: false }),
    EncryptedTextLength: adapter_api_1.createRestriction({ min: 1, max: 175, enforce_value: false }),
    LongTextAreaVisibleLines: adapter_api_1.createRestriction({ min: 2, max: 50, enforce_value: false }),
    MultiPicklistVisibleLines: adapter_api_1.createRestriction({ min: 3, max: 10, enforce_value: false }),
    RichTextAreaVisibleLines: adapter_api_1.createRestriction({ min: 10, max: 50, enforce_value: false }),
    RelationshipOrder: adapter_api_1.createRestriction({ min: 0, max: 1, enforce_value: false }),
};
var restrictedNumberTypes = lodash_1["default"].mapValues(restrictedNumberTypeDefinitions, function (restriction, name) {
    var _a;
    return new adapter_api_1.PrimitiveType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, name),
        primitive: adapter_api_1.PrimitiveTypes.NUMBER,
        annotations: (_a = {}, _a[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = restriction, _a),
    });
});
exports.METADATA_TYPES_TO_RENAME = new Map([
    ['FlexiPage', 'LightningPage'],
    ['FlexiPageRegion', 'LightningPageRegion'],
    ['FlexiPageTemplateInstance', 'LightningPageTemplateInstance'],
    ['Territory2', 'Territory2Metadata'],
    ['Territory2Model', 'Territory2ModelMetadata'],
]);
var Types = /** @class */ (function () {
    function Types() {
    }
    Types.setElemIdGetter = function (getElemIdFunc) {
        this.getElemIdFunc = getElemIdFunc;
    };
    Types.getKnownType = function (name, customObject) {
        if (customObject === void 0) { customObject = true; }
        return customObject
            ? this.primitiveDataTypes[name]
                || this.compoundDataTypes[name]
                || this.formulaDataTypes[name]
            : this.metadataPrimitiveTypes[name.toLowerCase()];
    };
    Types.get = function (name, customObject, isSettings, serviceIds) {
        if (customObject === void 0) { customObject = true; }
        if (isSettings === void 0) { isSettings = false; }
        var type = Types.getKnownType(name, customObject);
        if (type === undefined) {
            return this.createObjectType(name, customObject, isSettings, serviceIds);
        }
        return type;
    };
    Types.createObjectType = function (name, customObject, isSettings, serviceIds) {
        if (customObject === void 0) { customObject = true; }
        if (isSettings === void 0) { isSettings = false; }
        var elemId = this.getElemId(name, customObject, serviceIds);
        return new adapter_api_1.ObjectType({
            elemID: elemId,
            isSettings: isSettings,
        });
    };
    Types.getElemId = function (name, customObject, serviceIds) {
        var _a;
        var updatedName = customObject
            ? name
            : (_a = exports.METADATA_TYPES_TO_RENAME.get(name)) !== null && _a !== void 0 ? _a : name;
        return (customObject && this.getElemIdFunc && serviceIds)
            ? this.getElemIdFunc(constants_1.SALESFORCE, serviceIds, adapter_utils_1.naclCase(updatedName))
            : new adapter_api_1.ElemID(constants_1.SALESFORCE, adapter_utils_1.naclCase(updatedName));
    };
    Types.getAllFieldTypes = function () {
        return Object.values(Types.primitiveDataTypes)
            .concat(Object.values(Types.compoundDataTypes))
            .concat(Object.values(Types.formulaDataTypes))
            .filter(function (type) { return type.elemID.adapter === constants_1.SALESFORCE; })
            .map(function (type) {
            var fieldType = type.clone();
            fieldType.path = [constants_1.SALESFORCE, constants_1.TYPES_PATH, 'fieldTypes'];
            return fieldType;
        });
    };
    Types.getAllMissingTypes = function () {
        return salesforce_types_1.allMissingSubTypes;
    };
    Types.getAnnotationTypes = function () {
        return __spreadArrays([Types.fieldDependencyType, Types.rollupSummaryOperationType,
            Types.rollupSummaryFilterItemsType, Types.rollupSummaryFilterItemOperationType,
            Types.valueSettingsType, Types.lookupFilterType, Types.filterItemType,
            Types.encryptedTextMaskCharType, Types.encryptedTextMaskTypeType,
            Types.BusinessStatusType, Types.SecurityClassificationType, Types.valueSetType,
            Types.TreatBlankAsType], Object.values(restrictedNumberTypes)).map(function (type) {
            var fieldType = type.clone();
            fieldType.path = fieldType.elemID.isEqual(Types.filterItemElemID)
                ? [constants_1.SALESFORCE, constants_1.TYPES_PATH, Types.filterItemElemID.name]
                : [constants_1.SALESFORCE, constants_1.TYPES_PATH, 'annotationTypes'];
            return fieldType;
        });
    };
    Types.filterItemElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.ANNOTATION_TYPE_NAMES.FILTER_ITEM);
    Types.filterItemType = new adapter_api_1.ObjectType({
        elemID: Types.filterItemElemID,
        fields: (_a = {},
            _a[constants_1.FILTER_ITEM_FIELDS.FIELD] = { refType: adapter_api_1.BuiltinTypes.STRING },
            _a[constants_1.FILTER_ITEM_FIELDS.OPERATION] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
                annotations: (_b = {},
                    _b[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                        values: [
                            'contains', 'equals', 'excludes', 'greaterOrEqual', 'greaterThan', 'includes',
                            'lessOrEqual', 'lessThan', 'notContain', 'notEqual', 'startsWith', 'within',
                        ],
                    }),
                    _b),
            },
            _a[constants_1.FILTER_ITEM_FIELDS.VALUE_FIELD] = { refType: adapter_api_1.BuiltinTypes.STRING },
            _a[constants_1.FILTER_ITEM_FIELDS.VALUE] = { refType: adapter_api_1.BuiltinTypes.STRING },
            _a),
        annotations: (_c = {},
            _c[constants_1.API_NAME] = 'FilterItem',
            _c),
    });
    Types.lookupFilterElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.ANNOTATION_TYPE_NAMES.LOOKUP_FILTER);
    Types.lookupFilterType = new adapter_api_1.ObjectType({
        elemID: Types.lookupFilterElemID,
        fields: (_d = {},
            _d[constants_1.LOOKUP_FILTER_FIELDS.ACTIVE] = { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
            _d[constants_1.LOOKUP_FILTER_FIELDS.BOOLEAN_FILTER] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            _d[constants_1.LOOKUP_FILTER_FIELDS.ERROR_MESSAGE] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            _d[constants_1.LOOKUP_FILTER_FIELDS.INFO_MESSAGE] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            _d[constants_1.LOOKUP_FILTER_FIELDS.IS_OPTIONAL] = {
                refType: adapter_api_1.BuiltinTypes.BOOLEAN,
            },
            _d[constants_1.LOOKUP_FILTER_FIELDS.FILTER_ITEMS] = {
                refType: new adapter_api_1.ListType(Types.filterItemType),
            },
            _d),
        annotations: (_e = {},
            _e[constants_1.API_NAME] = 'LookupFilter',
            _e),
    });
    Types.valueSettingsElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.ANNOTATION_TYPE_NAMES.VALUE_SETTINGS);
    Types.valueSettingsType = new adapter_api_1.ObjectType({
        elemID: Types.valueSettingsElemID,
        fields: (_f = {},
            // todo: currently this field is populated with the referenced field's API name,
            //  should be modified to elemID reference once we'll use HIL
            _f[constants_1.VALUE_SETTINGS_FIELDS.VALUE_NAME] = { refType: adapter_api_1.BuiltinTypes.STRING },
            _f[constants_1.VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE] = {
                refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
            },
            _f),
        annotations: (_g = {},
            _g[constants_1.API_NAME] = 'ValueSettings',
            _g),
    });
    Types.valueSetElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_ANNOTATIONS.VALUE_SET);
    Types.valueSetType = new adapter_api_1.ObjectType({
        elemID: Types.valueSetElemID,
        fields: (_h = {},
            _h[constants_1.CUSTOM_VALUE.FULL_NAME] = { refType: adapter_api_1.BuiltinTypes.STRING },
            _h[constants_1.CUSTOM_VALUE.LABEL] = { refType: adapter_api_1.BuiltinTypes.STRING },
            _h[constants_1.CUSTOM_VALUE.DEFAULT] = { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
            _h[constants_1.CUSTOM_VALUE.IS_ACTIVE] = { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
            _h[constants_1.CUSTOM_VALUE.COLOR] = { refType: adapter_api_1.BuiltinTypes.STRING },
            _h),
    });
    Types.fieldDependencyElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.ANNOTATION_TYPE_NAMES.FIELD_DEPENDENCY);
    Types.fieldDependencyType = new adapter_api_1.ObjectType({
        elemID: Types.fieldDependencyElemID,
        fields: (_j = {},
            _j[constants_1.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            _j[constants_1.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS] = {
                refType: new adapter_api_1.ListType(Types.valueSettingsType),
            },
            _j),
    });
    Types.rollupSummaryOperationTypeElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_ANNOTATIONS.SUMMARY_OPERATION);
    Types.rollupSummaryOperationType = new adapter_api_1.PrimitiveType({
        elemID: Types.rollupSummaryOperationTypeElemID,
        primitive: adapter_api_1.PrimitiveTypes.STRING,
        annotations: (_k = {},
            _k[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                values: ['count', 'min', 'max', 'sum'],
            }),
            _k),
    });
    Types.rollupSummaryFilterItemOperationType = new adapter_api_1.PrimitiveType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_ANNOTATIONS.ROLLUP_SUMMARY_FILTER_OPERATION),
        primitive: adapter_api_1.PrimitiveTypes.STRING,
        annotations: (_l = {},
            _l[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                values: [
                    'equals', 'notEqual', 'lessThan', 'greaterThan', 'lessOrEqual',
                    'greaterOrEqual', 'contains', 'notContain', 'startsWith',
                    'includes', 'excludes', 'within',
                ],
            }),
            _l),
    });
    Types.rollupSummaryFilterItemsElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS);
    Types.rollupSummaryFilterItemsType = new adapter_api_1.ObjectType({
        elemID: Types.rollupSummaryFilterItemsElemID,
        fields: (_m = {},
            _m[constants_1.FILTER_ITEM_FIELDS.FIELD] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            _m[constants_1.FILTER_ITEM_FIELDS.OPERATION] = {
                refType: Types.rollupSummaryFilterItemOperationType,
            },
            _m[constants_1.FILTER_ITEM_FIELDS.VALUE] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            _m[constants_1.FILTER_ITEM_FIELDS.VALUE_FIELD] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            _m),
    });
    Types.encryptedTextMaskTypeTypeElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_ANNOTATIONS.MASK_TYPE, 'type');
    Types.encryptedTextMaskTypeType = new adapter_api_1.PrimitiveType({
        elemID: Types.encryptedTextMaskTypeTypeElemID,
        primitive: adapter_api_1.PrimitiveTypes.STRING,
        annotations: (_o = {},
            _o[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                values: ['all', 'creditCard', 'ssn', 'lastFour', 'sin', 'nino'],
            }),
            _o),
    });
    Types.encryptedTextMaskCharTypeElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_ANNOTATIONS.MASK_CHAR, 'type');
    Types.encryptedTextMaskCharType = new adapter_api_1.PrimitiveType({
        elemID: Types.encryptedTextMaskCharTypeElemID,
        primitive: adapter_api_1.PrimitiveTypes.STRING,
        annotations: (_p = {},
            _p[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({ values: ['X', 'asterisk'] }),
            _p),
    });
    Types.BusinessStatusTypeElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.BUSINESS_STATUS);
    Types.BusinessStatusType = new adapter_api_1.PrimitiveType({
        elemID: Types.BusinessStatusTypeElemID,
        primitive: adapter_api_1.PrimitiveTypes.STRING,
        annotations: (_q = {},
            _q[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                values: ['Active', 'DeprecateCandidate', 'Hidden'],
            }),
            _q),
    });
    Types.SecurityClassificationTypeElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.SECURITY_CLASSIFICATION);
    Types.SecurityClassificationType = new adapter_api_1.PrimitiveType({
        elemID: Types.SecurityClassificationTypeElemID,
        primitive: adapter_api_1.PrimitiveTypes.STRING,
        annotations: (_r = {},
            _r[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                values: ['Public', 'Internal', 'Confidential', 'Restricted', 'MissionCritical'],
            }),
            _r),
    });
    Types.TreatBlankAsTypeElemID = new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_ANNOTATIONS.FORMULA_TREAT_BLANKS_AS);
    Types.TreatBlankAsType = new adapter_api_1.PrimitiveType({
        elemID: Types.TreatBlankAsTypeElemID,
        primitive: adapter_api_1.PrimitiveTypes.STRING,
        annotations: (_s = {},
            _s[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({ values: ['BlankAsBlank', 'BlankAsZero'] }),
            _s),
    });
    Types.commonAnnotationTypes = (_t = {},
        _t[constants_1.API_NAME] = adapter_api_1.BuiltinTypes.SERVICE_ID,
        _t[constants_1.DESCRIPTION] = adapter_api_1.BuiltinTypes.STRING,
        _t[constants_1.HELP_TEXT] = adapter_api_1.BuiltinTypes.STRING,
        _t[constants_1.LABEL] = adapter_api_1.BuiltinTypes.STRING,
        _t[constants_1.BUSINESS_OWNER_USER] = adapter_api_1.BuiltinTypes.STRING,
        _t[constants_1.BUSINESS_OWNER_GROUP] = adapter_api_1.BuiltinTypes.STRING,
        _t[constants_1.BUSINESS_STATUS] = Types.BusinessStatusType,
        _t[constants_1.SECURITY_CLASSIFICATION] = Types.SecurityClassificationType,
        _t[constants_1.COMPLIANCE_GROUP] = adapter_api_1.BuiltinTypes.STRING,
        _t[constants_1.FIELD_ANNOTATIONS.CREATABLE] = adapter_api_1.BuiltinTypes.BOOLEAN,
        _t[constants_1.FIELD_ANNOTATIONS.UPDATEABLE] = adapter_api_1.BuiltinTypes.BOOLEAN,
        _t[constants_1.FIELD_ANNOTATIONS.QUERYABLE] = adapter_api_1.BuiltinTypes.BOOLEAN,
        _t[constants_1.INTERNAL_ID_ANNOTATION] = adapter_api_1.BuiltinTypes.HIDDEN_STRING,
        _t[constants_1.FIELD_ANNOTATIONS.EXTERNAL_ID] = adapter_api_1.BuiltinTypes.BOOLEAN,
        _t[constants_1.FIELD_ANNOTATIONS.TRACK_TRENDING] = adapter_api_1.BuiltinTypes.BOOLEAN,
        _t[constants_1.FIELD_ANNOTATIONS.TRACK_FEED_HISTORY] = adapter_api_1.BuiltinTypes.BOOLEAN,
        _t[constants_1.FIELD_ANNOTATIONS.DEPRECATED] = adapter_api_1.BuiltinTypes.BOOLEAN,
        _t[constants_1.FIELD_ANNOTATIONS.TRACK_HISTORY] = adapter_api_1.BuiltinTypes.BOOLEAN,
        _t);
    Types.lookupAnnotationTypes = (_u = {},
        _u[constants_1.FIELD_ANNOTATIONS.REFERENCE_TO] = new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING),
        _u[constants_1.FIELD_ANNOTATIONS.LOOKUP_FILTER] = Types.lookupFilterType,
        _u[constants_1.FIELD_ANNOTATIONS.RELATIONSHIP_NAME] = adapter_api_1.BuiltinTypes.STRING,
        _u[constants_1.FIELD_ANNOTATIONS.RELATIONSHIP_LABEL] = adapter_api_1.BuiltinTypes.STRING,
        _u[constants_1.FIELD_ANNOTATIONS.DELETE_CONSTRAINT] = adapter_api_1.BuiltinTypes.STRING,
        _u);
    // Type mapping for custom objects
    Types.primitiveDataTypes = {
        serviceid: adapter_api_1.BuiltinTypes.SERVICE_ID,
        Text: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.TEXT),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_w = {}, _w[constants_1.FIELD_ANNOTATIONS.UNIQUE] = adapter_api_1.BuiltinTypes.BOOLEAN, _w[constants_1.FIELD_ANNOTATIONS.CASE_SENSITIVE] = adapter_api_1.BuiltinTypes.BOOLEAN, _w[constants_1.FIELD_ANNOTATIONS.LENGTH] = restrictedNumberTypes.TextLength, _w[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _w)),
        }),
        Number: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.NUMBER),
            primitive: adapter_api_1.PrimitiveTypes.NUMBER,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_x = {}, _x[constants_1.FIELD_ANNOTATIONS.SCALE] = adapter_api_1.BuiltinTypes.NUMBER, _x[constants_1.FIELD_ANNOTATIONS.PRECISION] = adapter_api_1.BuiltinTypes.NUMBER, _x[constants_1.FIELD_ANNOTATIONS.UNIQUE] = adapter_api_1.BuiltinTypes.BOOLEAN, _x[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _x)),
        }),
        AutoNumber: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.AUTONUMBER),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_y = {}, _y[constants_1.FIELD_ANNOTATIONS.DISPLAY_FORMAT] = adapter_api_1.BuiltinTypes.STRING, _y)),
        }),
        Checkbox: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.CHECKBOX),
            primitive: adapter_api_1.PrimitiveTypes.BOOLEAN,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_z = {}, _z[constants_1.FIELD_ANNOTATIONS.DEFAULT_VALUE] = adapter_api_1.BuiltinTypes.BOOLEAN, _z)),
        }),
        Date: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.DATE),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_0 = {}, _0[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _0)),
        }),
        Time: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.TIME),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_1 = {}, _1[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _1)),
        }),
        DateTime: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.DATETIME),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_2 = {}, _2[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _2)),
        }),
        Currency: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.CURRENCY),
            primitive: adapter_api_1.PrimitiveTypes.NUMBER,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_3 = {}, _3[constants_1.FIELD_ANNOTATIONS.SCALE] = adapter_api_1.BuiltinTypes.NUMBER, _3[constants_1.FIELD_ANNOTATIONS.PRECISION] = adapter_api_1.BuiltinTypes.NUMBER, _3[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _3)),
        }),
        Picklist: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.PICKLIST),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_4 = {}, _4[constants_1.FIELD_ANNOTATIONS.FIELD_DEPENDENCY] = Types.fieldDependencyType, _4[constants_1.FIELD_ANNOTATIONS.VALUE_SET] = new adapter_api_1.ListType(Types.valueSetType), _4[constants_1.FIELD_ANNOTATIONS.RESTRICTED] = adapter_api_1.BuiltinTypes.BOOLEAN, _4[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME] = adapter_api_1.BuiltinTypes.STRING, _4[constants_1.VALUE_SET_DEFINITION_FIELDS.SORTED] = adapter_api_1.BuiltinTypes.BOOLEAN, _4[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _4)),
        }),
        MultiselectPicklist: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.MULTIPICKLIST),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_5 = {}, _5[constants_1.FIELD_ANNOTATIONS.VISIBLE_LINES] = restrictedNumberTypes.MultiPicklistVisibleLines, _5[constants_1.FIELD_ANNOTATIONS.FIELD_DEPENDENCY] = Types.fieldDependencyType, _5[constants_1.FIELD_ANNOTATIONS.VALUE_SET] = new adapter_api_1.ListType(Types.valueSetType), _5[constants_1.FIELD_ANNOTATIONS.RESTRICTED] = adapter_api_1.BuiltinTypes.BOOLEAN, _5[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME] = adapter_api_1.BuiltinTypes.STRING, _5[constants_1.VALUE_SET_DEFINITION_FIELDS.SORTED] = adapter_api_1.BuiltinTypes.BOOLEAN, _5[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _5)),
        }),
        Email: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.EMAIL),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_6 = {}, _6[constants_1.FIELD_ANNOTATIONS.UNIQUE] = adapter_api_1.BuiltinTypes.BOOLEAN, _6[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _6)),
        }),
        Percent: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.PERCENT),
            primitive: adapter_api_1.PrimitiveTypes.NUMBER,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_7 = {}, _7[constants_1.FIELD_ANNOTATIONS.SCALE] = adapter_api_1.BuiltinTypes.NUMBER, _7[constants_1.FIELD_ANNOTATIONS.PRECISION] = adapter_api_1.BuiltinTypes.NUMBER, _7[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _7)),
        }),
        Phone: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.PHONE),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_8 = {}, _8[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _8)),
        }),
        LongTextArea: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.LONGTEXTAREA),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_9 = {}, _9[constants_1.FIELD_ANNOTATIONS.VISIBLE_LINES] = restrictedNumberTypes.LongTextAreaVisibleLines, _9[constants_1.FIELD_ANNOTATIONS.LENGTH] = restrictedNumberTypes.TextAreaLength, _9[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _9)),
        }),
        Html: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.RICHTEXTAREA),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_10 = {}, _10[constants_1.FIELD_ANNOTATIONS.VISIBLE_LINES] = restrictedNumberTypes.RichTextAreaVisibleLines, _10[constants_1.FIELD_ANNOTATIONS.LENGTH] = restrictedNumberTypes.TextAreaLength, _10)),
        }),
        TextArea: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.TEXTAREA),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_11 = {}, _11[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _11)),
        }),
        EncryptedText: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.ENCRYPTEDTEXT),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_12 = {}, _12[constants_1.FIELD_ANNOTATIONS.MASK_CHAR] = Types.encryptedTextMaskCharType, _12[constants_1.FIELD_ANNOTATIONS.MASK_TYPE] = Types.encryptedTextMaskTypeType, _12[constants_1.FIELD_ANNOTATIONS.LENGTH] = restrictedNumberTypes.EncryptedTextLength, _12)),
        }),
        Url: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.URL),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_13 = {}, _13[constants_1.DEFAULT_VALUE_FORMULA] = adapter_api_1.BuiltinTypes.STRING, _13)),
        }),
        Lookup: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.LOOKUP),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), Types.lookupAnnotationTypes),
        }),
        MasterDetail: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.MASTER_DETAIL),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_14 = {}, _14[constants_1.FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL] = adapter_api_1.BuiltinTypes.BOOLEAN, _14[constants_1.FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ] = adapter_api_1.BuiltinTypes.BOOLEAN, _14[constants_1.FIELD_ANNOTATIONS.LOOKUP_FILTER] = Types.lookupFilterType, _14[constants_1.FIELD_ANNOTATIONS.REFERENCE_TO] = new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING), _14[constants_1.FIELD_ANNOTATIONS.RELATIONSHIP_ORDER] = restrictedNumberTypes.RelationshipOrder, _14[constants_1.FIELD_ANNOTATIONS.RELATIONSHIP_NAME] = adapter_api_1.BuiltinTypes.STRING, _14[constants_1.FIELD_ANNOTATIONS.RELATIONSHIP_LABEL] = adapter_api_1.BuiltinTypes.STRING, _14)),
        }),
        Summary: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.ROLLUP_SUMMARY),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), (_15 = {}, _15[constants_1.FIELD_ANNOTATIONS.SUMMARIZED_FIELD] = adapter_api_1.BuiltinTypes.STRING, _15[constants_1.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS] = new adapter_api_1.ListType(Types.rollupSummaryFilterItemsType), _15[constants_1.FIELD_ANNOTATIONS.SUMMARY_FOREIGN_KEY] = adapter_api_1.BuiltinTypes.STRING, _15[constants_1.FIELD_ANNOTATIONS.SUMMARY_OPERATION] = Types.rollupSummaryOperationType, _15)),
        }),
        Hierarchy: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.HIERARCHY),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), Types.lookupAnnotationTypes),
        }),
        MetadataRelationship: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.METADATA_RELATIONSHIP),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), Types.lookupAnnotationTypes),
        }),
        ExternalLookup: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.EXTERNAL_LOOKUP),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), Types.lookupAnnotationTypes),
        }),
        IndirectLookup: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.INDIRECT_LOOKUP),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign(__assign({}, Types.commonAnnotationTypes), Types.lookupAnnotationTypes),
        }),
        File: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.FIELD_TYPE_NAMES.FILE),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign({}, Types.commonAnnotationTypes),
        }),
        Unknown: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.INTERNAL_FIELD_TYPE_NAMES.UNKNOWN),
            primitive: adapter_api_1.PrimitiveTypes.STRING,
            annotationRefsOrTypes: __assign({}, Types.commonAnnotationTypes),
        }),
        AnyType: new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.INTERNAL_FIELD_TYPE_NAMES.ANY),
            primitive: adapter_api_1.PrimitiveTypes.UNKNOWN,
            annotationRefsOrTypes: __assign({}, Types.commonAnnotationTypes),
        }),
    };
    Types.getFormulaDataType = function (baseTypeName) {
        var _a, _b;
        var baseType = Types.primitiveDataTypes[baseTypeName];
        var typeName = exports.formulaTypeName(baseTypeName);
        return _a = {}, _a[typeName] = new adapter_api_1.PrimitiveType({
            elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, typeName),
            primitive: baseType.primitive,
            annotationRefsOrTypes: __assign(__assign({}, baseType.annotationRefTypes), (_b = {}, _b[constants_1.FORMULA] = adapter_api_1.BuiltinTypes.STRING, _b[constants_1.FIELD_ANNOTATIONS.FORMULA_TREAT_BLANKS_AS] = Types.TreatBlankAsType, _b)),
        }), _a;
    };
    Types.formulaDataTypes = lodash_1["default"].merge(Types.getFormulaDataType(constants_1.FIELD_TYPE_NAMES.CHECKBOX), Types.getFormulaDataType(constants_1.FIELD_TYPE_NAMES.CURRENCY), Types.getFormulaDataType(constants_1.FIELD_TYPE_NAMES.DATE), Types.getFormulaDataType(constants_1.FIELD_TYPE_NAMES.DATETIME), Types.getFormulaDataType(constants_1.FIELD_TYPE_NAMES.NUMBER), Types.getFormulaDataType(constants_1.FIELD_TYPE_NAMES.PERCENT), Types.getFormulaDataType(constants_1.FIELD_TYPE_NAMES.TEXT), Types.getFormulaDataType(constants_1.FIELD_TYPE_NAMES.TIME));
    Types.nameInnerFields = (_16 = {},
        _16[constants_1.NAME_FIELDS.FIRST_NAME] = {
            refType: adapter_api_1.BuiltinTypes.STRING,
        },
        _16[constants_1.NAME_FIELDS.LAST_NAME] = {
            refType: adapter_api_1.BuiltinTypes.STRING,
        },
        _16[constants_1.NAME_FIELDS.SALUTATION] = {
            refType: Types.primitiveDataTypes.Picklist,
        },
        _16[constants_1.NAME_FIELDS.MIDDLE_NAME] = {
            refType: adapter_api_1.BuiltinTypes.STRING,
        },
        _16[constants_1.NAME_FIELDS.SUFFIX] = {
            refType: adapter_api_1.BuiltinTypes.STRING,
        },
        _16);
    // Type mapping for compound fields
    Types.compoundDataTypes = {
        Address: new adapter_api_1.ObjectType({
            elemID: addressElemID,
            fields: (_17 = {},
                _17[constants_1.ADDRESS_FIELDS.CITY] = {
                    refType: adapter_api_1.BuiltinTypes.STRING,
                },
                _17[constants_1.ADDRESS_FIELDS.COUNTRY] = {
                    refType: adapter_api_1.BuiltinTypes.STRING,
                },
                _17[constants_1.ADDRESS_FIELDS.GEOCODE_ACCURACY] = {
                    refType: Types.primitiveDataTypes.Picklist,
                },
                _17[constants_1.ADDRESS_FIELDS.LATITUDE] = {
                    refType: adapter_api_1.BuiltinTypes.NUMBER,
                },
                _17[constants_1.ADDRESS_FIELDS.LONGITUDE] = {
                    refType: adapter_api_1.BuiltinTypes.NUMBER,
                },
                _17[constants_1.ADDRESS_FIELDS.POSTAL_CODE] = {
                    refType: adapter_api_1.BuiltinTypes.STRING,
                },
                _17[constants_1.ADDRESS_FIELDS.STATE] = {
                    refType: adapter_api_1.BuiltinTypes.STRING,
                },
                _17[constants_1.ADDRESS_FIELDS.STREET] = {
                    refType: Types.primitiveDataTypes.TextArea,
                },
                _17),
            annotationRefsOrTypes: __assign({}, Types.commonAnnotationTypes),
        }),
        Name: new adapter_api_1.ObjectType({
            elemID: nameElemID,
            fields: Types.nameInnerFields,
            annotationRefsOrTypes: __assign({}, Types.commonAnnotationTypes),
        }),
        Name2: new adapter_api_1.ObjectType({
            // replaces the regular Name for types that don't have Salutation attribute (e.g User)
            elemID: nameNoSalutationElemID,
            fields: lodash_1["default"].omit(Types.nameInnerFields, [constants_1.NAME_FIELDS.SALUTATION]),
            annotationRefsOrTypes: __assign({}, Types.commonAnnotationTypes),
        }),
        Location: new adapter_api_1.ObjectType({
            elemID: geoLocationElemID,
            fields: (_18 = {},
                _18[constants_1.GEOLOCATION_FIELDS.LATITUDE] = {
                    refType: adapter_api_1.BuiltinTypes.NUMBER,
                },
                _18[constants_1.GEOLOCATION_FIELDS.LONGITUDE] = {
                    refType: adapter_api_1.BuiltinTypes.NUMBER,
                },
                _18),
            annotationRefsOrTypes: __assign((_19 = {}, _19[constants_1.FIELD_ANNOTATIONS.DISPLAY_LOCATION_IN_DECIMAL] = adapter_api_1.BuiltinTypes.BOOLEAN, _19[constants_1.FIELD_ANNOTATIONS.SCALE] = adapter_api_1.BuiltinTypes.NUMBER, _19), Types.commonAnnotationTypes),
        }),
    };
    // Type mapping for metadata types
    Types.metadataPrimitiveTypes = {
        string: adapter_api_1.BuiltinTypes.STRING,
        double: adapter_api_1.BuiltinTypes.NUMBER,
        int: adapter_api_1.BuiltinTypes.NUMBER,
        integer: adapter_api_1.BuiltinTypes.NUMBER,
        boolean: adapter_api_1.BuiltinTypes.BOOLEAN,
        unknown: adapter_api_1.BuiltinTypes.UNKNOWN,
    };
    return Types;
}());
exports.Types = Types;
var isNameField = function (field) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = adapter_api_1.isObjectType;
                return [4 /*yield*/, field.getType()];
            case 1: return [2 /*return*/, (_a.apply(void 0, [_b.sent()])
                    && (field.refType.elemID.isEqual(Types.compoundDataTypes.Name.elemID)
                        || field.refType.elemID.isEqual(Types.compoundDataTypes.Name2.elemID)))];
        }
    });
}); };
exports.isNameField = isNameField;
var transformCompoundValues = function (record, instance) { return __awaiter(void 0, void 0, void 0, function () {
    var compoundFieldsElemIDs, relevantCompoundFields, _a, _b, transformedCompoundValues;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                compoundFieldsElemIDs = Object.values(Types.compoundDataTypes).map(function (o) { return o.elemID; });
                _b = (_a = lodash_1["default"]).pickBy;
                return [4 /*yield*/, instance.getType()];
            case 1:
                relevantCompoundFields = _b.apply(_a, [(_c.sent()).fields,
                    function (field, fieldKey) { return Object.keys(record).includes(fieldKey)
                        && !lodash_1["default"].isUndefined(lodash_1["default"].find(compoundFieldsElemIDs, function (e) { return field.refType.elemID.isEqual(e); })); }]);
                if (lodash_1["default"].isEmpty(relevantCompoundFields)) {
                    return [2 /*return*/, record];
                }
                return [4 /*yield*/, mapValuesAsync(relevantCompoundFields, function (compoundField, compoundFieldKey) { return __awaiter(void 0, void 0, void 0, function () {
                        var typeName, fieldPrefix;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, exports.isNameField(compoundField)];
                                case 1:
                                    // Name fields are without a prefix
                                    if (_a.sent()) {
                                        return [2 /*return*/, record[compoundFieldKey]];
                                    }
                                    typeName = compoundField.refType.elemID
                                        .isEqual(Types.compoundDataTypes.Address.elemID)
                                        ? constants_1.COMPOUND_FIELD_TYPE_NAMES.ADDRESS : constants_1.COMPOUND_FIELD_TYPE_NAMES.LOCATION;
                                    fieldPrefix = compoundFieldKey.slice(0, -typeName.length);
                                    return [2 /*return*/, lodash_1["default"].mapKeys(record[compoundFieldKey], function (_vv, key) { return fieldPrefix.concat(key); })];
                            }
                        });
                    }); })];
            case 2:
                transformedCompoundValues = _c.sent();
                return [2 /*return*/, Object.assign.apply(Object, __spreadArrays([lodash_1["default"].omit(record, Object.keys(relevantCompoundFields))], Object.values(transformedCompoundValues)))];
        }
    });
}); };
var toRecord = function (instance, fieldAnnotationToFilterBy) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceType, valsWithNulls, filteredRecordValues;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, instance.getType()];
            case 1:
                instanceType = _b.sent();
                valsWithNulls = __assign(__assign({}, lodash_1["default"].mapValues(instanceType.fields, function () { return null; })), instance.value);
                filteredRecordValues = __assign((_a = {}, _a[constants_1.CUSTOM_OBJECT_ID_FIELD] = instance.value[constants_1.CUSTOM_OBJECT_ID_FIELD], _a), lodash_1["default"].pickBy(valsWithNulls, function (_v, k) { var _a; return (_a = (instanceType).fields[k]) === null || _a === void 0 ? void 0 : _a.annotations[fieldAnnotationToFilterBy]; }));
                return [2 /*return*/, transformCompoundValues(filteredRecordValues, instance)];
        }
    });
}); };
var instancesToUpdateRecords = function (instances) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, Promise.all(instances.map(function (instance) { return toRecord(instance, constants_1.FIELD_ANNOTATIONS.UPDATEABLE); }))];
}); }); };
exports.instancesToUpdateRecords = instancesToUpdateRecords;
var instancesToCreateRecords = function (instances) {
    return Promise.all(instances.map(function (instance) { return toRecord(instance, constants_1.FIELD_ANNOTATIONS.CREATABLE); }));
};
exports.instancesToCreateRecords = instancesToCreateRecords;
var instancesToDeleteRecords = function (instances) {
    return instances.map(function (instance) { return ({ Id: instance.value[constants_1.CUSTOM_OBJECT_ID_FIELD] }); });
};
exports.instancesToDeleteRecords = instancesToDeleteRecords;
var toCustomField = function (field, omitInternalAnnotations) {
    if (omitInternalAnnotations === void 0) { omitInternalAnnotations = true; }
    return __awaiter(void 0, void 0, void 0, function () {
        var fieldDependency, newField, _a, annotationsHandledInCtor, internalUseAnnotations, annotationsToSkip, _b, _c, isAllowed, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    fieldDependency = field.annotations[constants_1.FIELD_ANNOTATIONS.FIELD_DEPENDENCY];
                    _a = types_1.CustomField.bind;
                    return [4 /*yield*/, exports.apiName(field, true)];
                case 1:
                    newField = new (_a.apply(types_1.CustomField, [void 0, _g.sent(), exports.fieldTypeName(field.refType.elemID.name),
                        field.annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED],
                        field.annotations[constants_1.FIELD_ANNOTATIONS.DEFAULT_VALUE],
                        field.annotations[constants_1.DEFAULT_VALUE_FORMULA],
                        makeArray(field.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET]), fieldDependency === null || fieldDependency === void 0 ? void 0 : fieldDependency[constants_1.FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD], fieldDependency === null || fieldDependency === void 0 ? void 0 : fieldDependency[constants_1.FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS], field.annotations[constants_1.FIELD_ANNOTATIONS.RESTRICTED],
                        field.annotations[constants_1.VALUE_SET_DEFINITION_FIELDS.SORTED],
                        field.annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME],
                        field.annotations[constants_1.FORMULA],
                        field.annotations[constants_1.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS],
                        field.annotations[constants_1.FIELD_ANNOTATIONS.REFERENCE_TO],
                        field.annotations[constants_1.FIELD_ANNOTATIONS.RELATIONSHIP_NAME],
                        field.annotations[constants_1.FIELD_ANNOTATIONS.LENGTH]]))();
                    annotationsHandledInCtor = [
                        constants_1.FIELD_ANNOTATIONS.VALUE_SET,
                        constants_1.FIELD_ANNOTATIONS.RESTRICTED,
                        constants_1.VALUE_SET_DEFINITION_FIELDS.SORTED,
                        constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME,
                        constants_1.DEFAULT_VALUE_FORMULA,
                        constants_1.FIELD_ANNOTATIONS.LENGTH,
                        constants_1.FIELD_ANNOTATIONS.DEFAULT_VALUE,
                        adapter_api_1.CORE_ANNOTATIONS.REQUIRED,
                        constants_1.FIELD_ANNOTATIONS.RELATIONSHIP_NAME,
                        constants_1.FIELD_ANNOTATIONS.REFERENCE_TO,
                        constants_1.FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS,
                        constants_1.FIELD_ANNOTATIONS.FIELD_DEPENDENCY,
                    ];
                    internalUseAnnotations = [
                        constants_1.API_NAME,
                        constants_1.FIELD_ANNOTATIONS.CREATABLE,
                        constants_1.FIELD_ANNOTATIONS.UPDATEABLE,
                        constants_1.FIELD_ANNOTATIONS.QUERYABLE,
                        constants_1.INTERNAL_ID_ANNOTATION,
                    ];
                    _b = [annotationsHandledInCtor, internalUseAnnotations];
                    _c = exports.isCustom;
                    return [4 /*yield*/, exports.apiName(field)];
                case 2:
                    annotationsToSkip = __spreadArrays.apply(void 0, _b.concat([_c.apply(void 0, [_g.sent()]) ? [] : [constants_1.LABEL]]));
                    isAllowed = function (annotationName) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b, _c;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _a = omitInternalAnnotations;
                                    if (!_a) return [3 /*break*/, 2];
                                    _c = (_b = Object).keys;
                                    return [4 /*yield*/, field.getType()];
                                case 1:
                                    _a = _c.apply(_b, [(_d.sent()).annotationRefTypes]).includes(annotationName);
                                    _d.label = 2;
                                case 2: return [2 /*return*/, ((_a && !annotationsToSkip.includes(annotationName)) || (!omitInternalAnnotations && !annotationsHandledInCtor.includes(annotationName)))
                                    // Convert the annotations' names to the required API name
                                ];
                            }
                        });
                    }); };
                    // Convert the annotations' names to the required API name
                    _e = (_d = lodash_1["default"]).assign;
                    _f = [newField];
                    return [4 /*yield*/, pickAsync(field.annotations, function (_val, annotationName) { return isAllowed(annotationName); })];
                case 3:
                    // Convert the annotations' names to the required API name
                    _e.apply(_d, _f.concat([_g.sent()]));
                    return [2 /*return*/, newField];
            }
        });
    });
};
exports.toCustomField = toCustomField;
var isLocalOnly = function (field) { return (field !== undefined && field.annotations[constants_1.FIELD_ANNOTATIONS.LOCAL_ONLY] === true); };
exports.isLocalOnly = isLocalOnly;
var getCustomFields = function (element, skipFields) {
    return awu(Object.values(element.fields))
        .filter(function (field) { return !exports.isLocalOnly(field); })
        .map(function (field) { return exports.toCustomField(field); })
        .filter(function (field) { return !skipFields.includes(field.fullName); })
        .filter(function (field) { return constants_1.CUSTOM_FIELD_UPDATE_CREATE_ALLOWED_TYPES.includes(field.type); })
        .toArray();
};
var toCustomProperties = function (element, includeFields, skipFields) {
    if (skipFields === void 0) { skipFields = []; }
    return __awaiter(void 0, void 0, void 0, function () {
        var annotationsToSkip, isAllowed, _a, _b;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    annotationsToSkip = [
                        constants_1.API_NAME,
                        constants_1.METADATA_TYPE,
                        constants_1.INTERNAL_ID_ANNOTATION,
                        constants_1.KEY_PREFIX,
                    ];
                    isAllowed = function (annotationName) { return (Object.keys(element.annotationRefTypes).includes(annotationName)
                        && !annotationsToSkip.includes(annotationName)); };
                    _c = {};
                    return [4 /*yield*/, exports.apiName(element)];
                case 1:
                    _a = [(_c.fullName = _e.sent(), _c.label = element.annotations[constants_1.LABEL], _c)];
                    if (!includeFields) return [3 /*break*/, 3];
                    _d = {};
                    return [4 /*yield*/, getCustomFields(element, skipFields)];
                case 2:
                    _b = (_d.fields = _e.sent(), _d);
                    return [3 /*break*/, 4];
                case 3:
                    _b = {};
                    _e.label = 4;
                case 4: return [2 /*return*/, __assign.apply(void 0, [__assign.apply(void 0, _a.concat([_b])), lodash_1["default"].pickBy(element.annotations, function (_val, name) { return isAllowed(name); })])];
            }
        });
    });
};
exports.toCustomProperties = toCustomProperties;
var getValueTypeFieldElement = function (parent, field, knownTypes, additionalAnnotations) {
    var naclFieldType = (field.name === constants_1.INSTANCE_FULL_NAME_FIELD)
        ? adapter_api_1.BuiltinTypes.SERVICE_ID
        : knownTypes.get(field.soapType) || Types.get(field.soapType, false);
    var annotations = __assign({}, (additionalAnnotations || {}));
    if (field.picklistValues && field.picklistValues.length > 0) {
        // picklist values in metadata types are used to restrict a field to a list of allowed values
        // because some fields can allow all fields names / all object names this restriction list
        // might be very large and cause memory problems on parsing, so we choose to omit the
        // restriction where there are too many possible values
        if (field.picklistValues.length < constants_1.MAX_METADATA_RESTRICTION_VALUES) {
            annotations[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                enforce_value: false,
                values: lodash_1["default"].sortedUniq(field.picklistValues.map(function (val) { return val.value; }).sort()),
            });
        }
        var defaults = field.picklistValues
            .filter(function (val) { return val.defaultValue; })
            .map(function (val) { return val.value; });
        if (defaults.length === 1) {
            annotations[adapter_api_1.CORE_ANNOTATIONS.DEFAULT] = defaults.pop();
        }
    }
    if (field.isForeignKey) {
        annotations[constants_1.FOREIGN_KEY_DOMAIN] = makeArray(field.foreignKeyDomain);
    }
    return new adapter_api_1.Field(parent, field.name, naclFieldType, annotations);
};
exports.getValueTypeFieldElement = getValueTypeFieldElement;
var convertXsdTypeFuncMap = {
    'xsd:string': String,
    'xsd:boolean': function (v) { return v === 'true'; },
    'xsd:double': Number,
    'xsd:int': Number,
    'xsd:long': Number,
    'xsd:date': String,
    'xsd:dateTime': String,
    'xsd:picklist': String,
};
var isXsdType = function (xsdType) { return (xsdTypes.includes(xsdType)); };
var getXsdConvertFunc = function (xsdType) { return (isXsdType(xsdType) ? convertXsdTypeFuncMap[xsdType] : (function (v) { return v; })); };
// Salesforce returns nulls in metadata API as objects like { $: { 'xsi:nil': 'true' } }
// and in retrieve API like <activateRSS xsi:nil="true"/>
// which is transformed to { `${XML_ATTRIBUTE_PREFIX}xsi:nil`): 'true' }
var isNull = function (value) {
    return lodash_1["default"].isNull(value) || (lodash_1["default"].isObject(value)
        && (lodash_1["default"].get(value, ['$', 'xsi:nil']) === 'true'
            || lodash_1["default"].get(value, constants_1.XML_ATTRIBUTE_PREFIX + "xsi:nil") === 'true'));
};
exports.isNull = isNull;
var transformPrimitive = function (_a) {
    var value = _a.value, path = _a.path, field = _a.field;
    return __awaiter(void 0, void 0, void 0, function () {
        var convertFunc, fieldType;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (exports.isNull(value)) {
                        // We transform null to undefined as currently we don't support null in Salto language
                        // and the undefined values are omitted later in the code
                        return [2 /*return*/, undefined];
                    }
                    // (Salto-394) Salesforce returns objects like:
                    // { "_": "fieldValue", "$": { "xsi:type": "xsd:string" } }
                    if (lodash_1["default"].isObject(value) && Object.keys(value).includes('_')) {
                        convertFunc = getXsdConvertFunc(lodash_1["default"].get(value, ['$', 'xsi:type']));
                        return [2 /*return*/, exports.transformPrimitive({ value: convertFunc(lodash_1["default"].get(value, '_')), path: path, field: field })];
                    }
                    return [4 /*yield*/, (field === null || field === void 0 ? void 0 : field.getType())];
                case 1:
                    fieldType = _b.sent();
                    if (adapter_api_1.isContainerType(fieldType) && lodash_1["default"].isEmpty(value)) {
                        return [2 /*return*/, undefined];
                    }
                    if (adapter_api_1.isObjectType(fieldType) && value === '') {
                        // Salesforce returns empty objects in XML as <quickAction></quickAction> for example
                        // We treat them as "" (empty string), and we don't want to delete them
                        // We should replace them with {} (empty object)
                        return [2 /*return*/, {}];
                    }
                    if (!adapter_api_1.isPrimitiveType(fieldType) || !adapter_api_1.isPrimitiveValue(value)) {
                        return [2 /*return*/, value];
                    }
                    switch (fieldType.primitive) {
                        case adapter_api_1.PrimitiveTypes.NUMBER:
                            return [2 /*return*/, Number(value)];
                        case adapter_api_1.PrimitiveTypes.BOOLEAN:
                            return [2 /*return*/, value.toString().toLowerCase() === 'true'];
                        case adapter_api_1.PrimitiveTypes.STRING:
                            return [2 /*return*/, value.toString()];
                        default:
                            return [2 /*return*/, value];
                    }
                    return [2 /*return*/];
            }
        });
    });
};
exports.transformPrimitive = transformPrimitive;
var isDefaultWithType = function (val) { return new Set(lodash_1["default"].keys(val)).has('_'); };
var valueFromXsdType = function (val) {
    var convertFunc = getXsdConvertFunc(val.$['xsi:type']);
    return convertFunc(val._);
};
var getDefaultValue = function (field) {
    if (field.defaultValue === null || field.defaultValue === undefined) {
        return undefined;
    }
    return isDefaultWithType(field.defaultValue)
        ? valueFromXsdType(field.defaultValue) : field.defaultValue;
};
// The following method is used during the fetchy process and is used in building the objects
// and their fields described in the Nacl file
var getSObjectFieldElement = function (parent, field, parentServiceIds, objCompoundFieldNames, systemFields) {
    var _a, _b;
    if (objCompoundFieldNames === void 0) { objCompoundFieldNames = {}; }
    if (systemFields === void 0) { systemFields = []; }
    var fieldApiName = [parentServiceIds[constants_1.API_NAME], field.name].join(constants_1.API_NAME_SEPARATOR);
    var serviceIds = (_a = {},
        _a[constants_1.API_NAME] = fieldApiName,
        _a[adapter_api_1.OBJECT_SERVICE_ID] = adapter_api_1.toServiceIdsString(parentServiceIds),
        _a);
    var getFieldType = function (typeName) { return (Types.get(typeName, true, false, serviceIds)); };
    var naclFieldType = getFieldType(constants_1.FIELD_SOAP_TYPE_NAMES[field.type]);
    var annotations = (_b = {},
        _b[constants_1.API_NAME] = fieldApiName,
        _b[constants_1.LABEL] = field.label,
        _b);
    if (field.type !== 'boolean' && field.nillable === false) {
        // nillable is the closest thing we could find to infer if a field is required,
        // it might not be perfect
        // boolean (i.e. Checkbox) must not have required field
        annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true;
    }
    if (field.defaultValueFormula) {
        annotations[constants_1.DEFAULT_VALUE_FORMULA] = field.defaultValueFormula;
    }
    var defaultValue = getDefaultValue(field);
    if ((defaultValue !== undefined) && (lodash_1["default"].isEmpty(field.picklistValues))) {
        annotations[constants_1.FIELD_ANNOTATIONS.DEFAULT_VALUE] = defaultValue;
    }
    // Handle specific field types that need to be converted from their primitive type to their
    // Salesforce field type
    if (field.autoNumber) { // autonumber (needs to be first because its type in the field
        // returned from the API is string)
        naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.AUTONUMBER);
    }
    else if (field.idLookup && field.type === 'id') {
        naclFieldType = adapter_api_1.BuiltinTypes.SERVICE_ID;
    }
    else if (field.type === 'string' && !field.compoundFieldName) { // string
        naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.TEXT);
    }
    else if ((field.type === 'double' && !field.compoundFieldName)) {
        naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.NUMBER);
        annotations[constants_1.FIELD_ANNOTATIONS.PRECISION] = field.precision;
        annotations[constants_1.FIELD_ANNOTATIONS.SCALE] = field.scale;
    }
    else if (field.type === 'int') {
        naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.NUMBER);
        annotations[constants_1.FIELD_ANNOTATIONS.PRECISION] = field.digits;
    }
    else if (field.type === 'textarea' && field.length > 255) { // long text area & rich text area
        if (field.extraTypeInfo === 'plaintextarea') {
            naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.LONGTEXTAREA);
        }
        else if (field.extraTypeInfo === 'richtextarea') {
            naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.RICHTEXTAREA);
        }
    }
    else if (field.type === 'encryptedstring') { // encrypted string
        naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.ENCRYPTEDTEXT);
    }
    // Picklists
    if (field.picklistValues && field.picklistValues.length > 0) {
        addPicklistAnnotations(field.picklistValues, Boolean(field.restrictedPicklist), annotations);
        if (field.type === 'multipicklist') {
            // Precision is the field for multi-picklist in SFDC API that defines how many objects will
            // be visible in the picklist in the UI. Why? Because.
            annotations[constants_1.FIELD_ANNOTATIONS.VISIBLE_LINES] = field.precision;
        }
    }
    else if (field.calculated) {
        if (!lodash_1["default"].isEmpty(field.calculatedFormula)) {
            // Formulas
            naclFieldType = getFieldType(exports.formulaTypeName(naclFieldType.elemID.name));
            annotations[constants_1.FORMULA] = field.calculatedFormula;
        }
        else {
            // Rollup Summary
            naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.ROLLUP_SUMMARY);
        }
        // Lookup & MasterDetail
    }
    else if (field.type === 'reference') {
        if (field.cascadeDelete) {
            naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.MASTER_DETAIL);
            // master detail fields are always not required in SF although returned as nillable=false
            delete annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED];
            annotations[constants_1.FIELD_ANNOTATIONS.WRITE_REQUIRES_MASTER_READ] = Boolean(field.writeRequiresMasterRead);
            annotations[constants_1.FIELD_ANNOTATIONS.REPARENTABLE_MASTER_DETAIL] = Boolean(field.updateable);
        }
        else {
            naclFieldType = getFieldType(constants_1.FIELD_TYPE_NAMES.LOOKUP);
        }
        if (!lodash_1["default"].isEmpty(field.referenceTo)) {
            // todo: currently this field is populated with the referenced object's API name,
            //  should be modified to elemID reference once we'll use HIL
            // there are some SF reference fields without related fields
            // e.g. salesforce.user_app_menu_item.ApplicationId, salesforce.login_event.LoginHistoryId
            annotations[constants_1.FIELD_ANNOTATIONS.REFERENCE_TO] = field.referenceTo;
        }
        // Compound Fields
    }
    else if (!lodash_1["default"].isUndefined(constants_1.COMPOUND_FIELDS_SOAP_TYPE_NAMES[field.type]) || field.nameField) {
        // Only fields that are compound in this object get compound type
        if (objCompoundFieldNames[field.name] !== undefined) {
            naclFieldType = field.nameField
                // objCompoundFieldNames[field.name] is either 'Name' or 'Name2'
                ? Types.compoundDataTypes[objCompoundFieldNames[field.name]]
                : Types.compoundDataTypes[constants_1.COMPOUND_FIELDS_SOAP_TYPE_NAMES[field.type]];
        }
    }
    if (!lodash_1["default"].isEmpty(naclFieldType.annotationRefTypes)) {
        // Get the rest of the annotations if their name matches exactly the API response
        // and they are not already assigned
        lodash_1["default"].assign(annotations, lodash_1["default"].pick(lodash_1["default"].omit(field, Object.keys(annotations)), Object.keys(naclFieldType.annotationRefTypes)));
    }
    // mark all fields from the SOAP API as queryable (internal annotation)
    annotations[constants_1.FIELD_ANNOTATIONS.QUERYABLE] = true;
    // System fields besides name should be hidden and not be creatable, updateable nor required
    // Because they differ between envs and should not be edited through salto
    // Name is an exception because it can be editable and visible to the user
    if (!field.nameField && systemFields.includes(field.name)) {
        annotations[adapter_api_1.CORE_ANNOTATIONS.HIDDEN_VALUE] = true;
        annotations[constants_1.FIELD_ANNOTATIONS.UPDATEABLE] = false;
        annotations[constants_1.FIELD_ANNOTATIONS.CREATABLE] = false;
        delete annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED];
    }
    // An autoNumber field should be hidden because it will differ between enviorments
    // and not required to be able to add without it (ie. when moving envs)
    if (field.autoNumber) {
        annotations[adapter_api_1.CORE_ANNOTATIONS.HIDDEN_VALUE] = true;
        delete annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED];
    }
    var fieldName = Types.getElemId(adapter_utils_1.naclCase(field.name), true, serviceIds).name;
    return new adapter_api_1.Field(parent, fieldName, naclFieldType, annotations);
};
exports.getSObjectFieldElement = getSObjectFieldElement;
var toDeployableInstance = function (element) { return __awaiter(void 0, void 0, void 0, function () {
    var removeLocalOnly;
    return __generator(this, function (_a) {
        removeLocalOnly = function (_a) {
            var value = _a.value, field = _a.field;
            return ((exports.isLocalOnly(field))
                ? undefined
                : value);
        };
        return [2 /*return*/, adapter_utils_1.transformElement({
                element: element,
                transformFunc: removeLocalOnly,
                strict: false,
                allowEmpty: true,
            })];
    });
}); };
exports.toDeployableInstance = toDeployableInstance;
var fromMetadataInfo = function (info) { return info; };
exports.fromMetadataInfo = fromMetadataInfo;
var toMetadataInfo = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _b = {};
                return [4 /*yield*/, exports.apiName(instance)];
            case 1:
                _a = [(_b.fullName = _c.sent(), _b)];
                return [4 /*yield*/, exports.toDeployableInstance(instance)];
            case 2: return [2 /*return*/, (__assign.apply(void 0, _a.concat([(_c.sent()).value])))];
        }
    });
}); };
exports.toMetadataInfo = toMetadataInfo;
var createInstanceServiceIds = function (serviceIdsValues, type) {
    var _a;
    var typeServiceIds = function () {
        var _a;
        var serviceIds = (_a = {},
            _a[constants_1.METADATA_TYPE] = type.annotations[constants_1.METADATA_TYPE],
            _a);
        if (type.annotations[constants_1.API_NAME]) {
            serviceIds[constants_1.API_NAME] = type.annotations[constants_1.API_NAME];
        }
        return serviceIds;
    };
    return __assign(__assign({}, serviceIdsValues), (_a = {}, _a[adapter_api_1.OBJECT_SERVICE_ID] = adapter_api_1.toServiceIdsString(typeServiceIds()), _a));
};
exports.createInstanceServiceIds = createInstanceServiceIds;
exports.metadataAnnotationTypes = (_20 = {},
    _20[constants_1.METADATA_TYPE] = adapter_api_1.createRefToElmWithValue(adapter_api_1.BuiltinTypes.SERVICE_ID),
    _20.hasMetaFile = adapter_api_1.createRefToElmWithValue(adapter_api_1.BuiltinTypes.BOOLEAN),
    _20.folderType = adapter_api_1.createRefToElmWithValue(adapter_api_1.BuiltinTypes.STRING),
    _20.folderContentType = adapter_api_1.createRefToElmWithValue(adapter_api_1.BuiltinTypes.STRING),
    _20.suffix = adapter_api_1.createRefToElmWithValue(adapter_api_1.BuiltinTypes.STRING),
    _20.dirName = adapter_api_1.createRefToElmWithValue(adapter_api_1.BuiltinTypes.STRING),
    _20);
var isMetadataObjectType = function (elem) { return (adapter_api_1.isObjectType(elem) && elem.annotations[constants_1.METADATA_TYPE] !== undefined); };
exports.isMetadataObjectType = isMetadataObjectType;
var createMetadataObjectType = function (params) {
    var _a;
    return new adapter_api_1.ObjectType(__assign(__assign({ elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, params.annotations.metadataType) }, params), { fields: __assign((_a = {}, _a[constants_1.INSTANCE_FULL_NAME_FIELD] = {
            refType: adapter_api_1.BuiltinTypes.SERVICE_ID,
        }, _a), params.fields) }));
};
exports.createMetadataObjectType = createMetadataObjectType;
var assertMetadataObjectType = function (type) {
    if (!exports.isMetadataObjectType(type)) {
        throw new Error("This type (" + type.elemID.getFullName() + ") must be MetadataObjectType");
    }
    return type;
};
exports.assertMetadataObjectType = assertMetadataObjectType;
var isMetadataInstanceElement = function (elem) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = adapter_api_1.isInstanceElement(elem);
                if (!_a) return [3 /*break*/, 2];
                _b = exports.isMetadataObjectType;
                return [4 /*yield*/, elem.getType()];
            case 1:
                _a = _b.apply(void 0, [_c.sent()]);
                _c.label = 2;
            case 2: return [2 /*return*/, (_a && elem.value[constants_1.INSTANCE_FULL_NAME_FIELD] !== undefined)];
        }
    });
}); };
exports.isMetadataInstanceElement = isMetadataInstanceElement;
var createInstanceElement = function (values, type, namespacePrefix, annotations) {
    var fullName = values[constants_1.INSTANCE_FULL_NAME_FIELD];
    var getPackagePath = function () {
        if (namespacePrefix) {
            if (namespacePrefix === 'standard' || fullName === namespacePrefix) {
                // InstalledPackage records should be under records and not within their package
                // Some CustomApplications have 'standard' namespace although they are not part of a package
                return [constants_1.SALESFORCE];
            }
            return [constants_1.SALESFORCE, constants_1.INSTALLED_PACKAGES_PATH, namespacePrefix];
        }
        return [constants_1.SALESFORCE];
    };
    var typeName = adapter_utils_1.pathNaclCase(type.elemID.name);
    var name = Types.getElemId(fullName, true, exports.createInstanceServiceIds(lodash_1["default"].pick(values, constants_1.INSTANCE_FULL_NAME_FIELD), type)).name;
    return new adapter_api_1.InstanceElement(type.isSettings ? adapter_api_1.ElemID.CONFIG_NAME : name, type, values, __spreadArrays(getPackagePath(), [constants_1.RECORDS_PATH,
        type.isSettings ? constants_1.SETTINGS_PATH : typeName, adapter_utils_1.pathNaclCase(name)]), annotations);
};
exports.createInstanceElement = createInstanceElement;
var getAuthorAnnotations = function (fileProperties) {
    var _a, _b;
    var annotations = (_a = {},
        _a[adapter_api_1.CORE_ANNOTATIONS.CREATED_BY] = fileProperties === null || fileProperties === void 0 ? void 0 : fileProperties.createdByName,
        _a[adapter_api_1.CORE_ANNOTATIONS.CREATED_AT] = fileProperties === null || fileProperties === void 0 ? void 0 : fileProperties.createdDate,
        _a[adapter_api_1.CORE_ANNOTATIONS.CHANGED_AT] = fileProperties === null || fileProperties === void 0 ? void 0 : fileProperties.lastModifiedDate,
        _a);
    if ((fileProperties === null || fileProperties === void 0 ? void 0 : fileProperties.lastModifiedDate) !== constants_1.SALESFORCE_DATE_PLACEHOLDER) {
        Object.assign(annotations, (_b = {}, _b[adapter_api_1.CORE_ANNOTATIONS.CHANGED_BY] = fileProperties === null || fileProperties === void 0 ? void 0 : fileProperties.lastModifiedByName, _b));
    }
    return annotations;
};
exports.getAuthorAnnotations = getAuthorAnnotations;
var createIdField = function (parent) {
    var _a;
    parent.fields[constants_1.INTERNAL_ID_FIELD] = new adapter_api_1.Field(parent, constants_1.INTERNAL_ID_FIELD, adapter_api_1.BuiltinTypes.STRING, (_a = {},
        _a[adapter_api_1.CORE_ANNOTATIONS.HIDDEN_VALUE] = true,
        _a[constants_1.FIELD_ANNOTATIONS.LOCAL_ONLY] = true,
        _a));
};
var getTypePath = function (name, isTopLevelType) {
    if (isTopLevelType === void 0) { isTopLevelType = true; }
    return __spreadArrays([
        constants_1.SALESFORCE,
        constants_1.TYPES_PATH
    ], isTopLevelType ? [] : [constants_1.SUBTYPES_PATH], [
        name,
    ]);
};
exports.getTypePath = getTypePath;
var createMetadataTypeElements = function (_a) {
    var name = _a.name, fields = _a.fields, _b = _a.knownTypes, knownTypes = _b === void 0 ? new Map() : _b, baseTypeNames = _a.baseTypeNames, childTypeNames = _a.childTypeNames, client = _a.client, _c = _a.isSettings, isSettings = _c === void 0 ? false : _c, _d = _a.annotations, annotations = _d === void 0 ? {} : _d, _e = _a.missingFields, missingFields = _e === void 0 ? missing_fields_1.defaultMissingFields() : _e;
    return __awaiter(void 0, void 0, void 0, function () {
        var element, isTopLevelType, shouldCreateIdField, allFields, shouldEnrichFieldValue, enrichedFields, embeddedTypes, fieldElements;
        var _f;
        var _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    if (knownTypes.has(name)) {
                        // Already created this type, no new types to return here
                        return [2 /*return*/, []];
                    }
                    element = Types.get(name, false, isSettings);
                    knownTypes.set(name, element);
                    isTopLevelType = baseTypeNames.has(name) || annotations.folderContentType !== undefined;
                    element.annotationRefTypes = lodash_1["default"].clone(exports.metadataAnnotationTypes);
                    element.annotate(__assign(__assign({}, lodash_1["default"].pickBy(annotations, isDefined)), (_f = {}, _f[constants_1.METADATA_TYPE] = name, _f)));
                    element.path = exports.getTypePath(element.elemID.name, isTopLevelType);
                    shouldCreateIdField = function () { return ((isTopLevelType || childTypeNames.has(name))
                        && element.fields[constants_1.INTERNAL_ID_FIELD] === undefined); };
                    allFields = fields.concat((_g = missingFields[name]) !== null && _g !== void 0 ? _g : []);
                    if (lodash_1["default"].isEmpty(allFields)) {
                        if (shouldCreateIdField()) {
                            createIdField(element);
                        }
                        return [2 /*return*/, [element]];
                    }
                    shouldEnrichFieldValue = function (field) {
                        var isKnownType = function () {
                            return knownTypes.has(field.soapType) || baseTypeNames.has(field.soapType)
                                || adapter_api_1.isPrimitiveType(Types.get(field.soapType, false));
                        };
                        var startsWithUppercase = function () {
                            // covers types like base64Binary, anyType etc.
                            return field.soapType[0] === field.soapType[0].toUpperCase();
                        };
                        return lodash_1["default"].isEmpty(field.fields) && lodash_1["default"].isEmpty(field.picklistValues)
                            && !isKnownType() && startsWithUppercase();
                    };
                    return [4 /*yield*/, Promise.all(allFields.map(function (field) { return __awaiter(void 0, void 0, void 0, function () {
                            var innerFields;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!shouldEnrichFieldValue(field)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, client.describeMetadataType(field.soapType)];
                                    case 1:
                                        innerFields = _a.sent();
                                        return [2 /*return*/, __assign(__assign({}, field), { fields: innerFields.valueTypeFields })];
                                    case 2: return [2 /*return*/, field];
                                }
                            });
                        }); }))];
                case 1:
                    enrichedFields = _h.sent();
                    return [4 /*yield*/, Promise.all(enrichedFields
                            .filter(function (field) { return !baseTypeNames.has(field.soapType); })
                            .filter(function (field) { var _a; return !lodash_1["default"].isEmpty(field.fields.concat((_a = missingFields[field.soapType]) !== null && _a !== void 0 ? _a : [])); })
                            .flatMap(function (field) { return exports.createMetadataTypeElements({
                            name: field.soapType,
                            fields: makeArray(field.fields),
                            knownTypes: knownTypes,
                            baseTypeNames: baseTypeNames,
                            childTypeNames: childTypeNames,
                            client: client,
                            missingFields: missingFields,
                        }); }))
                        // Enum fields sometimes show up with a type name that is not primitive but also does not
                        // have fields (so we won't create an embedded type for it). it seems like these "empty" types
                        // are always supposed to be a string with some restriction so we map all non primitive "empty"
                        // types to string.
                        // Sometimes, we get known types without fields for some reason, in this case it is not an enum
                    ];
                case 2:
                    embeddedTypes = _h.sent();
                    // Enum fields sometimes show up with a type name that is not primitive but also does not
                    // have fields (so we won't create an embedded type for it). it seems like these "empty" types
                    // are always supposed to be a string with some restriction so we map all non primitive "empty"
                    // types to string.
                    // Sometimes, we get known types without fields for some reason, in this case it is not an enum
                    enrichedFields
                        .filter(function (field) { return lodash_1["default"].isEmpty(field.fields); })
                        .filter(function (field) { return !adapter_api_1.isPrimitiveType(Types.get(field.soapType, false)); })
                        .filter(function (field) { return !knownTypes.has(field.soapType); })
                        .filter(function (field) { return field.soapType !== name; })
                        .forEach(function (field) { return knownTypes.set(field.soapType, adapter_api_1.BuiltinTypes.STRING); });
                    fieldElements = enrichedFields.map(function (field) {
                        return exports.getValueTypeFieldElement(element, field, knownTypes);
                    });
                    // Set fields on elements
                    fieldElements.forEach(function (field) {
                        element.fields[field.name] = field;
                    });
                    if (shouldCreateIdField()) {
                        createIdField(element);
                    }
                    return [2 /*return*/, lodash_1["default"].flatten(__spreadArrays([element], embeddedTypes))];
            }
        });
    });
};
exports.createMetadataTypeElements = createMetadataTypeElements;
