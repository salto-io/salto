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
var _a;
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
var transformer_1 = require("../transformers/transformer");
var xml_transformer_1 = require("../transformers/xml_transformer");
var constants_1 = require("../constants");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var isDefined = lowerdash_1.values.isDefined;
// territory2Model does not require another nested dir
var territory2TypesToNestedDirName = (_a = {},
    _a[constants_1.TERRITORY2_RULE_TYPE] = ['rules'],
    _a[constants_1.TERRITORY2_TYPE] = ['territories'],
    _a);
var territory2Types = __spreadArrays(Object.keys(territory2TypesToNestedDirName), [constants_1.TERRITORY2_MODEL_TYPE]);
var removeCustomFieldsFromTypes = function (elements, typeNames) { return __awaiter(void 0, void 0, void 0, function () {
    var elementsOfTypes;
    return __generator(this, function (_a) {
        elementsOfTypes = elements
            .filter(function (elem) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = typeNames).includes;
                    return [4 /*yield*/, transformer_1.metadataType(elem)];
                case 1: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
            }
        }); }); });
        elementsOfTypes
            .filter(transformer_1.isMetadataObjectType)
            .forEach(function (type) {
            delete type.fields.customFields;
        });
        elementsOfTypes
            .filter(adapter_api_1.isInstanceElement)
            .forEach(function (inst) {
            delete inst.value.customFields;
        });
        return [2 /*return*/];
    });
}); };
var isTerritoryRelatedChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = adapter_api_1.isInstanceChange(change) && adapter_api_1.isAdditionOrModificationChange(change);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, awu(territory2Types).some(function (typeName) { return utils_1.isInstanceOfTypeChange(typeName)(change); })];
            case 1:
                _a = (_b.sent());
                _b.label = 2;
            case 2: return [2 /*return*/, ((_a)
                    ? change
                    : undefined)];
        }
    });
}); };
var setTerritoryDeployPkgStructure = function (element) { return __awaiter(void 0, void 0, void 0, function () {
    var suffix, instanceName, contentPath, _a, _b;
    var _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, element.getType()];
            case 1:
                suffix = (_e.sent()).annotations.suffix;
                return [4 /*yield*/, transformer_1.apiName(element, true)];
            case 2:
                instanceName = _e.sent();
                return [4 /*yield*/, utils_1.parentApiName(element)];
            case 3:
                _a = [[
                        _e.sent()
                    ]];
                _b = territory2TypesToNestedDirName;
                return [4 /*yield*/, transformer_1.metadataType(element)];
            case 4:
                contentPath = __spreadArrays.apply(void 0, _a.concat([(_d = _b[_e.sent()]) !== null && _d !== void 0 ? _d : [], [
                        "" + instanceName + (suffix === undefined ? '' : "." + suffix),
                    ]]));
                element.annotate((_c = {}, _c[xml_transformer_1.CONTENT_FILENAME_OVERRIDE] = contentPath, _c));
                return [2 /*return*/];
        }
    });
}); };
var filterCreator = function () { return ({
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Territory2 and Territory2Model support custom fields - these are returned
                // in a CustomObject with the appropriate name and also in each instance of these types
                // We remove the fields from the instances to avoid duplication
                return [4 /*yield*/, removeCustomFieldsFromTypes(elements, [constants_1.TERRITORY2_TYPE, constants_1.TERRITORY2_MODEL_TYPE])];
                case 1:
                    // Territory2 and Territory2Model support custom fields - these are returned
                    // in a CustomObject with the appropriate name and also in each instance of these types
                    // We remove the fields from the instances to avoid duplication
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    // territory2 types require a special deploy pkg structure (SALTO-1200)
    preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, awu(changes)
                        .map(isTerritoryRelatedChange)
                        .filter(isDefined)
                        .map(adapter_api_1.getChangeData)
                        .forEach(function (elm) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, setTerritoryDeployPkgStructure(elm)];
                    }); }); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
    onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, awu(changes)
                        .map(isTerritoryRelatedChange)
                        .filter(isDefined)
                        .map(adapter_api_1.getChangeData)
                        .forEach(function (elem) {
                        delete elem.annotations[xml_transformer_1.CONTENT_FILENAME_OVERRIDE];
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
}); };
exports["default"] = filterCreator;
