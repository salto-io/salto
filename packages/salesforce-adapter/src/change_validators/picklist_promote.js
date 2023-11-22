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
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var utils_1 = require("../filters/utils");
var global_value_sets_1 = require("../filters/global_value_sets");
var awu = lowerdash_1.collections.asynciterable.awu;
var isGlobalPicklistChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, before, after, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = adapter_api_1.getAllChangeData(change), before = _a[0], after = _a[1];
                _b = utils_1.isPicklistField(before) && utils_1.isPicklistField(after);
                if (!_b) return [3 /*break*/, 2];
                _c = transformer_1.isCustom;
                return [4 /*yield*/, transformer_1.apiName(before)];
            case 1:
                _b = _c.apply(void 0, [_d.sent()]);
                _d.label = 2;
            case 2: return [2 /*return*/, _b && !utils_1.hasValueSetNameAnnotation(before) && utils_1.hasValueSetNameAnnotation(after)];
        }
    });
}); };
var createChangeErrors = function (_a) {
    var pickListField = _a.pickListField, gvsElemID = _a.gvsElemID;
    var picklistErr = {
        elemID: pickListField.elemID,
        severity: 'Error',
        message: 'Cannot promote a picklist value set to a global value set via the API',
        detailedMessage: pickListField.name + " picklist value set cannot be promoted to a global value set via the API.\nYou can delete this change in Salto and do it directly in salesforce.",
    };
    // picklistField valueSetName annotation points to a valid GVS
    if (gvsElemID) {
        var gvsErr = {
            elemID: gvsElemID,
            severity: 'Error',
            message: 'Cannot promote a picklist value set to a global value set via the API',
            detailedMessage: gvsElemID.name + " picklist value set cannot be promoted to a global value set via the API.\nYou can delete this change in Salto and do it directly in salesforce.",
        };
        return [picklistErr, gvsErr];
    }
    return [picklistErr];
};
var referencedGvsElemID = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var referencedGvs, referencedValue;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                referencedGvs = adapter_api_1.getChangeData(change).annotations[constants_1.VALUE_SET_FIELDS.VALUE_SET_NAME];
                if (!adapter_api_1.isReferenceExpression(referencedGvs)) return [3 /*break*/, 2];
                referencedValue = referencedGvs.value;
                return [4 /*yield*/, utils_1.isInstanceOfType(global_value_sets_1.GLOBAL_VALUE_SET)(referencedValue)];
            case 1:
                if (_a.sent()) {
                    return [2 /*return*/, referencedValue.elemID];
                }
                _a.label = 2;
            case 2: return [2 /*return*/, undefined];
        }
    });
}); };
/**
 * Promoting picklist value-set to global is forbidden
 */
var changeValidator = function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var isGVSInstance, gvsIDs, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                isGVSInstance = utils_1.isInstanceOfType(global_value_sets_1.GLOBAL_VALUE_SET);
                _a = Set.bind;
                return [4 /*yield*/, awu(changes)
                        .map(adapter_api_1.getChangeData)
                        .filter(isGVSInstance)
                        .map(function (c) { return c.elemID.getFullName(); })
                        .toArray()];
            case 1:
                gvsIDs = new (_a.apply(Set, [void 0, _b.sent()]))();
                return [2 /*return*/, awu(changes.filter(adapter_api_1.isModificationChange).filter(adapter_api_1.isFieldChange))
                        .filter(isGlobalPicklistChange)
                        .map(function (change) { return __awaiter(void 0, void 0, void 0, function () {
                        var gvsElemID;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, referencedGvsElemID(change)];
                                case 1:
                                    gvsElemID = _a.sent();
                                    return [2 /*return*/, {
                                            pickListField: adapter_api_1.getChangeData(change),
                                            gvsElemID: (gvsElemID && gvsIDs.has(gvsElemID.getFullName())) ? gvsElemID : undefined,
                                        }];
                            }
                        });
                    }); })
                        .flatMap(createChangeErrors)
                        .toArray()];
        }
    });
}); };
exports["default"] = changeValidator;
