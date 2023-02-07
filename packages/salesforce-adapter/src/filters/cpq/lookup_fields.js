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
var _a, _b, _c, _d, _e, _f, _g;
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
var adapter_utils_1 = require("@salto-io/adapter-utils");
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../../transformers/transformer");
var constants_1 = require("../../constants");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
var isCustomFieldLookupDef = function (lookupDef) { return (lookupDef.type === constants_1.CUSTOM_FIELD); };
var LOOKUP_FIELDS = (_a = {},
    _a[constants_1.CPQ_PRODUCT_RULE] = (_b = {},
        _b[constants_1.CPQ_LOOKUP_OBJECT_NAME] = {
            type: constants_1.CUSTOM_OBJECT,
        },
        _b),
    _a[constants_1.CPQ_PRICE_RULE] = (_c = {},
        _c[constants_1.CPQ_LOOKUP_OBJECT_NAME] = {
            type: constants_1.CUSTOM_OBJECT,
        },
        _c),
    _a[constants_1.CPQ_CONFIGURATION_ATTRIBUTE] = (_d = {},
        _d[constants_1.CPQ_DEFAULT_OBJECT_FIELD] = {
            type: constants_1.CUSTOM_OBJECT,
            valuesMapping: constants_1.DEFAULT_OBJECT_TO_API_MAPPING,
        },
        _d),
    _a[constants_1.CPQ_LOOKUP_QUERY] = (_e = {},
        _e[constants_1.CPQ_TESTED_OBJECT] = {
            type: constants_1.CUSTOM_OBJECT,
            valuesMapping: constants_1.TEST_OBJECT_TO_API_MAPPING,
        },
        _e),
    _a[constants_1.CPQ_PRICE_SCHEDULE] = (_f = {},
        _f[constants_1.CPQ_CONSTRAINT_FIELD] = {
            type: constants_1.CUSTOM_FIELD,
            objectContext: constants_1.CPQ_QUOTE,
            valuesMapping: constants_1.SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING,
        },
        _f),
    _a[constants_1.CPQ_DISCOUNT_SCHEDULE] = (_g = {},
        _g[constants_1.CPQ_CONSTRAINT_FIELD] = {
            type: constants_1.CUSTOM_FIELD,
            objectContext: constants_1.CPQ_QUOTE,
            valuesMapping: constants_1.SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING,
        },
        _g),
    _a);
var getLookupFields = function (object) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b, _c, _d, _e, _f, _g, _h; return __generator(this, function (_j) {
    switch (_j.label) {
        case 0:
            _b = (_a = Object).values;
            _d = (_c = lodash_1["default"]).pick;
            _e = [object.fields];
            _g = (_f = Object).keys;
            _h = LOOKUP_FIELDS;
            return [4 /*yield*/, transformer_1.apiName(object)];
        case 1: return [2 /*return*/, (_b.apply(_a, [_d.apply(_c, _e.concat([_g.apply(_f, [_h[_j.sent()]])]))]))];
    }
}); }); };
var transformLookupValueSetFullNames = function (lookupField, transformFullNameFn) { return __awaiter(void 0, void 0, void 0, function () {
    var lookupValueSet, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                lookupValueSet = lookupField.annotations[constants_1.FIELD_ANNOTATIONS.VALUE_SET];
                if (lookupValueSet === undefined) {
                    return [2 /*return*/, lookupField];
                }
                _a = lookupField.annotations;
                _b = constants_1.FIELD_ANNOTATIONS.VALUE_SET;
                return [4 /*yield*/, awu(lookupValueSet).map(function (value) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a, _b, _c;
                        var _d;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _a = [__assign({}, value)];
                                    _d = {};
                                    _b = transformFullNameFn;
                                    return [4 /*yield*/, transformer_1.apiName(lookupField.parent)];
                                case 1:
                                    _c = [_e.sent()];
                                    return [4 /*yield*/, transformer_1.apiName(lookupField, true)];
                                case 2: return [2 /*return*/, (__assign.apply(void 0, _a.concat([(_d.fullName = _b.apply(void 0, _c.concat([_e.sent(), value.fullName])), _d)])))];
                            }
                        });
                    }); }).toArray()];
            case 1:
                _a[_b] = _c.sent();
                return [2 /*return*/, lookupField];
        }
    });
}); };
var transformObjectLookupValueSetFullNames = function (object, transformFullNameFn) { return __awaiter(void 0, void 0, void 0, function () {
    var lookupFields;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getLookupFields(object)];
            case 1:
                lookupFields = _a.sent();
                lookupFields.forEach(function (field) { return transformLookupValueSetFullNames(field, transformFullNameFn); });
                return [2 /*return*/, object];
        }
    });
}); };
var replaceLookupObjectValueSetValuesWithReferences = function (customObjects) { return __awaiter(void 0, void 0, void 0, function () {
    var apiNameToCustomObject, _a, _b, relevantObjects, transformFullNameToRef;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _b = (_a = Object).fromEntries;
                return [4 /*yield*/, awu(customObjects)
                        .map(function (object) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, transformer_1.apiName(object)];
                            case 1: return [2 /*return*/, [_a.sent(), object]];
                        }
                    }); }); })
                        .toArray()];
            case 1:
                apiNameToCustomObject = _b.apply(_a, [_c.sent()]);
                return [4 /*yield*/, awu(customObjects)
                        .filter(function (object) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                _b = (_a = Object.keys(LOOKUP_FIELDS)).includes;
                                return [4 /*yield*/, transformer_1.apiName(object)];
                            case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                        }
                    }); }); })
                        .toArray()];
            case 2:
                relevantObjects = _c.sent();
                transformFullNameToRef = function (objectApiName, fieldName, fullName) {
                    var _a, _b, _c, _d;
                    var lookupDef = (_a = LOOKUP_FIELDS[objectApiName]) === null || _a === void 0 ? void 0 : _a[fieldName];
                    if (lookupDef === undefined) {
                        return undefined;
                    }
                    var nameToApiMapping = (_b = lookupDef.valuesMapping) !== null && _b !== void 0 ? _b : {};
                    var mappedFullName = (_c = nameToApiMapping[fullName]) !== null && _c !== void 0 ? _c : fullName;
                    var elementToRef = isCustomFieldLookupDef(lookupDef)
                        ? (_d = apiNameToCustomObject[lookupDef.objectContext]) === null || _d === void 0 ? void 0 : _d.fields[mappedFullName] : apiNameToCustomObject[mappedFullName];
                    return (elementToRef !== undefined
                        ? new adapter_api_1.ReferenceExpression(elementToRef.elemID) : fullName);
                };
                relevantObjects.forEach(function (object) { return (transformObjectLookupValueSetFullNames(object, transformFullNameToRef)); });
                return [2 /*return*/];
        }
    });
}); };
var transformFullNameToApiName = function (objectApiName, fieldName, fullName) {
    var _a, _b, _c;
    var lookupDef = (_a = LOOKUP_FIELDS[objectApiName]) === null || _a === void 0 ? void 0 : _a[fieldName];
    if (lookupDef === undefined) {
        return undefined;
    }
    var nameToApiMapping = (_b = lookupDef.valuesMapping) !== null && _b !== void 0 ? _b : {};
    var lookupApiName = (_c = nameToApiMapping[fullName]) !== null && _c !== void 0 ? _c : fullName;
    // Known issue: CUSTOM_FIELD fields that were not references will have full api name now
    // Will be solved when annotation will be handled in reference_mapping
    return isCustomFieldLookupDef(lookupDef)
        ? [lookupDef.objectContext, lookupApiName].join(constants_1.API_NAME_SEPARATOR)
        : lookupApiName;
};
var transformFullNameToLabel = function (objectApiName, fieldName, fullName) {
    var _a, _b, _c;
    var lookupDef = (_a = LOOKUP_FIELDS[objectApiName]) === null || _a === void 0 ? void 0 : _a[fieldName];
    if (lookupDef === undefined) {
        return undefined;
    }
    var nameToApiMapping = lodash_1["default"].invert((_b = lookupDef.valuesMapping) !== null && _b !== void 0 ? _b : {});
    var lookupApiName = isCustomFieldLookupDef(lookupDef)
        ? transformer_1.relativeApiName(fullName)
        : fullName;
    return (_c = nameToApiMapping[lookupApiName]) !== null && _c !== void 0 ? _c : lookupApiName;
};
var transformObjectLabelsToApiName = function (object) {
    return (transformObjectLookupValueSetFullNames(object, transformFullNameToApiName));
};
var transformObjectValuesBackToLabel = function (object) {
    return (transformObjectLookupValueSetFullNames(object, transformFullNameToLabel));
};
var transformFieldLabelsToApiName = function (field) {
    return (transformLookupValueSetFullNames(field, transformFullNameToApiName));
};
var transformFieldValuesBackToLabel = function (field) {
    return (transformLookupValueSetFullNames(field, transformFullNameToLabel));
};
var doesObjectHaveValuesMappingLookup = function (objectApiName) {
    var _a;
    return (Object.values((_a = LOOKUP_FIELDS[objectApiName]) !== null && _a !== void 0 ? _a : {})
        .some(function (lookupDef) { return lookupDef.valuesMapping; }));
};
var getCustomObjectWithMappingLookupChanges = function (changes) { return (awu(changes)
    .filter(adapter_api_1.isAdditionOrModificationChange)
    .filter(adapter_api_1.isObjectTypeChange)
    .filter(function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, transformer_1.isCustomObject(adapter_api_1.getChangeData(change))];
            case 1:
                _a = (_c.sent());
                if (!_a) return [3 /*break*/, 3];
                _b = doesObjectHaveValuesMappingLookup;
                return [4 /*yield*/, transformer_1.apiName(adapter_api_1.getChangeData(change))];
            case 2:
                _a = _b.apply(void 0, [_c.sent()]);
                _c.label = 3;
            case 3: return [2 /*return*/, _a];
        }
    });
}); })
    .toArray()); };
var applyFuncOnCustomFieldWithMappingLookupChange = function (changes, fn) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (awu(changes)
                .filter(adapter_api_1.isFieldChange)
                .filter(function (change) { return __awaiter(void 0, void 0, void 0, function () {
                var changeData, parentApiName, _a, _b;
                var _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            changeData = adapter_api_1.getChangeData(change);
                            return [4 /*yield*/, transformer_1.apiName(changeData.parent)];
                        case 1:
                            parentApiName = _d.sent();
                            _a = doesObjectHaveValuesMappingLookup(parentApiName);
                            if (!_a) return [3 /*break*/, 3];
                            _b = LOOKUP_FIELDS[parentApiName];
                            return [4 /*yield*/, transformer_1.apiName(changeData, true)];
                        case 2:
                            _a = ((_c = _b[_d.sent()]) === null || _c === void 0 ? void 0 : _c.valuesMapping) !== undefined;
                            _d.label = 3;
                        case 3: return [2 /*return*/, _a];
                    }
                });
            }); })
                .forEach(function (change) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, adapter_utils_1.applyFunctionToChangeData(change, fn)];
            }); }); }))];
    });
}); };
var applyFuncOnCustomObjectWithMappingLookupChange = function (changes, fn) { return __awaiter(void 0, void 0, void 0, function () {
    var customObjectWithMappingLookupChanges;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getCustomObjectWithMappingLookupChanges(changes)];
            case 1:
                customObjectWithMappingLookupChanges = _a.sent();
                return [4 /*yield*/, awu(customObjectWithMappingLookupChanges).forEach(function (change) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, (adapter_utils_1.applyFunctionToChangeData(change, fn))];
                        });
                    }); })];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var filter = function () { return ({
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    log.debug('Started replacing lookupObject values with references');
                    _a = replaceLookupObjectValueSetValuesWithReferences;
                    return [4 /*yield*/, awu(elements).filter(transformer_1.isCustomObject).toArray()];
                case 1: return [4 /*yield*/, _a.apply(void 0, [_b.sent()])];
                case 2:
                    _b.sent();
                    log.debug('Finished replacing lookupObject values with references');
                    return [2 /*return*/];
            }
        });
    }); },
    preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        var addOrModifyChanges;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    addOrModifyChanges = changes.filter(adapter_api_1.isAdditionOrModificationChange);
                    return [4 /*yield*/, applyFuncOnCustomObjectWithMappingLookupChange(
                        // Fields are taken from object changes only when the object is added
                        addOrModifyChanges.filter(adapter_api_1.isAdditionChange), transformObjectValuesBackToLabel)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, applyFuncOnCustomFieldWithMappingLookupChange(addOrModifyChanges, transformFieldValuesBackToLabel)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        var addOrModifyChanges;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    addOrModifyChanges = changes.filter(adapter_api_1.isAdditionOrModificationChange);
                    return [4 /*yield*/, applyFuncOnCustomObjectWithMappingLookupChange(
                        // Fields are taken from object changes only when the object is added
                        addOrModifyChanges.filter(adapter_api_1.isAdditionChange), transformObjectLabelsToApiName)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, applyFuncOnCustomFieldWithMappingLookupChange(addOrModifyChanges, transformFieldLabelsToApiName)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
}); };
exports["default"] = filter;
