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
exports.__esModule = true;
exports.WARNING_MESSAGE = void 0;
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
var adapter_api_1 = require("@salto-io/adapter-api");
var logging_1 = require("@salto-io/logging");
var lodash_1 = require("lodash");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../../constants");
var transformer_1 = require("../../transformers/transformer");
var utils_1 = require("../utils");
var custom_objects_to_object_type_1 = require("../custom_objects_to_object_type");
var log = logging_1.logger(module);
var makeArray = lowerdash_1.collections.array.makeArray;
var isDefined = lowerdash_1.values.isDefined;
var getFieldNameParts = function (fileProperties) {
    return ({ fieldName: fileProperties.fullName.split('.')[1],
        objectName: fileProperties.fullName.split('.')[0] });
};
var getObjectFieldByFileProperties = function (fileProperties, object) {
    return object.fields[getFieldNameParts(fileProperties).fieldName];
};
var addAuthorAnnotationsToField = function (fileProperties, field) {
    if (!field) {
        return;
    }
    Object.assign(field.annotations, transformer_1.getAuthorAnnotations(fileProperties));
};
var getCustomObjectFileProperties = function (client) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, result, errors;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, client.listMetadataObjects({ type: constants_1.CUSTOM_OBJECT })];
            case 1:
                _a = _b.sent(), result = _a.result, errors = _a.errors;
                if (errors && errors.length > 0) {
                    log.warn("Encountered errors while listing file properties for CustomObjects: " + errors);
                }
                return [2 /*return*/, lodash_1["default"].keyBy(result, function (fileProp) { return fileProp.fullName; })];
        }
    });
}); };
var getCustomFieldFileProperties = function (client) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, result, errors;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, client.listMetadataObjects({ type: constants_1.CUSTOM_FIELD })];
            case 1:
                _a = _b.sent(), result = _a.result, errors = _a.errors;
                if (errors && errors.length > 0) {
                    log.warn("Encountered errors while listing file properties for CustomFields: " + errors);
                }
                return [2 /*return*/, lodash_1["default"](result).groupBy(function (fileProps) { return getFieldNameParts(fileProps).objectName; })
                        .mapValues(function (v) { return lodash_1["default"].keyBy(v, function (fileProps) { return getFieldNameParts(fileProps).fieldName; }); }).value()];
        }
    });
}); };
var setObjectAuthorInformation = function (_a) {
    var object = _a.object, typeFileProperties = _a.typeFileProperties, customFieldsFileProperties = _a.customFieldsFileProperties, nestedInstances = _a.nestedInstances;
    // Set author information on the CustomObject's fields
    Object.values(customFieldsFileProperties)
        .forEach(function (fileProp) {
        var field = getObjectFieldByFileProperties(fileProp, object);
        if (field === undefined) {
            return;
        }
        if (!lodash_1["default"].isEmpty(field.annotations[constants_1.INTERNAL_ID_ANNOTATION])) {
            field.annotations[constants_1.INTERNAL_ID_ANNOTATION] = fileProp.id;
        }
        addAuthorAnnotationsToField(fileProp, field);
    });
    // Set the latest AuthorInformation on the CustomObject
    var allAuthorInformation = [typeFileProperties ? utils_1.getAuthorInformationFromFileProps(typeFileProperties) : undefined]
        .concat(customFieldsFileProperties.map(utils_1.getAuthorInformationFromFileProps))
        .concat(nestedInstances.map(utils_1.getElementAuthorInformation))
        .filter(isDefined);
    var mostRecentAuthorInformation = lodash_1["default"].maxBy(allAuthorInformation, function (authorInfo) { return (authorInfo.changedAt !== undefined
        ? new Date(authorInfo.changedAt).getTime()
        : undefined); });
    if (mostRecentAuthorInformation) {
        object.annotations[adapter_api_1.CORE_ANNOTATIONS.CHANGED_BY] = mostRecentAuthorInformation.changedBy;
        object.annotations[adapter_api_1.CORE_ANNOTATIONS.CHANGED_AT] = mostRecentAuthorInformation.changedAt;
        // This info should always come from the FileProperties of the CustomObject.
        // Standard Objects won't have values here
        if (typeFileProperties) {
            object.annotations[adapter_api_1.CORE_ANNOTATIONS.CREATED_BY] = typeFileProperties.createdByName;
            object.annotations[adapter_api_1.CORE_ANNOTATIONS.CREATED_AT] = typeFileProperties.createdDate;
        }
    }
};
var CUSTOM_OBJECT_SUB_INSTANCES_METADATA_TYPES = new Set(Object.values(custom_objects_to_object_type_1.NESTED_INSTANCE_VALUE_TO_TYPE_NAME));
var isCustomObjectSubInstance = function (instance) { return (CUSTOM_OBJECT_SUB_INSTANCES_METADATA_TYPES.has(utils_1.metadataTypeSync(instance))); };
exports.WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.';
/*
 * add author information to object types and fields.
 */
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        name: 'customObjectAuthorFilter',
        remote: true,
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: exports.WARNING_MESSAGE,
            config: config,
            filterName: 'authorInformation',
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var customTypeFilePropertiesMap, customFieldsFilePropertiesMap, instancesByParent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getCustomObjectFileProperties(client)];
                        case 1:
                            customTypeFilePropertiesMap = _a.sent();
                            return [4 /*yield*/, getCustomFieldFileProperties(client)];
                        case 2:
                            customFieldsFilePropertiesMap = _a.sent();
                            instancesByParent = lodash_1["default"].groupBy(elements
                                .filter(utils_1.isMetadataInstanceElementSync)
                                .filter(utils_1.isElementWithResolvedParent), function (instance) {
                                // SALTO-4824
                                // eslint-disable-next-line no-underscore-dangle
                                var parent = instance.annotations._parent[0];
                                return utils_1.apiNameSync(parent.value);
                            });
                            elements
                                .filter(utils_1.isCustomObjectSync)
                                .forEach(function (object) {
                                var _a, _b, _c, _d;
                                var typeFileProperties = customTypeFilePropertiesMap[(_a = utils_1.apiNameSync(object)) !== null && _a !== void 0 ? _a : ''];
                                var fieldsPropertiesMap = (_c = customFieldsFilePropertiesMap[(_b = utils_1.apiNameSync(object)) !== null && _b !== void 0 ? _b : '']) !== null && _c !== void 0 ? _c : {};
                                setObjectAuthorInformation({
                                    object: object,
                                    typeFileProperties: typeFileProperties,
                                    customFieldsFileProperties: Object.values(fieldsPropertiesMap),
                                    nestedInstances: makeArray(instancesByParent[(_d = utils_1.apiNameSync(object)) !== null && _d !== void 0 ? _d : '']).filter(isCustomObjectSubInstance),
                                });
                            });
                            return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filterCreator;
