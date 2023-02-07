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
var logging_1 = require("@salto-io/logging");
var lodash_1 = require("lodash");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../../constants");
var transformer_1 = require("../../transformers/transformer");
var utils_1 = require("../utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
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
var addAuthorAnnotationsToFields = function (fileProperties, object) {
    Object.values(fileProperties)
        .forEach(function (fileProp) { return addAuthorAnnotationsToField(fileProp, getObjectFieldByFileProperties(fileProp, object)); });
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
                        .mapValues(function (values) { return lodash_1["default"].keyBy(values, function (fileProps) { return getFieldNameParts(fileProps).fieldName; }); }).value()];
        }
    });
}); };
var objectAuthorInformationSupplier = function (customTypeFilePropertiesMap, customFieldsFilePropertiesMap, object) { return __awaiter(void 0, void 0, void 0, function () {
    var objectApiName;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, transformer_1.apiName(object)];
            case 1:
                objectApiName = _a.sent();
                if (objectApiName in customTypeFilePropertiesMap) {
                    Object.assign(object.annotations, transformer_1.getAuthorAnnotations(customTypeFilePropertiesMap[objectApiName]));
                }
                if (objectApiName in customFieldsFilePropertiesMap) {
                    addAuthorAnnotationsToFields(customFieldsFilePropertiesMap[objectApiName], object);
                }
                return [2 /*return*/];
        }
    });
}); };
exports.WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.';
/*
 * add author information to object types and fields.
 */
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: exports.WARNING_MESSAGE,
            config: config,
            filterName: 'authorInformation',
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var customTypeFilePropertiesMap, customFieldsFilePropertiesMap;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getCustomObjectFileProperties(client)];
                        case 1:
                            customTypeFilePropertiesMap = _a.sent();
                            return [4 /*yield*/, getCustomFieldFileProperties(client)];
                        case 2:
                            customFieldsFilePropertiesMap = _a.sent();
                            return [4 /*yield*/, awu(elements)
                                    .filter(transformer_1.isCustomObject)
                                    .forEach(function (object) { return __awaiter(void 0, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, objectAuthorInformationSupplier(customTypeFilePropertiesMap, customFieldsFilePropertiesMap, object)];
                                            case 1:
                                                _a.sent();
                                                return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filterCreator;
