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
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var transformer_1 = require("../transformers/transformer");
var utils_1 = require("./utils");
var constants_1 = require("../constants");
var awu = lowerdash_1.collections.asynciterable.awu;
var toArrayAsync = lowerdash_1.collections.asynciterable.toArrayAsync;
var generateProfileInternalIdToName = function (client) { return __awaiter(void 0, void 0, void 0, function () {
    var profileNames, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = toArrayAsync;
                return [4 /*yield*/, client.queryAll('SELECT Id, Name FROM Profile')];
            case 1: return [4 /*yield*/, _a.apply(void 0, [_b.sent()])];
            case 2:
                profileNames = _b.sent();
                return [2 /*return*/, new Map(profileNames.flat().map(function (profile) { return [profile.Id, profile.Name]; }))];
        }
    });
}); };
var replacePath = function (profile, profileInternalIdToName) { return __awaiter(void 0, void 0, void 0, function () {
    var name;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, transformer_1.apiName(profile)];
            case 1:
                name = ((_a.sent()) === 'PlatformPortal')
                    // Both 'PlatformPortal' & 'AuthenticatedWebsite' profiles have 'Authenticated Website'
                    // display name in SF UI. Since we wouldn't like them to be placed under the same nacl,
                    // We modify 'PlatformPortal' filename manually so we'll have Authenticated_Website and
                    // Authenticated_Website2 nacls.
                    ? 'Authenticated Website2'
                    : profileInternalIdToName.get(utils_1.getInternalId(profile));
                if (name !== undefined && profile.path) {
                    profile.path = __spreadArrays(profile.path.slice(0, -1), [
                        adapter_utils_1.pathNaclCase(adapter_utils_1.naclCase(name)),
                    ]);
                }
                return [2 /*return*/];
        }
    });
}); };
exports.WARNING_MESSAGE = 'Failed to update the NaCl file names for some of your salesforce profiles. Therefore, profiles NaCl file names might differ from their display names in some cases.';
/**
 * replace paths for profile instances upon fetch
 */
var filterCreator = function (_a) {
    var client = _a.client, config = _a.config;
    return ({
        onFetch: utils_1.ensureSafeFilterFetch({
            warningMessage: exports.WARNING_MESSAGE,
            config: config,
            filterName: 'profilePaths',
            fetchFilterFunc: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
                var profiles, profileInternalIdToName_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, awu(elements)
                                .filter(function (e) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, utils_1.isInstanceOfType(constants_1.PROFILE_METADATA_TYPE)(e)];
                            }); }); }).toArray()];
                        case 1:
                            profiles = _a.sent();
                            if (!(profiles.length > 0)) return [3 /*break*/, 4];
                            return [4 /*yield*/, generateProfileInternalIdToName(client)];
                        case 2:
                            profileInternalIdToName_1 = _a.sent();
                            return [4 /*yield*/, awu(profiles)
                                    .filter(adapter_api_1.isInstanceElement)
                                    .forEach(function (inst) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                    return [2 /*return*/, replacePath(inst, profileInternalIdToName_1)];
                                }); }); })];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4: return [2 /*return*/];
                    }
                });
            }); },
        }),
    });
};
exports["default"] = filterCreator;
