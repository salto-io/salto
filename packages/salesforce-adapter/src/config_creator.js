"use strict";
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
exports.configCreator = exports.getConfig = exports.optionsType = exports.configWithCPQ = void 0;
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var logging_1 = require("@salto-io/logging");
var types_1 = require("./types");
var constants = require("./constants");
var constants_1 = require("./constants");
var log = logging_1.logger(module);
exports.configWithCPQ = new adapter_api_1.InstanceElement(adapter_api_1.ElemID.CONFIG_NAME, types_1.configType, {
    fetch: {
        metadata: {
            include: [
                {
                    metadataType: '.*',
                    namespace: '',
                    name: '.*',
                },
                {
                    metadataType: '.*',
                    namespace: constants_1.CPQ_NAMESPACE,
                    name: '.*',
                },
                {
                    metadataType: '.*',
                    namespace: 'sbaa',
                    name: '.*',
                },
            ],
            exclude: [
                {
                    metadataType: 'Report',
                },
                {
                    metadataType: 'ReportType',
                },
                {
                    metadataType: 'ReportFolder',
                },
                {
                    metadataType: 'Dashboard',
                },
                {
                    metadataType: 'DashboardFolder',
                },
                {
                    metadataType: 'Document',
                },
                {
                    metadataType: 'DocumentFolder',
                },
                {
                    metadataType: 'Profile',
                },
                {
                    metadataType: 'PermissionSet',
                },
                {
                    metadataType: 'SiteDotCom',
                },
                {
                    metadataType: 'EmailTemplate',
                    name: 'MarketoEmailTemplates/.*',
                },
                {
                    metadataType: 'ContentAsset',
                },
                {
                    metadataType: 'CustomObjectTranslation',
                },
                {
                    metadataType: 'AnalyticSnapshot',
                },
                {
                    metadataType: 'WaveDashboard',
                },
                {
                    metadataType: 'WaveDataflow',
                },
                {
                    metadataType: 'StandardValueSet',
                    name: '^(AddressCountryCode)|(AddressStateCode)$',
                    namespace: '',
                },
                {
                    metadataType: 'Layout',
                    name: 'CollaborationGroup-Group Layout',
                },
                {
                    metadataType: 'Layout',
                    name: 'CaseInteraction-Case Feed Layout',
                },
                {
                    metadataType: 'EclairGeoData',
                },
                {
                    metadataType: 'OmniUiCard|OmniDataTransform|OmniIntegrationProcedure|OmniInteractionAccessConfig|OmniInteractionConfig|OmniScript',
                },
            ],
        },
        data: {
            includeObjects: [
                'SBQQ__.*',
                'sbaa__ApprovalChain__c',
                'sbaa__ApprovalCondition__c',
                'sbaa__ApprovalRule__c',
                'sbaa__ApprovalVariable__c',
                'sbaa__Approver__c',
                'sbaa__EmailTemplate__c',
                'sbaa__TrackedField__c',
            ],
            excludeObjects: [
                'SBQQ__ContractedPrice__c',
                'SBQQ__Quote__c',
                'SBQQ__QuoteDocument__c',
                'SBQQ__QuoteLine__c',
                'SBQQ__QuoteLineGroup__c',
                'SBQQ__Subscription__c',
                'SBQQ__SubscribedAsset__c',
                'SBQQ__SubscribedQuoteLine__c',
                'SBQQ__SubscriptionConsumptionRate__c',
                'SBQQ__SubscriptionConsumptionSchedule__c',
                'SBQQ__WebQuote__c',
                'SBQQ__WebQuoteLine__c',
                'SBQQ__QuoteLineConsumptionSchedule__c',
                'SBQQ__QuoteLineConsumptionRate__c',
                'SBQQ__InstallProcessorLog__c',
                'SBQQ__ProcessInputValue__c',
                'SBQQ__RecordJob__c',
                'SBQQ__TimingLog__c',
            ],
            allowReferenceTo: [
                'Product2',
                'Pricebook2',
                'PricebookEntry',
            ],
            saltoIDSettings: {
                defaultIdFields: [
                    constants_1.CUSTOM_OBJECT_ID_FIELD,
                ],
            },
            brokenOutgoingReferencesSettings: {
                defaultBehavior: 'BrokenReference',
                perTargetTypeOverrides: {
                    User: 'InternalId',
                },
            },
        },
    },
    maxItemsInRetrieveRequest: 2500,
});
var optionsElemId = new adapter_api_1.ElemID(constants.SALESFORCE, 'configOptionsType');
exports.optionsType = adapter_utils_1.createMatchingObjectType({
    elemID: optionsElemId,
    fields: {
        cpq: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
    },
});
var isOptionsTypeInstance = function (instance) {
    if (instance.refType.elemID.isEqual(optionsElemId)) {
        return true;
    }
    log.error("Received an invalid instance for config options. Received instance with refType ElemId full name: " + instance.refType.elemID.getFullName());
    return false;
};
var getConfig = function (options) { return __awaiter(void 0, void 0, void 0, function () {
    var defaultConf;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, adapter_utils_1.createDefaultInstanceFromType(adapter_api_1.ElemID.CONFIG_NAME, types_1.configType)];
            case 1:
                defaultConf = _a.sent();
                if (options === undefined || !isOptionsTypeInstance(options)) {
                    return [2 /*return*/, defaultConf];
                }
                if (options.value.cpq === true) {
                    return [2 /*return*/, exports.configWithCPQ];
                }
                return [2 /*return*/, defaultConf];
        }
    });
}); };
exports.getConfig = getConfig;
exports.configCreator = {
    optionsType: exports.optionsType,
    getConfig: exports.getConfig,
};
