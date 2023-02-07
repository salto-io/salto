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
var _a, _b, _c;
exports.__esModule = true;
exports.LAYOUT_ASSIGNMENTS_FIELD = exports.LOGIN_IP_RANGES_FIELD = void 0;
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
var utils_1 = require("./utils");
var constants_1 = require("../constants");
var transformer_1 = require("../transformers/transformer");
exports.LOGIN_IP_RANGES_FIELD = 'loginIpRanges';
exports.LAYOUT_ASSIGNMENTS_FIELD = 'layoutAssignments';
var _d = lowerdash_1.collections.asynciterable, awu = _d.awu, keyByAsync = _d.keyByAsync;
var isDefined = lowerdash_1.values.isDefined;
var typeToRemainingFields = (_a = {},
    _a[constants_1.PROFILE_METADATA_TYPE] = (_b = {},
        _b[constants_1.INSTANCE_FULL_NAME_FIELD] = {},
        _b[exports.LOGIN_IP_RANGES_FIELD] = { "default": [] },
        _b),
    _a[constants_1.PERMISSION_SET_METADATA_TYPE] = (_c = {},
        _c[constants_1.INSTANCE_FULL_NAME_FIELD] = {},
        _c[constants_1.LABEL] = {},
        _c),
    _a);
var isRelatedChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (utils_1.isInstanceOfTypeChange.apply(void 0, Object.keys(typeToRemainingFields))(change))];
    });
}); };
var fillRemainingFields = function (type, afterValues) {
    var remainingFields = typeToRemainingFields[type];
    return Object.fromEntries(Object.keys(remainingFields).map(function (fieldName) { var _a; return [fieldName, (_a = afterValues[fieldName]) !== null && _a !== void 0 ? _a : remainingFields[fieldName]["default"]]; }));
};
var toMinifiedChange = function (change) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, before, after, detailedChanges, minifiedAfter, _b, _c, newLayoutAssignmentNames;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = adapter_api_1.getAllChangeData(change), before = _a[0], after = _a[1];
                detailedChanges = adapter_utils_1.detailedCompare(before, after, { createFieldChanges: true });
                minifiedAfter = after.clone();
                _b = minifiedAfter;
                _c = fillRemainingFields;
                return [4 /*yield*/, transformer_1.metadataType(before)];
            case 1:
                _b.value = _c.apply(void 0, [_d.sent(), after.value]);
                newLayoutAssignmentNames = [];
                detailedChanges
                    .filter(adapter_api_1.isAdditionOrModificationChange)
                    .forEach(function (detailedChange) {
                    var changePath = adapter_utils_1.getPath(before, detailedChange.id);
                    if (lodash_1["default"].isUndefined(changePath)) {
                        return;
                    }
                    if (changePath.includes(exports.LAYOUT_ASSIGNMENTS_FIELD)) {
                        newLayoutAssignmentNames.push(changePath[changePath.length - 1]);
                        return;
                    }
                    var minifiedValuePath = changePath.length > 2
                        ? changePath.slice(0, -1)
                        : changePath;
                    var afterChange = lodash_1["default"].get(after, minifiedValuePath);
                    if (isDefined(afterChange)) {
                        lodash_1["default"].set(minifiedAfter, minifiedValuePath, afterChange);
                    }
                });
                if (newLayoutAssignmentNames.length > 0) {
                    minifiedAfter.value[exports.LAYOUT_ASSIGNMENTS_FIELD] = lodash_1["default"].pick(after.value[exports.LAYOUT_ASSIGNMENTS_FIELD], newLayoutAssignmentNames);
                }
                return [2 /*return*/, adapter_api_1.toChange({
                        before: before,
                        after: minifiedAfter,
                    })];
        }
    });
}); };
var filterCreator = function () {
    var originalChanges;
    return {
        preDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var relatedChanges, _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(adapter_api_1.isInstanceChange)
                            .filter(adapter_api_1.isModificationChange)
                            .filter(isRelatedChange)
                            .toArray()];
                    case 1:
                        relatedChanges = _d.sent();
                        return [4 /*yield*/, keyByAsync(relatedChanges, function (change) { return transformer_1.apiName(adapter_api_1.getChangeData(change)); })];
                    case 2:
                        originalChanges = _d.sent();
                        lodash_1["default"].pullAll(changes, relatedChanges);
                        _b = (_a = changes.push).apply;
                        _c = [changes];
                        return [4 /*yield*/, Promise.all(relatedChanges.map(toMinifiedChange))];
                    case 3:
                        _b.apply(_a, _c.concat([(_d.sent())]));
                        return [2 /*return*/];
                }
            });
        }); },
        onDeploy: function (changes) { return __awaiter(void 0, void 0, void 0, function () {
            var appliedChanges, appliedChangesApiNames, appliedOriginalChanges;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, awu(changes)
                            .filter(adapter_api_1.isInstanceChange)
                            .filter(adapter_api_1.isModificationChange)
                            .filter(isRelatedChange)
                            .toArray()];
                    case 1:
                        appliedChanges = _a.sent();
                        return [4 /*yield*/, awu(appliedChanges)
                                .map(function (change) { return transformer_1.apiName(adapter_api_1.getChangeData(change)); })
                                .toArray()];
                    case 2:
                        appliedChangesApiNames = _a.sent();
                        appliedOriginalChanges = appliedChangesApiNames
                            .map(function (name) { return originalChanges[name]; })
                            .filter(isDefined);
                        lodash_1["default"].pullAll(changes, appliedChanges);
                        appliedOriginalChanges.forEach(function (change) { return changes.push(change); });
                        return [2 /*return*/];
                }
            });
        }); },
    };
};
exports["default"] = filterCreator;
