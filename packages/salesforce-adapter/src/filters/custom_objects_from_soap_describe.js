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
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var config_change_1 = require("../config_change");
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, keyByAsync = _a.keyByAsync;
var makeArray = lowerdash_1.collections.array.makeArray;
var createFieldValue = function (field, objectName, objCompoundFieldNames, systemFields) { return __awaiter(void 0, void 0, void 0, function () {
    var tmpObj, dummyField, customField, fieldValues;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tmpObj = new adapter_api_1.ObjectType({ elemID: new adapter_api_1.ElemID('salesforce', objectName) });
                dummyField = transformer_1.getSObjectFieldElement(tmpObj, field, { apiName: objectName }, objCompoundFieldNames, systemFields);
                return [4 /*yield*/, transformer_1.toCustomField(dummyField, false)
                    // continuation of the temporary hack, since toCustomField returns values with JS classes
                    // The "JSON.parse" part is done to get just the properties without the classes
                    // The "_.pickBy" is to avoid undefined values that cause things to crash down the line
                    // Using JSON.stringify and not safeJsonStringify for performance and because the values here
                    // were JSON initially and should be safe to convert back
                ];
            case 1:
                customField = _a.sent();
                fieldValues = lodash_1["default"].pickBy(
                // eslint-disable-next-line no-restricted-syntax
                JSON.parse(JSON.stringify(customField)), lowerdash_1.values.isDefined);
                return [2 /*return*/, fieldValues];
        }
    });
}); };
var addSObjectInformationToInstance = function (instance, sobject, systemFields) { return __awaiter(void 0, void 0, void 0, function () {
    var fieldsFromMetadataApi, getCompoundTypeName, objCompoundFieldNames, sobjectFields;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                // Add information to the object type
                lodash_1["default"].defaults(instance.value, {
                    keyPrefix: sobject.keyPrefix,
                    label: sobject.label,
                });
                // Fix fields type in case it is not an array yet
                // this can happen if there is just one field, or if there are no fields
                instance.value.fields = makeArray(instance.value.fields);
                fieldsFromMetadataApi = lodash_1["default"].keyBy(instance.value.fields, function (field) { return field.fullName; });
                getCompoundTypeName = function (nestedFields, compoundName) {
                    if (compoundName === constants_1.COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME) {
                        return nestedFields.some(function (field) { return field.name === constants_1.NAME_FIELDS.SALUTATION; })
                            ? constants_1.COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME
                            : constants_1.COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME_NO_SALUTATION;
                    }
                    return compoundName;
                };
                objCompoundFieldNames = lodash_1["default"].mapValues(lodash_1["default"].groupBy(sobject.fields.filter(function (field) { return field.compoundFieldName !== undefined; }), function (field) { return field.compoundFieldName; }), getCompoundTypeName);
                return [4 /*yield*/, Promise.all(sobject.fields
                        .filter(function (field) { return !field.compoundFieldName; }) // Filter out nested fields of compound fields
                        .map(function (field) { return createFieldValue(field, sobject.name, objCompoundFieldNames, systemFields); }))];
            case 1:
                sobjectFields = _a.sent();
                sobjectFields.forEach(function (sobjectField) {
                    var existingField = fieldsFromMetadataApi[sobjectField.fullName];
                    if (existingField !== undefined) {
                        lodash_1["default"].defaults(existingField, sobjectField);
                    }
                    else {
                        instance.value.fields.push(sobjectField);
                    }
                });
                return [2 /*return*/];
        }
    });
}); };
var WARNING_MESSAGE = 'Encountered an error while trying to fetch additional information about Custom Objects';
/**
 * Custom objects filter.
 * Fetches the custom objects via the soap api and adds them to the elements
 */
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        onFetch: utils_1.ensureSafeFilterFetch({
            filterName: 'describeSObjects',
            warningMessage: WARNING_MESSAGE,
            config: config,
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var customObjectInstances, availableObjects, potentialObjectNames, objectNamesToDescribe, _a, sObjects, errors;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, keyByAsync(awu(elements).filter(adapter_api_1.isInstanceElement).filter(utils_1.isInstanceOfType(constants_1.CUSTOM_OBJECT)), function (instance) { return transformer_1.apiName(instance); })];
                        case 1:
                            customObjectInstances = _b.sent();
                            if (lodash_1["default"].isEmpty(customObjectInstances)) {
                                // Not fetching custom objects, no need to do anything
                                return [2 /*return*/, {}];
                            }
                            return [4 /*yield*/, client.listSObjects()];
                        case 2:
                            availableObjects = _b.sent();
                            potentialObjectNames = new Set(Object.keys(customObjectInstances));
                            objectNamesToDescribe = availableObjects
                                .map(function (objDesc) { return objDesc.name; })
                                .filter(function (name) { return potentialObjectNames.has(name); });
                            return [4 /*yield*/, client.describeSObjects(objectNamesToDescribe)];
                        case 3:
                            _a = _b.sent(), sObjects = _a.result, errors = _a.errors;
                            return [4 /*yield*/, Promise.all(sObjects.map(function (description) { return addSObjectInformationToInstance(customObjectInstances[description.name], description, config.systemFields); }))];
                        case 4:
                            _b.sent();
                            return [2 /*return*/, {
                                    configSuggestions: errors
                                        .map(function (_a) {
                                        var input = _a.input, error = _a.error;
                                        return config_change_1.createSkippedListConfigChangeFromError({
                                            creatorInput: { metadataType: constants_1.CUSTOM_OBJECT, name: input },
                                            error: error,
                                        });
                                    }),
                                }];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filterCreator;
