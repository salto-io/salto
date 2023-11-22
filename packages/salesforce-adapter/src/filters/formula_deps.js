"use strict";
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
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var salesforce_formula_parser_1 = require("@salto-io/salesforce-formula-parser");
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var utils_1 = require("./utils");
var log = logging_1.logger(module);
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, groupByAsync = _a.groupByAsync;
var identifierTypeToElementName = function (identifierInfo) {
    if (identifierInfo.type === 'customLabel') {
        return [identifierInfo.instance];
    }
    if (identifierInfo.type === 'customMetadataTypeRecord') {
        var _a = identifierInfo.instance.split('.'), typeName = _a[0], instanceName = _a[1];
        return [typeName.slice(0, -1 * constants_1.CUSTOM_METADATA_SUFFIX.length) + "." + instanceName];
    }
    return identifierInfo.instance.split('.').slice(1);
};
var identifierTypeToElementType = function (identifierInfo) {
    if (identifierInfo.type === 'customLabel') {
        return 'CustomLabel';
    }
    return identifierInfo.instance.split('.')[0];
};
var identifierTypeToElemIdType = function (identifierInfo) { return ({
    standardObject: 'type',
    customMetadataType: 'type',
    customObject: 'type',
    customSetting: 'type',
    standardField: 'field',
    customField: 'field',
    customMetadataTypeRecord: 'instance',
    customLabel: 'instance',
}[identifierInfo.type]); };
var referencesFromIdentifiers = function (typeInfos) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (typeInfos
                .map(function (identifierInfo) { return (new (adapter_api_1.ElemID.bind.apply(adapter_api_1.ElemID, __spreadArrays([void 0, constants_1.SALESFORCE,
                adapter_utils_1.naclCase(identifierTypeToElementType(identifierInfo)),
                identifierTypeToElemIdType(identifierInfo)], identifierTypeToElementName(identifierInfo).map(adapter_utils_1.naclCase))))()); }))];
    });
}); };
var addDependenciesAnnotation = function (field, allElements) { return __awaiter(void 0, void 0, void 0, function () {
    var isValidReference, isSelfReference, referenceValidity, logInvalidReferences, formula, formulaIdentifiers_1, identifiersInfo, references, referencesWithValidity, depsAsRefExpr, e_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                isValidReference = function (elemId) { return __awaiter(void 0, void 0, void 0, function () {
                    var typeElemId, typeElement;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!(elemId.idType === 'type' || elemId.idType === 'instance')) return [3 /*break*/, 2];
                                return [4 /*yield*/, allElements.get(elemId)];
                            case 1: return [2 /*return*/, (_a.sent()) !== undefined];
                            case 2:
                                typeElemId = new adapter_api_1.ElemID(elemId.adapter, elemId.typeName);
                                return [4 /*yield*/, allElements.get(typeElemId)];
                            case 3:
                                typeElement = _a.sent();
                                return [2 /*return*/, (typeElement !== undefined) && (typeElement.fields[elemId.name] !== undefined)];
                        }
                    });
                }); };
                isSelfReference = function (elemId) { return (elemId.isEqual(field.parent.elemID)); };
                referenceValidity = function (elemId) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (isSelfReference(elemId)) {
                                    return [2 /*return*/, 'omitted'];
                                }
                                return [4 /*yield*/, isValidReference(elemId)];
                            case 1: return [2 /*return*/, (_a.sent()) ? 'valid' : 'invalid'];
                        }
                    });
                }); };
                logInvalidReferences = function (invalidReferences, formula, identifiersInfo) {
                    if (invalidReferences.length > 0) {
                        log.debug('When parsing the formula %o in field %o, one or more of the identifiers %o was parsed to an invalid reference: ', formula, field.elemID.getFullName(), identifiersInfo.flat().map(function (info) { return info.instance; }));
                    }
                    invalidReferences.forEach(function (refElemId) {
                        log.debug("Invalid reference: " + refElemId.getFullName());
                    });
                };
                formula = field.annotations[constants_1.FORMULA];
                if (formula === undefined) {
                    log.error("Field " + field.elemID.getFullName() + " is a formula field with no formula?");
                    return [2 /*return*/];
                }
                log.debug("Extracting formula refs from " + field.elemID.getFullName());
                _c.label = 1;
            case 1:
                _c.trys.push([1, 5, , 6]);
                formulaIdentifiers_1 = log.time(function () { return (salesforce_formula_parser_1.extractFormulaIdentifiers(formula)); }, "Parse formula '" + formula.slice(0, 15) + "'");
                return [4 /*yield*/, log.time(function () { return Promise.all(formulaIdentifiers_1.map(function (identifier) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, salesforce_formula_parser_1.parseFormulaIdentifier(identifier, field.parent.elemID.typeName)];
                    }); }); })); }, 'Convert formula identifiers to references')
                    // We check the # of refs before we filter bad refs out because otherwise the # of refs will be affected by the
                    // filtering.
                ];
            case 2:
                identifiersInfo = _c.sent();
                return [4 /*yield*/, referencesFromIdentifiers(identifiersInfo.flat())];
            case 3:
                references = (_c.sent());
                if (references.length < identifiersInfo.length) {
                    log.warn("Some formula identifiers were not converted to references.\n      Field: " + field.elemID.getFullName() + "\n      Formula: " + formula + "\n      Identifiers: " + identifiersInfo.flat().map(function (info) { return info.instance; }).join(', ') + "\n      References: " + references.map(function (ref) { return ref.getFullName(); }).join(', '));
                }
                return [4 /*yield*/, groupByAsync(references, referenceValidity)];
            case 4:
                referencesWithValidity = _c.sent();
                logInvalidReferences((_a = referencesWithValidity.invalid) !== null && _a !== void 0 ? _a : [], formula, identifiersInfo);
                depsAsRefExpr = ((_b = referencesWithValidity.valid) !== null && _b !== void 0 ? _b : [])
                    .map(function (elemId) { return ({ reference: new adapter_api_1.ReferenceExpression(elemId) }); });
                adapter_utils_1.extendGeneratedDependencies(field, depsAsRefExpr);
                return [3 /*break*/, 6];
            case 5:
                e_1 = _c.sent();
                log.warn("Failed to extract references from formula " + formula + ": " + e_1);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
var FILTER_NAME = 'formulaDeps';
/**
 * Extract references from formulas
 * Formulas appear in the field definitions of types and may refer to fields in their parent type or in another type.
 * This filter parses formulas, identifies such references and adds them to the _generated_references annotation of the
 * formula field.
 * Note: Currently (pending a fix to SALTO-3176) we only look at formula fields in custom objects.
 */
var filter = function (_a) {
    var config = _a.config;
    return ({
        name: FILTER_NAME,
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: 'Error while parsing formulas',
            config: config,
            filterName: FILTER_NAME,
            fetchFilterFunc: function (fetchedElements) { return __awaiter(void 0, void 0, void 0, function () {
                var fetchedObjectTypes, fetchedFormulaFields, allElements;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            fetchedObjectTypes = fetchedElements.filter(adapter_api_1.isObjectType);
                            return [4 /*yield*/, awu(fetchedObjectTypes)
                                    .flatMap(utils_1.extractFlatCustomObjectFields) // Get the types + their fields
                                    .filter(transformer_1.isFormulaField)
                                    .toArray()];
                        case 1:
                            fetchedFormulaFields = _a.sent();
                            allElements = utils_1.buildElementsSourceForFetch(fetchedElements, config);
                            return [4 /*yield*/, Promise.all(fetchedFormulaFields.map(function (field) { return addDependenciesAnnotation(field, allElements); }))];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filter;
