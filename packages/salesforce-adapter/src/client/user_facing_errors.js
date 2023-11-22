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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var _a, _b;
exports.__esModule = true;
exports.mapToUserFriendlyErrorMessages = exports.getUserFriendlyDeployMessage = exports.MAPPABLE_PROBLEM_TO_USER_FRIENDLY_MESSAGE = exports.ERROR_MAPPERS = exports.INVALID_GRANT_MESSAGE = exports.ERROR_HTTP_502_MESSAGE = exports.MAX_CONCURRENT_REQUESTS_MESSAGE = exports.REQUEST_LIMIT_EXCEEDED_MESSAGE = void 0;
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var logging_1 = require("@salto-io/logging");
var constants_1 = require("../constants");
var log = logging_1.logger(module);
exports.REQUEST_LIMIT_EXCEEDED_MESSAGE = 'Your Salesforce org has limited API calls for a 24-hour period. '
    + 'We are unable to connect to your org because this limit has been exceeded. '
    + 'Please try again later or contact your account executive to increase your API limit.';
exports.MAX_CONCURRENT_REQUESTS_MESSAGE = 'You have reached the maximum allowed concurrent API requests. '
    + 'For more information please refer to: https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm';
exports.ERROR_HTTP_502_MESSAGE = 'We are unable to connect to your Salesforce account right now. '
    + 'This might be an issue in Salesforce side. please check https://status.salesforce.com/current/incidents';
exports.INVALID_GRANT_MESSAGE = 'Salesforce user is inactive, please re-authenticate';
var isDNSException = function (error) { return (lodash_1["default"].isString(lodash_1["default"].get(error, constants_1.ERROR_PROPERTIES.CODE)) && lodash_1["default"].isString(lodash_1["default"].get(error, constants_1.ERROR_PROPERTIES.HOSTNAME))); };
var withSalesforceError = function (salesforceError, saltoErrorMessage) { return (saltoErrorMessage + "\n\nUnderlying Error: " + salesforceError); };
exports.ERROR_MAPPERS = (_a = {},
    _a[constants_1.ERROR_HTTP_502] = {
        test: function (error) { return error.message === constants_1.ERROR_HTTP_502; },
        map: function (error) { return withSalesforceError(error.message, exports.ERROR_HTTP_502_MESSAGE); },
    },
    _a[constants_1.SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED] = {
        test: function (error) { return (constants_1.isSalesforceError(error) && error[constants_1.ERROR_PROPERTIES.ERROR_CODE] === constants_1.SALESFORCE_ERRORS.REQUEST_LIMIT_EXCEEDED); },
        map: function (error) { return (error.message.includes('TotalRequests Limit exceeded')
            ? withSalesforceError(error.message, exports.REQUEST_LIMIT_EXCEEDED_MESSAGE)
            : withSalesforceError(error.message, exports.MAX_CONCURRENT_REQUESTS_MESSAGE)); },
    },
    _a[constants_1.INVALID_GRANT] = {
        test: function (error) { return error.name === constants_1.INVALID_GRANT; },
        map: function (error) { return withSalesforceError(error.message, exports.INVALID_GRANT_MESSAGE); },
    },
    _a[constants_1.ENOTFOUND] = {
        test: function (error) { return (isDNSException(error) && error.code === constants_1.ENOTFOUND); },
        map: function (error) { return (withSalesforceError(error.message, "Unable to communicate with the salesforce org at " + error[constants_1.ERROR_PROPERTIES.HOSTNAME] + "."
            + ' This may indicate that the org no longer exists, e.g. a sandbox that was deleted, or due to other network issues.')); },
    },
    _a);
// Deploy Errors Mapping
var SCHEDULABLE_CLASS = 'This schedulable class has jobs pending or in progress';
var MAX_METADATA_DEPLOY_LIMIT = 'Maximum size of request reached. Maximum size of request is 52428800 bytes.';
var MAPPABLE_SALESFORCE_PROBLEMS = [
    SCHEDULABLE_CLASS,
    MAX_METADATA_DEPLOY_LIMIT,
];
var isMappableSalesforceProblem = function (problem) { return (MAPPABLE_SALESFORCE_PROBLEMS.includes(problem)); };
exports.MAPPABLE_PROBLEM_TO_USER_FRIENDLY_MESSAGE = (_b = {},
    _b[SCHEDULABLE_CLASS] = withSalesforceError(SCHEDULABLE_CLASS, 'This deployment contains a scheduled Apex class (or a class related to one).'
        + ' By default, Salesforce does not allow changes to scheduled apex.'
        + ' Please follow the instructions here: https://help.salesforce.com/s/articleView?id=000384960&type=1'),
    _b[MAX_METADATA_DEPLOY_LIMIT] = withSalesforceError(MAX_METADATA_DEPLOY_LIMIT, 'The metadata deployment exceeded the maximum allowed size of 50MB.'
        + ' To avoid this issue, please split your deployment to smaller chunks.'
        + ' For more info you may refer to: https://help.salto.io/en/articles/8263355-the-metadata-deployment-exceeded-the-maximum-allowed-size-of-50mb'),
    _b);
var getUserFriendlyDeployMessage = function (deployMessage) { return (__assign(__assign({}, deployMessage), { problem: isMappableSalesforceProblem(deployMessage.problem)
        ? exports.MAPPABLE_PROBLEM_TO_USER_FRIENDLY_MESSAGE[deployMessage.problem]
        : deployMessage.problem })); };
exports.getUserFriendlyDeployMessage = getUserFriendlyDeployMessage;
exports.mapToUserFriendlyErrorMessages = lowerdash_1.decorators.wrapMethodWith(function (original) { return __awaiter(void 0, void 0, void 0, function () {
    var e_1, userFriendlyMessageByMapperName, matchedMapperNames, _a, mapperName, userFriendlyMessage;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, Promise.resolve(original.call())];
            case 1: return [2 /*return*/, _b.sent()];
            case 2:
                e_1 = _b.sent();
                if (!lodash_1["default"].isError(e_1)) {
                    throw e_1;
                }
                userFriendlyMessageByMapperName = lodash_1["default"].mapValues(lodash_1["default"].pickBy(exports.ERROR_MAPPERS, function (mapper) { return mapper.test(e_1); }), function (mapper) { return mapper.map(e_1); });
                matchedMapperNames = Object.keys(userFriendlyMessageByMapperName);
                if (lodash_1["default"].isEmpty(matchedMapperNames)) {
                    throw e_1;
                }
                else if (matchedMapperNames.length > 1) {
                    log.error('The error %o matched on more than one mapper. Matcher mappers: %o', e_1, matchedMapperNames);
                    throw e_1;
                }
                _a = Object.entries(userFriendlyMessageByMapperName)[0], mapperName = _a[0], userFriendlyMessage = _a[1];
                log.debug('Replacing error %s message to %s. Original error: %o', mapperName, userFriendlyMessage, e_1);
                e_1.message = userFriendlyMessage;
                throw e_1;
            case 3: return [2 /*return*/];
        }
    });
}); });
