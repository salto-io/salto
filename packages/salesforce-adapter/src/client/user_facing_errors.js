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
exports.mapToUserFriendlyErrorMessages = exports.getUserFriendlyDeployMessage = exports.MAPPABLE_PROBLEM_TO_USER_FRIENDLY_MESSAGE = exports.isMappableErrorProperty = exports.ENOTFOUND_MESSAGE = exports.INVALID_GRANT_MESSAGE = exports.ERROR_HTTP_502_MESSAGE = exports.MAX_CONCURRENT_REQUESTS_MESSAGE = exports.REQUEST_LIMIT_EXCEEDED_MESSAGE = exports.MAPPABLE_ERROR_PROPERTIES = void 0;
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var logging_1 = require("@salto-io/logging");
var constants_1 = require("../constants");
var log = logging_1.logger(module);
var isDefined = lowerdash_1.values.isDefined;
/**
 * To allow more robust support and avoid boilerplate
 * for supporting different Error objects (e.g. Node DNSError, JSForce error)
 * this values can be any of the Error object properties.
 */
exports.MAPPABLE_ERROR_PROPERTIES = [
    constants_1.ERROR_HTTP_502,
    constants_1.SF_REQUEST_LIMIT_EXCEEDED,
    constants_1.INVALID_GRANT,
    constants_1.ENOTFOUND,
];
exports.REQUEST_LIMIT_EXCEEDED_MESSAGE = 'Your Salesforce org has limited API calls for a 24-hour period. '
    + 'We are unable to connect to your org because this limit has been exceeded. '
    + 'Please try again later or contact your account executive to increase your API limit.';
exports.MAX_CONCURRENT_REQUESTS_MESSAGE = 'You have reached the maximum allowed concurrent API requests. '
    + 'For more information please refer to: https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm';
exports.ERROR_HTTP_502_MESSAGE = 'We are unable to connect to your Salesforce account right now. '
    + 'This might be an issue in Salesforce side. please check https://status.salesforce.com/current/incidents';
exports.INVALID_GRANT_MESSAGE = 'Salesforce user is inactive, please re-authenticate';
exports.ENOTFOUND_MESSAGE = 'Unable to communicate with the salesforce org.'
    + 'This may indicate that the org no longer exists, e.g. a sandbox that was deleted, or due to other network issues.';
var mapRequestLimitExceededError = function (error) { return (error.message.includes('TotalRequests Limit exceeded')
    ? exports.REQUEST_LIMIT_EXCEEDED_MESSAGE
    : exports.MAX_CONCURRENT_REQUESTS_MESSAGE); };
var ERROR_MAPPERS = (_a = {},
    _a[constants_1.ERROR_HTTP_502] = exports.ERROR_HTTP_502_MESSAGE,
    _a[constants_1.SF_REQUEST_LIMIT_EXCEEDED] = mapRequestLimitExceededError,
    _a[constants_1.INVALID_GRANT] = exports.INVALID_GRANT_MESSAGE,
    _a[constants_1.ENOTFOUND] = exports.ENOTFOUND_MESSAGE,
    _a);
var isMappableErrorProperty = function (errorProperty) { return (exports.MAPPABLE_ERROR_PROPERTIES.includes(errorProperty)); };
exports.isMappableErrorProperty = isMappableErrorProperty;
// Deploy Errors Mapping
var SCHEDULABLE_CLASS = 'This schedulable class has jobs pending or in progress';
var MAPPABLE_SALESFORCE_PROBLEMS = [
    SCHEDULABLE_CLASS,
];
var isMappableSalesforceProblem = function (problem) { return (MAPPABLE_SALESFORCE_PROBLEMS.includes(problem)); };
exports.MAPPABLE_PROBLEM_TO_USER_FRIENDLY_MESSAGE = (_b = {},
    _b[SCHEDULABLE_CLASS] = 'This deployment contains a scheduled Apex class (or a class related to one).'
        + 'By default, Salesforce does not allow changes to scheduled apex. '
        + 'Please follow the instructions here: https://help.salesforce.com/s/articleView?id=000384960&type=1',
    _b);
var getUserFriendlyDeployMessage = function (deployMessage) { return (__assign(__assign({}, deployMessage), { problem: isMappableSalesforceProblem(deployMessage.problem)
        ? exports.MAPPABLE_PROBLEM_TO_USER_FRIENDLY_MESSAGE[deployMessage.problem]
        : deployMessage.problem })); };
exports.getUserFriendlyDeployMessage = getUserFriendlyDeployMessage;
exports.mapToUserFriendlyErrorMessages = lowerdash_1.decorators.wrapMethodWith(function (original) { return __awaiter(void 0, void 0, void 0, function () {
    var e_1, mappableError, stringOrFunction, userVisibleErrorMessage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, Promise.resolve(original.call())];
            case 1: return [2 /*return*/, _a.sent()];
            case 2:
                e_1 = _a.sent();
                mappableError = Object.values(e_1)
                    .filter(lodash_1["default"].isString)
                    .find(exports.isMappableErrorProperty);
                if (isDefined(mappableError)) {
                    stringOrFunction = ERROR_MAPPERS[mappableError];
                    userVisibleErrorMessage = lodash_1["default"].isString(stringOrFunction)
                        ? stringOrFunction
                        : stringOrFunction(e_1);
                    log.debug('Replacing error %s message to %s. Original error: %o', mappableError, userVisibleErrorMessage, e_1);
                    e_1.message = userVisibleErrorMessage;
                }
                throw e_1;
            case 3: return [2 /*return*/];
        }
    });
}); });
