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
var adapter_api_1 = require("@salto-io/adapter-api");
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var utils_1 = require("../filters/utils");
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, keyByAsync = _a.keyByAsync, groupByAsync = _a.groupByAsync;
var getObjectName = function (layoutInstance) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, transformer_1.apiName(layoutInstance)];
            case 1: return [2 /*return*/, ((_a.sent()).split('-')[0])];
        }
    });
}); };
var createLastLayoutDeletionError = function (_a, objectName) {
    var elemID = _a.elemID;
    return ({
        elemID: elemID,
        severity: 'Error',
        message: 'Custom objects must have at least one layout',
        detailedMessage: "Current deployment plan attempts to delete all custom object " + objectName + " layouts. Please make sure to have at least one layout in order to deploy.",
    });
};
var changeValidator = function (changes, elementsSource) { return __awaiter(void 0, void 0, void 0, function () {
    var relevantChanges, removedObjectNames, _a, _b, _c, relevantChangesByObjectName, _d, _e, objectsWithRemainingLayouts, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                if (elementsSource === undefined) {
                    return [2 /*return*/, []];
                }
                return [4 /*yield*/, awu(changes)
                        .filter(adapter_api_1.isInstanceChange)
                        .filter(adapter_api_1.isRemovalChange)
                        .filter(utils_1.isInstanceOfTypeChange(constants_1.LAYOUT_TYPE_ID_METADATA_TYPE))
                        .toArray()];
            case 1:
                relevantChanges = _k.sent();
                if (lodash_1["default"].isEmpty(relevantChanges)) {
                    return [2 /*return*/, []];
                }
                _b = (_a = Object).keys;
                _c = keyByAsync;
                return [4 /*yield*/, awu(changes)
                        .filter(adapter_api_1.isObjectTypeChange)
                        .filter(adapter_api_1.isRemovalChange)
                        .toArray()];
            case 2: return [4 /*yield*/, _c.apply(void 0, [_k.sent(),
                    function (change) { return transformer_1.apiName(adapter_api_1.getChangeData(change)); }])];
            case 3:
                removedObjectNames = _b.apply(_a, [_k.sent()]);
                _e = (_d = lodash_1["default"]).pickBy;
                return [4 /*yield*/, groupByAsync(relevantChanges, function (change) { return getObjectName(adapter_api_1.getChangeData(change)); })];
            case 4:
                relevantChangesByObjectName = _e.apply(_d, [_k.sent(),
                    // If the Object is fully removed, it's a valid change.
                    function (_value, objectName) { return !removedObjectNames.includes(objectName); }]);
                _g = (_f = Object).keys;
                _h = groupByAsync;
                _j = awu;
                return [4 /*yield*/, elementsSource.getAll()];
            case 5: return [4 /*yield*/, _j.apply(void 0, [_k.sent()])
                    .filter(adapter_api_1.isInstanceElement)
                    .filter(utils_1.isInstanceOfType(constants_1.LAYOUT_TYPE_ID_METADATA_TYPE))
                    .toArray()];
            case 6: return [4 /*yield*/, _h.apply(void 0, [_k.sent(), getObjectName])];
            case 7:
                objectsWithRemainingLayouts = _g.apply(_f, [_k.sent()]);
                return [2 /*return*/, Object.entries(relevantChangesByObjectName)
                        .filter(function (_a) {
                        var objectName = _a[0];
                        return !objectsWithRemainingLayouts.includes(objectName);
                    })
                        .flatMap(function (_a) {
                        var objectName = _a[0], deletedLayoutChanges = _a[1];
                        return deletedLayoutChanges
                            .map(adapter_api_1.getChangeData)
                            .map(function (instance) { return createLastLayoutDeletionError(instance, objectName); });
                    })];
        }
    });
}); };
exports["default"] = changeValidator;
