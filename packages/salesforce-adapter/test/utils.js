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
var _a;
exports.__esModule = true;
exports.defaultFilterContext = exports.createCustomSettingsObject = exports.generatePermissionSetType = exports.generateProfileType = exports.findFullCustomObject = exports.findAnnotationsObject = exports.findStandardFieldsObject = exports.findCustomFieldsObject = exports.createEncodedZipContent = exports.createValueSetEntry = exports.createCustomObjectType = exports.createMetadataTypeElement = exports.createField = exports.findElements = void 0;
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
var jszip_1 = require("jszip");
var constants = require("../src/constants");
var custom_type_split_1 = require("../src/filters/custom_type_split");
var utils_1 = require("../src/filters/utils");
var adapter_1 = require("../src/adapter");
var fetch_profile_1 = require("../src/fetch_profile/fetch_profile");
var findElements = function (elements) {
    var name = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        name[_i - 1] = arguments[_i];
    }
    var expectedElemId = name.length === 1
        ? new adapter_api_1.ElemID(constants.SALESFORCE, name[0])
        : new (adapter_api_1.ElemID.bind.apply(adapter_api_1.ElemID, __spreadArrays([void 0, constants.SALESFORCE, name[0], 'instance'], name.slice(1))))();
    return __spreadArrays(adapter_utils_1.findElements(elements, expectedElemId));
};
exports.findElements = findElements;
var createField = function (parent, fieldType, fieldApiName, additionalAnnotations) {
    var _a;
    var newField = new adapter_api_1.Field(parent, 'field', fieldType, __assign((_a = {}, _a[constants.API_NAME] = fieldApiName, _a.modifyMe = 'modifyMe', _a), additionalAnnotations));
    parent.fields.field = newField;
    return newField;
};
exports.createField = createField;
var createMetadataTypeElement = function (typeName, params) {
    var _a;
    return new adapter_api_1.ObjectType(__assign(__assign({}, params), { annotations: __assign(__assign({}, params.annotations), (_a = {}, _a[constants.METADATA_TYPE] = typeName, _a)), elemID: new adapter_api_1.ElemID(constants.SALESFORCE, typeName) }));
};
exports.createMetadataTypeElement = createMetadataTypeElement;
var createCustomObjectType = function (typeName, params) {
    var _a;
    return new adapter_api_1.ObjectType(__assign(__assign({}, params), { annotations: (_a = {},
            _a[constants.METADATA_TYPE] = constants.CUSTOM_OBJECT,
            _a[constants.API_NAME] = typeName,
            _a), elemID: new adapter_api_1.ElemID(constants.SALESFORCE, typeName) }));
};
exports.createCustomObjectType = createCustomObjectType;
var createValueSetEntry = function (name, defaultValue, label, isActive, color) {
    var _a;
    if (defaultValue === void 0) { defaultValue = false; }
    return lodash_1["default"].omitBy((_a = {},
        _a[constants.CUSTOM_VALUE.FULL_NAME] = name,
        _a[constants.CUSTOM_VALUE.LABEL] = label || name,
        _a[constants.CUSTOM_VALUE.DEFAULT] = defaultValue,
        _a.isActive = isActive,
        _a.color = color,
        _a), lodash_1["default"].isUndefined);
};
exports.createValueSetEntry = createValueSetEntry;
var createEncodedZipContent = function (files, encoding) {
    if (encoding === void 0) { encoding = 'base64'; }
    return __awaiter(void 0, void 0, void 0, function () {
        var zip;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    zip = new jszip_1["default"]();
                    files.forEach(function (file) { return zip.file(file.path, file.content); });
                    return [4 /*yield*/, zip.generateAsync({ type: 'nodebuffer' })];
                case 1: return [2 /*return*/, (_a.sent()).toString(encoding)];
            }
        });
    });
};
exports.createEncodedZipContent = createEncodedZipContent;
var findCustomFieldsObject = function (elements, name) {
    var customObjects = exports.findElements(elements, name);
    return customObjects
        .find(function (obj) { var _a; return ((_a = obj.path) === null || _a === void 0 ? void 0 : _a.slice(-1)[0]) === custom_type_split_1.customFieldsFileName(name); });
};
exports.findCustomFieldsObject = findCustomFieldsObject;
var findStandardFieldsObject = function (elements, name) {
    var customObjects = exports.findElements(elements, name);
    return customObjects
        .find(function (obj) { var _a; return ((_a = obj.path) === null || _a === void 0 ? void 0 : _a.slice(-1)[0]) === custom_type_split_1.standardFieldsFileName(name); });
};
exports.findStandardFieldsObject = findStandardFieldsObject;
var findAnnotationsObject = function (elements, name) {
    var customObjects = exports.findElements(elements, name);
    return customObjects
        .find(function (obj) { var _a; return ((_a = obj.path) === null || _a === void 0 ? void 0 : _a.slice(-1)[0]) === custom_type_split_1.annotationsFileName(name); });
};
exports.findAnnotationsObject = findAnnotationsObject;
var findFullCustomObject = function (elements, name) {
    var customObjects = exports.findElements(elements, name);
    return new adapter_api_1.ObjectType({
        elemID: customObjects[0].elemID,
        annotationRefsOrTypes: Object.fromEntries(customObjects.flatMap(function (obj) { return Object.entries(obj.annotationRefTypes); })),
        annotations: Object.fromEntries(customObjects.flatMap(function (obj) { return Object.entries(obj.annotations); })),
        fields: Object.fromEntries(customObjects.flatMap(function (obj) { return Object.entries(obj.fields); })),
        isSettings: customObjects[0].isSettings,
    });
};
exports.findFullCustomObject = findFullCustomObject;
var generateProfileType = function (useMaps, preDeploy) {
    var _a, _b, _c, _d, _e;
    if (useMaps === void 0) { useMaps = false; }
    if (preDeploy === void 0) { preDeploy = false; }
    var ProfileApplicationVisibility = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'ProfileApplicationVisibility'),
        fields: {
            application: { refType: adapter_api_1.BuiltinTypes.STRING },
            "default": { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
            visible: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        },
        annotations: (_a = {},
            _a[constants.METADATA_TYPE] = 'ProfileApplicationVisibility',
            _a),
    });
    var ProfileLayoutAssignment = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'ProfileLayoutAssignment'),
        fields: {
            layout: { refType: adapter_api_1.BuiltinTypes.STRING },
            recordType: { refType: adapter_api_1.BuiltinTypes.STRING },
        },
        annotations: (_b = {},
            _b[constants.METADATA_TYPE] = 'ProfileLayoutAssignment',
            _b),
    });
    var ProfileFieldLevelSecurity = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'ProfileFieldLevelSecurity'),
        fields: {
            field: { refType: adapter_api_1.BuiltinTypes.STRING },
            editable: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
            readable: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        },
        annotations: (_c = {},
            _c[constants.METADATA_TYPE] = 'ProfileFieldLevelSecurity',
            _c),
    });
    // we only define types as lists if they use non-unique maps - so for onDeploy, fieldPermissions
    // will not appear as a list unless conflicts were found during the previous fetch
    var fieldPermissionsNonMapType = preDeploy
        ? ProfileFieldLevelSecurity
        : new adapter_api_1.ListType(ProfileFieldLevelSecurity);
    if (useMaps || preDeploy) {
        // mark key fields as _required=true
        ProfileApplicationVisibility.fields.application.annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true;
        ProfileLayoutAssignment.fields.layout.annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true;
        ProfileFieldLevelSecurity.fields.field.annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true;
    }
    return new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants.SALESFORCE, constants.PROFILE_METADATA_TYPE),
        fields: (_d = {},
            _d[constants.INSTANCE_FULL_NAME_FIELD] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            _d.applicationVisibilities = { refType: useMaps
                    ? new adapter_api_1.MapType(ProfileApplicationVisibility)
                    : ProfileApplicationVisibility },
            _d.layoutAssignments = { refType: useMaps
                    ? new adapter_api_1.MapType(new adapter_api_1.ListType(ProfileLayoutAssignment))
                    : new adapter_api_1.ListType(ProfileLayoutAssignment) },
            _d.fieldPermissions = { refType: useMaps
                    ? new adapter_api_1.MapType(new adapter_api_1.MapType(ProfileFieldLevelSecurity))
                    : fieldPermissionsNonMapType },
            _d),
        annotations: (_e = {},
            _e[constants.METADATA_TYPE] = constants.PROFILE_METADATA_TYPE,
            _e),
    });
};
exports.generateProfileType = generateProfileType;
var generatePermissionSetType = function (useMaps, preDeploy) {
    var _a, _b, _c, _d;
    if (useMaps === void 0) { useMaps = false; }
    if (preDeploy === void 0) { preDeploy = false; }
    var PermissionSetApplicationVisibility = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'PermissionSetApplicationVisibility'),
        fields: {
            application: { refType: adapter_api_1.BuiltinTypes.STRING },
            "default": { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
            visible: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        },
        annotations: (_a = {},
            _a[constants.METADATA_TYPE] = 'PermissionSetApplicationVisibility',
            _a),
    });
    var PermissionSetFieldLevelSecurity = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'PermissionSetFieldLevelSecurity'),
        fields: {
            field: { refType: adapter_api_1.BuiltinTypes.STRING },
            editable: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
            readable: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
        },
        annotations: (_b = {},
            _b[constants.METADATA_TYPE] = 'PermissionSetFieldLevelSecurity',
            _b),
    });
    // we only define types as lists if they use non-unique maps - so for onDeploy, fieldPermissions
    // will not appear as a list unless conflicts were found during the previous fetch
    var fieldPermissionsNonMapType = preDeploy
        ? PermissionSetFieldLevelSecurity
        : new adapter_api_1.ListType(PermissionSetFieldLevelSecurity);
    if (useMaps || preDeploy) {
        // mark key fields as _required=true
        PermissionSetApplicationVisibility.fields.application
            .annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true;
        PermissionSetFieldLevelSecurity.fields.field.annotations[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true;
    }
    return new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants.SALESFORCE, constants.PROFILE_METADATA_TYPE),
        fields: (_c = {},
            _c[constants.INSTANCE_FULL_NAME_FIELD] = {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            _c.applicationVisibilities = { refType: useMaps
                    ? new adapter_api_1.MapType(PermissionSetApplicationVisibility)
                    : PermissionSetApplicationVisibility },
            _c.fieldPermissions = { refType: useMaps
                    ? new adapter_api_1.MapType(new adapter_api_1.MapType(PermissionSetFieldLevelSecurity))
                    : fieldPermissionsNonMapType },
            _c),
        annotations: (_d = {},
            _d[constants.METADATA_TYPE] = constants.PERMISSION_SET_METADATA_TYPE,
            _d),
    });
};
exports.generatePermissionSetType = generatePermissionSetType;
var stringType = new adapter_api_1.PrimitiveType({
    elemID: new adapter_api_1.ElemID(constants.SALESFORCE, 'Text'),
    primitive: adapter_api_1.PrimitiveTypes.STRING,
    annotationRefsOrTypes: (_a = {},
        _a[constants.LABEL] = adapter_api_1.BuiltinTypes.STRING,
        _a),
});
var idType = new adapter_api_1.PrimitiveType({
    elemID: new adapter_api_1.ElemID('id'),
    primitive: adapter_api_1.PrimitiveTypes.STRING,
});
var createCustomSettingsObject = function (name, settingsType) {
    var _a, _b, _c, _d, _e, _f;
    var namespace = utils_1.getNamespaceFromString(name);
    var basicFields = {
        Id: {
            refType: idType,
            label: 'id',
            annotations: (_a = {},
                _a[constants.FIELD_ANNOTATIONS.QUERYABLE] = true,
                _a[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = false,
                _a[constants.LABEL] = 'Record ID',
                _a[constants.API_NAME] = 'Id',
                _a),
        },
        Name: {
            refType: stringType,
            label: 'Name',
            annotations: (_b = {},
                _b[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = false,
                _b[constants.LABEL] = 'Name',
                _b[constants.API_NAME] = 'Name',
                _b[constants.FIELD_ANNOTATIONS.CREATABLE] = true,
                _b[constants.FIELD_ANNOTATIONS.QUERYABLE] = true,
                _b),
        },
        // eslint-disable-next-line camelcase
        TestField__c: {
            label: 'TestField',
            refType: stringType,
            annotations: (_c = {},
                _c[constants.LABEL] = 'TestField',
                _c[constants.API_NAME] = name + ".TestField__c",
                _c[constants.FIELD_ANNOTATIONS.CREATABLE] = true,
                _c[constants.FIELD_ANNOTATIONS.QUERYABLE] = true,
                _c),
            annotationRefsOrTypes: (_d = {},
                _d[constants.LABEL] = adapter_api_1.BuiltinTypes.STRING,
                _d[constants.API_NAME] = adapter_api_1.BuiltinTypes.STRING,
                _d),
        },
    };
    var obj = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants.SALESFORCE, name),
        annotations: (_e = {},
            _e[constants.API_NAME] = name,
            _e[constants.METADATA_TYPE] = constants.CUSTOM_OBJECT,
            _e[constants.CUSTOM_SETTINGS_TYPE] = settingsType,
            _e),
        annotationRefsOrTypes: (_f = {},
            _f[constants.CUSTOM_SETTINGS_TYPE] = adapter_api_1.BuiltinTypes.STRING,
            _f[constants.METADATA_TYPE] = adapter_api_1.BuiltinTypes.STRING,
            _f),
        fields: basicFields,
    });
    var path = namespace
        ? [constants.SALESFORCE, constants.INSTALLED_PACKAGES_PATH, namespace,
            constants.OBJECTS_PATH, obj.elemID.name]
        : [constants.SALESFORCE, constants.OBJECTS_PATH, obj.elemID.name];
    obj.path = path;
    return obj;
};
exports.createCustomSettingsObject = createCustomSettingsObject;
exports.defaultFilterContext = {
    systemFields: adapter_1.SYSTEM_FIELDS,
    fetchProfile: fetch_profile_1.buildFetchProfile({}),
    elementsSource: adapter_utils_1.buildElementsSourceFromElements([]),
    enumFieldPermissions: false,
};
