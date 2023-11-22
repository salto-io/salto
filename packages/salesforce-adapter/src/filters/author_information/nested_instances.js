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
exports.__esModule = true;
exports.WARNING_MESSAGE = void 0;
var logging_1 = require("@salto-io/logging");
var lodash_1 = require("lodash");
var utils_1 = require("../utils");
var workflow_1 = require("../workflow");
var custom_objects_to_object_type_1 = require("../custom_objects_to_object_type");
var transformer_1 = require("../../transformers/transformer");
var log = logging_1.logger(module);
exports.WARNING_MESSAGE = 'Encountered an error while trying to populate author information in some of the Salesforce configuration elements.';
var NESTED_INSTANCES_METADATA_TYPES = __spreadArrays([
    'CustomLabel',
    'AssignmentRule',
    'AutoResponseRule',
    'EscalationRule',
    'MatchingRule'
], Object.values(workflow_1.WORKFLOW_FIELD_TO_TYPE), Object.values(custom_objects_to_object_type_1.NESTED_INSTANCE_VALUE_TO_TYPE_NAME));
var setAuthorInformationForInstancesOfType = function (_a) {
    var client = _a.client, typeName = _a.typeName, instances = _a.instances;
    return __awaiter(void 0, void 0, void 0, function () {
        var filesProps, filePropsByFullName, instancesWithMissingFileProps;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, client.listMetadataObjects([{ type: typeName }])];
                case 1:
                    filesProps = (_b.sent()).result;
                    filePropsByFullName = lodash_1["default"].keyBy(filesProps, function (props) { return props.fullName; });
                    instancesWithMissingFileProps = [];
                    instances.forEach(function (instance) {
                        var instanceFullName = utils_1.apiNameSync(instance);
                        if (instanceFullName === undefined) {
                            return;
                        }
                        var fileProps = filePropsByFullName[instanceFullName];
                        if (fileProps === undefined) {
                            instancesWithMissingFileProps.push(instance);
                            return;
                        }
                        Object.assign(instance.annotations, transformer_1.getAuthorAnnotations(fileProps));
                    });
                    if (instancesWithMissingFileProps.length > 0) {
                        log.debug("Failed to populate author information for the following " + typeName + " instances: " + instancesWithMissingFileProps.map(function (instance) { return utils_1.apiNameSync(instance); }).join(', '));
                    }
                    return [2 /*return*/];
            }
        });
    });
};
/*
 * add author information on nested instances
 */
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        name: 'nestedInstancesAuthorFilter',
        remote: true,
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: exports.WARNING_MESSAGE,
            config: config,
            filterName: 'authorInformation',
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var nestedInstancesByType;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            nestedInstancesByType = lodash_1["default"].pick(lodash_1["default"].groupBy(elements.filter(utils_1.isMetadataInstanceElementSync), function (e) { return utils_1.apiNameSync(e.getTypeSync()); }), NESTED_INSTANCES_METADATA_TYPES);
                            return [4 /*yield*/, Promise.all(NESTED_INSTANCES_METADATA_TYPES
                                    .map(function (typeName) { var _a; return ({ typeName: typeName, instances: (_a = nestedInstancesByType[typeName]) !== null && _a !== void 0 ? _a : [] }); })
                                    .filter(function (_a) {
                                    var instances = _a.instances;
                                    return instances.length > 0;
                                })
                                    .map(function (_a) {
                                    var typeName = _a.typeName, instances = _a.instances;
                                    return (setAuthorInformationForInstancesOfType({ client: client, typeName: typeName, instances: instances }));
                                }))];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filterCreator;
