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
exports.resolvers = exports.FLOW_URL_SUFFIX = void 0;
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
var utils_1 = require("../filters/utils");
var constants_1 = require("../constants");
var isDefined = lowerdash_1.values.isDefined;
exports.FLOW_URL_SUFFIX = 'lightning/setup/Flows/home';
var GENERAL_URLS_MAP = {
    PermissionSet: 'lightning/setup/PermSets/home',
    PermissionSetGroup: 'lightning/setup/PermSetGroups/home',
    ApexClass: 'lightning/setup/ApexClasses/home',
    Flow: exports.FLOW_URL_SUFFIX,
    Profile: 'lightning/setup/EnhancedProfiles/home',
    CustomMetadata: 'lightning/setup/CustomMetadata/home',
    CustomPermission: 'lightning/setup/CustomPermissions/home',
    ApexComponent: 'lightning/setup/ApexComponents/home',
    ApexPage: 'lightning/setup/ApexPages/home',
    EmailTemplate: 'lightning/setup/CommunicationTemplatesEmail/home',
    ReportType: 'lightning/setup/CustomReportTypes/home',
    AnalyticSnapshot: 'lightning/setup/AnalyticSnapshots/home',
    ApexTrigger: 'lightning/setup/ApexTriggers/home',
    Queue: 'lightning/setup/Queues/home',
    LightningComponentBundle: 'lightning/setup/LightningComponentBundles/home',
    Report: 'lightning/o/Report/home',
    Dashboard: 'lightning/o/Dashboard/home',
};
var SETTINGS_URLS_MAP = {
    BusinessHoursSettings: 'lightning/setup/BusinessHours/home',
    LanguageSettings: 'lightning/setup/LanguageSettings/home',
    MyDomainSettings: 'lightning/setup/OrgDomain/home',
    ApexSettings: 'lightning/setup/ApexSettings/home',
};
var getTypeIdentifier = function (element) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
    return [2 /*return*/, (element === undefined ? undefined : ((_a = utils_1.getInternalId(element)) !== null && _a !== void 0 ? _a : transformer_1.apiName(element)))];
}); }); };
var getFieldIdentifier = function (element) { return __awaiter(void 0, void 0, void 0, function () { var _a, _b; return __generator(this, function (_c) {
    return [2 /*return*/, ((_b = (_a = utils_1.getInternalId(element)) !== null && _a !== void 0 ? _a : element.annotations.relationshipName) !== null && _b !== void 0 ? _b : transformer_1.apiName(element, true))];
}); }); };
var genernalConstantsResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _a = adapter_api_1.isObjectType(element);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, transformer_1.metadataType(element)];
            case 1:
                _a = (_e.sent()) in GENERAL_URLS_MAP;
                _e.label = 2;
            case 2:
                if (!_a) return [3 /*break*/, 4];
                _b = URL.bind;
                _c = "" + baseUrl;
                _d = GENERAL_URLS_MAP;
                return [4 /*yield*/, transformer_1.metadataType(element)];
            case 3: return [2 /*return*/, new (_b.apply(URL, [void 0, _c + _d[_e.sent()]]))()];
            case 4: return [2 /*return*/, undefined];
        }
    });
}); };
var settingsConstantsResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, transformer_1.metadataType(element)];
            case 1:
                if (!((_d.sent()) in SETTINGS_URLS_MAP)) return [3 /*break*/, 3];
                _a = URL.bind;
                _b = "" + baseUrl;
                _c = SETTINGS_URLS_MAP;
                return [4 /*yield*/, transformer_1.metadataType(element)];
            case 2: return [2 /*return*/, new (_a.apply(URL, [void 0, _b + _c[_d.sent()]]))()];
            case 3: return [2 /*return*/, undefined];
        }
    });
}); };
var assignmentRulesResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, utils_1.isInstanceOfType('AssignmentRules')(element)];
            case 1:
                _a = (_f.sent());
                if (!_a) return [3 /*break*/, 3];
                _c = (_b = ['Lead', 'Case']).includes;
                return [4 /*yield*/, transformer_1.apiName(element)];
            case 2:
                _a = _c.apply(_b, [_f.sent()]);
                _f.label = 3;
            case 3:
                if (!_a) return [3 /*break*/, 5];
                _d = URL.bind;
                _e = baseUrl + "lightning/setup/";
                return [4 /*yield*/, transformer_1.apiName(element)];
            case 4: return [2 /*return*/, new (_d.apply(URL, [void 0, _e + (_f.sent()) + "Rules/home"]))()];
            case 5: return [2 /*return*/, undefined];
        }
    });
}); };
var metadataTypeResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var internalId, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                internalId = utils_1.getInternalId(element);
                _a = adapter_api_1.isType(element);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, transformer_1.apiName(element)];
            case 1:
                _a = ((_b = (_c.sent())) === null || _b === void 0 ? void 0 : _b.endsWith(constants_1.CUSTOM_METADATA_SUFFIX));
                _c.label = 2;
            case 2:
                if (_a && internalId !== undefined) {
                    return [2 /*return*/, (new URL(baseUrl + "lightning/setup/CustomMetadata/page?address=%2F" + internalId + "%3Fsetupid%3DCustomMetadata"))];
                }
                return [2 /*return*/, undefined];
        }
    });
}); };
var objectResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var typeIdentfier;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getTypeIdentifier(element)];
            case 1:
                typeIdentfier = _a.sent();
                return [4 /*yield*/, transformer_1.isCustomObject(element)];
            case 2:
                if ((_a.sent())
                    && typeIdentfier !== undefined) {
                    return [2 /*return*/, new URL(baseUrl + "lightning/setup/ObjectManager/" + typeIdentfier + "/Details/view")];
                }
                return [2 /*return*/, undefined];
        }
    });
}); };
var fieldResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, fieldIdentifier, typeIdentfier;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = adapter_api_1.isField(element);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, transformer_1.isFieldOfCustomObject(element)];
            case 1:
                _a = (_b.sent());
                _b.label = 2;
            case 2:
                if (!_a) return [3 /*break*/, 5];
                return [4 /*yield*/, getFieldIdentifier(element)];
            case 3:
                fieldIdentifier = _b.sent();
                return [4 /*yield*/, getTypeIdentifier(element.parent)];
            case 4:
                typeIdentfier = _b.sent();
                if (fieldIdentifier !== undefined
                    && typeIdentfier !== undefined) {
                    return [2 /*return*/, new URL(baseUrl + "lightning/setup/ObjectManager/" + typeIdentfier + "/FieldsAndRelationships/" + fieldIdentifier + "/view")];
                }
                _b.label = 5;
            case 5: return [2 /*return*/, undefined];
        }
    });
}); };
var flowResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var internalId, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                internalId = utils_1.getInternalId(element);
                _a = adapter_api_1.isInstanceElement(element);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, utils_1.isInstanceOfType('Flow')(element)];
            case 1:
                _a = (_b.sent());
                _b.label = 2;
            case 2:
                if (_a && (element.value.processType === 'Flow' || element.value.processType === 'AutoLaunchedFlow')
                    && internalId !== undefined) {
                    return [2 /*return*/, (new URL(baseUrl + "builder_platform_interaction/flowBuilder.app?flowId=" + internalId))];
                }
                return [2 /*return*/, undefined];
        }
    });
}); };
var workflowResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = adapter_api_1.isInstanceElement(element);
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, utils_1.isInstanceOfType('Flow')(element)];
            case 1:
                _a = (_b.sent());
                _b.label = 2;
            case 2:
                if (_a && element.value.processType === 'Workflow') {
                    // It seems all the process builder flows has the same url so we return the process buider home
                    return [2 /*return*/, new URL(baseUrl + "lightning/setup/ProcessAutomation/home")];
                }
                return [2 /*return*/, undefined];
        }
    });
}); };
var queueResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var internalId;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                internalId = utils_1.getInternalId(element);
                return [4 /*yield*/, utils_1.isInstanceOfType('Queue')(element)];
            case 1:
                if ((_a.sent())
                    && utils_1.getInternalId(element) !== undefined) {
                    return [2 /*return*/, new URL(baseUrl + "lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3D" + internalId)];
                }
                return [2 /*return*/, undefined];
        }
    });
}); };
var layoutResolver = function (element, baseUrl, elementIDResolver) { return __awaiter(void 0, void 0, void 0, function () {
    var internalId, parentRef, parent_1, parentIdentifier;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                internalId = utils_1.getInternalId(element);
                parentRef = adapter_utils_1.getParents(element)[0];
                return [4 /*yield*/, utils_1.isInstanceOfType('Layout')(element)];
            case 1:
                if (!((_a.sent())
                    && internalId !== undefined
                    && adapter_api_1.isReferenceExpression(parentRef))) return [3 /*break*/, 4];
                return [4 /*yield*/, elementIDResolver(parentRef.elemID)];
            case 2:
                parent_1 = _a.sent();
                return [4 /*yield*/, getTypeIdentifier(parent_1)];
            case 3:
                parentIdentifier = _a.sent();
                if (parentIdentifier !== undefined) {
                    return [2 /*return*/, new URL(baseUrl + "lightning/setup/ObjectManager/" + parentIdentifier + "/PageLayouts/" + internalId + "/view")];
                }
                _a.label = 4;
            case 4: return [2 /*return*/, undefined];
        }
    });
}); };
var internalIdResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var internalId;
    return __generator(this, function (_a) {
        internalId = utils_1.getInternalId(element);
        if (internalId !== undefined) {
            return [2 /*return*/, new URL(baseUrl + "lightning/_classic/%2F" + internalId)];
        }
        return [2 /*return*/, undefined];
    });
}); };
var instanceCustomObjectResolver = function (element, baseUrl) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceId, typeId, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, transformer_1.isInstanceOfCustomObject(element)];
            case 1:
                if (!_c.sent()) return [3 /*break*/, 7];
                return [4 /*yield*/, transformer_1.apiName(element)];
            case 2:
                instanceId = _c.sent();
                if (!adapter_api_1.isInstanceElement(element)) return [3 /*break*/, 5];
                _b = transformer_1.apiName;
                return [4 /*yield*/, element.getType()];
            case 3: return [4 /*yield*/, _b.apply(void 0, [_c.sent()])];
            case 4:
                _a = _c.sent();
                return [3 /*break*/, 6];
            case 5:
                _a = undefined;
                _c.label = 6;
            case 6:
                typeId = _a;
                return [2 /*return*/, isDefined(typeId) ? new URL(baseUrl + "lightning/r/" + typeId + "/" + instanceId + "/view") : undefined];
            case 7: return [2 /*return*/, undefined];
        }
    });
}); };
exports.resolvers = [genernalConstantsResolver,
    settingsConstantsResolver, assignmentRulesResolver, metadataTypeResolver,
    objectResolver, fieldResolver, flowResolver, workflowResolver, layoutResolver, queueResolver,
    internalIdResolver, instanceCustomObjectResolver];
