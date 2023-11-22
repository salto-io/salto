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
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var logging_1 = require("@salto-io/logging");
var constants_1 = require("../constants");
var utils_1 = require("./utils");
var transformer_1 = require("../transformers/transformer");
var isDefined = lowerdash_1.values.isDefined;
var awu = lowerdash_1.collections.asynciterable.awu;
var makeArray = lowerdash_1.collections.array.makeArray;
var log = logging_1.logger(module);
var addInstalledPackageReference = function (element, installedPackageNamespaceToRef) { return __awaiter(void 0, void 0, void 0, function () {
    var namespace, installedPackageElemID, reference;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, utils_1.getNamespace(element)];
            case 1:
                namespace = _a.sent();
                if (namespace === undefined) {
                    return [2 /*return*/, false];
                }
                installedPackageElemID = installedPackageNamespaceToRef.get(namespace);
                if (installedPackageElemID === undefined) {
                    return [2 /*return*/, false];
                }
                reference = new adapter_api_1.ReferenceExpression(installedPackageElemID);
                adapter_utils_1.extendGeneratedDependencies(element, [{ reference: reference }]);
                return [2 /*return*/, true];
        }
    });
}); };
var filterCreator = function (_a) {
    var config = _a.config;
    return ({
        name: 'installedPackageGeneratedDependencies',
        onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
            var knownInstancesNamespaces, referenceElements, installedPackageNamespaceToRef, _a, _b, affectedTopLevelElements, affectedFields, instancesInWrongPath, instancesInWrongPathByType, summary_1;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        knownInstancesNamespaces = lodash_1["default"].uniq(elements
                            .map(utils_1.getNamespaceSync)
                            .filter(isDefined));
                        log.debug("About to add InstalledPackage generated dependencies to Elements from the following namespaces: " + adapter_utils_1.safeJsonStringify(knownInstancesNamespaces));
                        referenceElements = utils_1.buildElementsSourceForFetch(elements, config);
                        _b = (_a = lowerdash_1.multiIndex).keyByAsync;
                        _c = {};
                        return [4 /*yield*/, referenceElements.getAll()];
                    case 1: return [4 /*yield*/, _b.apply(_a, [(_c.iter = _d.sent(),
                                _c.filter = utils_1.isInstanceOfType(constants_1.INSTALLED_PACKAGE_METADATA),
                                _c.key = function (inst) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, transformer_1.apiName(inst)];
                                        case 1: return [2 /*return*/, [_a.sent()]];
                                    }
                                }); }); },
                                _c.map = function (inst) { return inst.elemID; },
                                _c)])];
                    case 2:
                        installedPackageNamespaceToRef = _d.sent();
                        if (lodash_1["default"].isEmpty(Object.keys(installedPackageNamespaceToRef))) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, awu(elements)
                                .filter(function (element) { return addInstalledPackageReference(element, installedPackageNamespaceToRef); })
                                .toArray()
                            // CustomFields of Standard Objects
                        ];
                    case 3:
                        affectedTopLevelElements = _d.sent();
                        return [4 /*yield*/, awu(elements)
                                .filter(adapter_api_1.isObjectType)
                                .filter(utils_1.isStandardObject)
                                .flatMap(function (standardObject) { return Object.values(standardObject.fields); })
                                .filter(function (standardObject) { return addInstalledPackageReference(standardObject, installedPackageNamespaceToRef); })
                                .toArray()];
                    case 4:
                        affectedFields = _d.sent();
                        log.debug("Added InstalledPackage instance generated dependencies to " + (affectedTopLevelElements.length + affectedFields.length) + " Elements");
                        instancesInWrongPath = affectedTopLevelElements
                            .filter(adapter_api_1.isInstanceElement)
                            .filter(function (instance) { var _a; return !makeArray(__spreadArrays((_a = instance.path) !== null && _a !== void 0 ? _a : [])).includes(constants_1.INSTALLED_PACKAGES_PATH); });
                        if (instancesInWrongPath.length > 0) {
                            instancesInWrongPathByType = lodash_1["default"].groupBy(instancesInWrongPath, utils_1.metadataTypeSync);
                            summary_1 = {};
                            Object.entries(instancesInWrongPathByType).forEach(function (_a) {
                                var type = _a[0], instances = _a[1];
                                summary_1[type] = {
                                    count: instances.length,
                                    example: instances[0].elemID.getFullName(),
                                };
                            });
                            log.debug("some Metadata Instances are not under the InstalledPackages directory. summary: " + adapter_utils_1.safeJsonStringify(summary_1));
                        }
                        return [2 /*return*/];
                }
            });
        }); },
    });
};
exports["default"] = filterCreator;
