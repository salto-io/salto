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
var logging_1 = require("@salto-io/logging");
var adapter_api_1 = require("@salto-io/adapter-api");
var lowerdash_1 = require("@salto-io/lowerdash");
var utils_1 = require("./utils");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var log = logging_1.logger(module);
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, keyByAsync = _a.keyByAsync;
var makeArray = lowerdash_1.collections.array.makeArray;
var isDefined = lowerdash_1.values.isDefined;
var SUPPORTED_FIELD_TYPE_NAMES = [
    constants_1.FIELD_TYPE_NAMES.CHECKBOX, constants_1.FIELD_TYPE_NAMES.METADATA_RELATIONSHIP,
    constants_1.FIELD_TYPE_NAMES.DATE, constants_1.FIELD_TYPE_NAMES.DATETIME,
    constants_1.FIELD_TYPE_NAMES.PICKLIST, constants_1.FIELD_TYPE_NAMES.TEXT,
    constants_1.FIELD_TYPE_NAMES.PHONE, constants_1.FIELD_TYPE_NAMES.TEXTAREA, constants_1.FIELD_TYPE_NAMES.LONGTEXTAREA,
    constants_1.FIELD_TYPE_NAMES.URL, constants_1.FIELD_TYPE_NAMES.EMAIL,
    constants_1.FIELD_TYPE_NAMES.NUMBER, constants_1.FIELD_TYPE_NAMES.PERCENT,
];
var FIELD_TYPE_TO_XSD_TYPE = {
    LongTextArea: 'xsd:string',
    MetadataRelationship: 'xsd:string',
    Checkbox: 'xsd:boolean',
    Date: 'xsd:date',
    DateTime: 'xsd:dateTime',
    Email: 'xsd:string',
    Number: 'xsd:double',
    Percent: 'xsd:double',
    Phone: 'xsd:string',
    Picklist: 'xsd:string',
    Text: 'xsd:string',
    TextArea: 'xsd:string',
    Url: 'xsd:string',
};
var isServiceMDTRecordFieldValue = function (value) { return (lodash_1["default"].isString(value.field)
    && (value.value === undefined
        || transformer_1.isNull(value.value)
        || lodash_1["default"].isString(value.value[constants_1.XML_ATTRIBUTE_PREFIX + "xsi:type"]))); };
var isServiceMDTRecordValues = function (value) { return ('values' in value
    && makeArray(value.values).every(isServiceMDTRecordFieldValue)); };
var serviceFieldValueToNaclValue = function (value) { return (__assign({ field: value.field }, transformer_1.isNull(value.value)
    ? {}
    : { value: lodash_1["default"].get(value.value, '#text'), type: lodash_1["default"].get(value.value, 'attr_xsi:type') })); };
var additionalNamespaces = Object.fromEntries([
    [constants_1.XML_ATTRIBUTE_PREFIX + "xmlns:xsd", 'http://www.w3.org/2001/XMLSchema'],
    [constants_1.XML_ATTRIBUTE_PREFIX + "xmlns:xsi", 'http://www.w3.org/2001/XMLSchema-instance'],
]);
var getCustomMetadataType = function (instance, customMetadataTypes) { return __awaiter(void 0, void 0, void 0, function () {
    var customMetadataTypeName;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, transformer_1.apiName(instance)];
            case 1:
                customMetadataTypeName = (_a.sent()).split('.')[0].concat(constants_1.CUSTOM_METADATA_SUFFIX);
                return [2 /*return*/, awu(customMetadataTypes)
                        .find(function (objectType) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, transformer_1.apiName(objectType)];
                            case 1: return [2 /*return*/, (_a.sent()) === customMetadataTypeName];
                        }
                    }); }); })];
        }
    });
}); };
var extractValuesToFields = function (recordValues) { return Object.fromEntries(makeArray(recordValues === null || recordValues === void 0 ? void 0 : recordValues.values)
    .map(serviceFieldValueToNaclValue)
    .filter(function (_a) {
    var value = _a.value;
    return isDefined(value);
})
    .map(function (_a) {
    var field = _a.field, value = _a.value;
    return [field, value];
})); };
var formatMDTRecordValuesToNacl = function (values) { return (lodash_1["default"].omit(__assign(__assign({}, values), extractValuesToFields(values)), 'values', Object.keys(additionalNamespaces))); };
var iSupportedFieldTypeName = function (fieldTypeName) { return (SUPPORTED_FIELD_TYPE_NAMES.includes(fieldTypeName)); };
var getFieldXsdType = function (field) { return __awaiter(void 0, void 0, void 0, function () {
    var fieldTypeName;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, field.getType()];
            case 1:
                fieldTypeName = (_a.sent()).elemID.typeName;
                if (!iSupportedFieldTypeName(fieldTypeName)) {
                    log.warn('Unsupported field type %s on field %s', fieldTypeName, field.elemID.getFullName());
                    return [2 /*return*/, undefined];
                }
                return [2 /*return*/, FIELD_TYPE_TO_XSD_TYPE[fieldTypeName]];
        }
    });
}); };
var formatRecordValuesForService = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceType, values;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, instance.getType()];
            case 1:
                instanceType = _a.sent();
                return [4 /*yield*/, awu(Object.entries(instanceType.fields))
                        .filter(function (_a) {
                        var fieldName = _a[0];
                        return fieldName.endsWith(constants_1.SALESFORCE_CUSTOM_SUFFIX);
                    })
                        .map(function (_a) {
                        var fieldName = _a[0], field = _a[1];
                        return __awaiter(void 0, void 0, void 0, function () {
                            var fieldValue, xsdType;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, instance.value[fieldName]];
                                    case 1:
                                        fieldValue = _b.sent();
                                        return [4 /*yield*/, getFieldXsdType(field)];
                                    case 2:
                                        xsdType = _b.sent();
                                        if (isDefined(fieldValue) && isDefined(xsdType)) {
                                            return [2 /*return*/, {
                                                    field: fieldName,
                                                    value: { '#text': fieldValue, 'attr_xsi:type': xsdType },
                                                }];
                                        }
                                        return [2 /*return*/, {
                                                field: fieldName,
                                                value: { 'attr_xsi:nil': 'true' },
                                            }];
                                }
                            });
                        });
                    }).toArray()];
            case 2:
                values = _a.sent();
                return [2 /*return*/, __assign(__assign(__assign({}, additionalNamespaces), lodash_1["default"].omit(instance.value, constants_1.INTERNAL_ID_FIELD, Object.keys(instance.value).filter(function (k) { return k.endsWith(constants_1.SALESFORCE_CUSTOM_SUFFIX); }))), { values: values })];
        }
    });
}); };
var getInstanceWithCorrectType = function (instance, customMetadataRecordTypes) { return __awaiter(void 0, void 0, void 0, function () {
    var correctType, formattedValues;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getCustomMetadataType(instance, customMetadataRecordTypes)];
            case 1:
                correctType = _a.sent();
                if (lodash_1["default"].isUndefined(correctType)) {
                    log.warn('Could not fix type for CustomMetadataType Instance %s, since its CustomMetadata record type was not found', instance.elemID.getFullName());
                    return [2 /*return*/, undefined];
                }
                formattedValues = isServiceMDTRecordValues(instance.value)
                    ? formatMDTRecordValuesToNacl(instance.value)
                    : instance.value;
                if (!utils_1.isMetadataValues(formattedValues)) {
                    log.warn('CustomMetadata instance %s is missing the fullName field, skipping.', instance.elemID.getFullName());
                    return [2 /*return*/, undefined];
                }
                return [2 /*return*/, transformer_1.createInstanceElement(formattedValues, correctType)];
        }
    });
}); };
var CUSTOM_METADATA_TYPE = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'CustomMetadata'),
    annotations: {
        suffix: 'md',
        dirName: 'customMetadata',
        metadataType: 'CustomMetadata',
    },
});
var toDeployableChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var deployableAfter, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = transformer_1.createInstanceElement;
                return [4 /*yield*/, formatRecordValuesForService(adapter_api_1.getChangeData(change))];
            case 1:
                deployableAfter = _a.apply(void 0, [_b.sent(), CUSTOM_METADATA_TYPE]);
                return [2 /*return*/, adapter_api_1.isModificationChange(change)
                        ? adapter_api_1.toChange({ before: change.data.before, after: deployableAfter })
                        : adapter_api_1.toChange({ after: deployableAfter })];
        }
    });
}); };
var filterCreator = function () {
    var originalChangesByApiName;
    return {
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var customMetadataRecordTypes, oldInstances, newInstances;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(elements)
                            .filter(adapter_api_1.isObjectType)
                            .filter(utils_1.isCustomMetadataRecordType)
                            .toArray()];
                    case 1:
                        customMetadataRecordTypes = _a.sent();
                        return [4 /*yield*/, awu(elements)
                                .filter(adapter_api_1.isInstanceElement)
                                .filter(utils_1.isInstanceOfType(constants_1.CUSTOM_METADATA))
                                .toArray()];
                    case 2:
                        oldInstances = _a.sent();
                        return [4 /*yield*/, awu(oldInstances)
                                .map(function (instance) { return getInstanceWithCorrectType(instance, customMetadataRecordTypes); })
                                .filter(isDefined)
                                .toArray()];
                    case 3:
                        newInstances = _a.sent();
                        lodash_1["default"].pullAll(elements, oldInstances);
                        elements.push.apply(elements, newInstances);
                        return [2 /*return*/];
                }
            });
        }); },
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var originalChanges, deployableChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(adapter_api_1.isInstanceChange)
                            .filter(adapter_api_1.isAdditionOrModificationChange)
                            .filter(function (change) { return utils_1.isCustomMetadataRecordInstance(adapter_api_1.getChangeData(change)); })
                            .toArray()];
                    case 1:
                        originalChanges = _a.sent();
                        return [4 /*yield*/, keyByAsync(originalChanges, function (c) { return transformer_1.apiName(adapter_api_1.getChangeData(c)); })];
                    case 2:
                        originalChangesByApiName = _a.sent();
                        return [4 /*yield*/, awu(originalChanges).map(toDeployableChange).toArray()];
                    case 3:
                        deployableChanges = _a.sent();
                        lodash_1["default"].pullAll(changes, originalChanges);
                        deployableChanges.forEach(function (change) { return changes.push(change); });
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var appliedChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(adapter_api_1.isInstanceChange)
                            .filter(adapter_api_1.isAdditionOrModificationChange)
                            .filter(function (change) { return utils_1.isInstanceOfType(constants_1.CUSTOM_METADATA)(adapter_api_1.getChangeData(change)); })
                            .toArray()];
                    case 1:
                        appliedChanges = _a.sent();
                        lodash_1["default"].pullAll(changes, appliedChanges);
                        return [4 /*yield*/, awu(appliedChanges).forEach(function (appliedChange) { return __awaiter(void 0, void 0, void 0, function () {
                                var name;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, transformer_1.apiName(adapter_api_1.getChangeData(appliedChange))];
                                        case 1:
                                            name = _a.sent();
                                            changes.push(originalChangesByApiName[name]);
                                            return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
    };
};
exports["default"] = filterCreator;
