"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
exports.__esModule = true;
exports.validateCredentials = exports.getConnectionDetails = exports.loginFromCredentialsAndReturnOrgId = exports.ApiLimitsTooLowError = exports.createRequestModuleFunction = exports.setPollIntervalForConnection = exports.METADATA_NAMESPACE = exports.API_VERSION = void 0;
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
var lodash_1 = require("lodash");
var os_1 = require("os");
var requestretry_1 = require("requestretry");
var lowerdash_1 = require("@salto-io/lowerdash");
var jsforce_1 = require("jsforce");
var adapter_components_1 = require("@salto-io/adapter-components");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var logging_1 = require("@salto-io/logging");
var adapter_api_1 = require("@salto-io/adapter-api");
var constants_1 = require("../constants");
var types_1 = require("../types");
var user_facing_errors_1 = require("./user_facing_errors");
var config_change_1 = require("../config_change");
var makeArray = lowerdash_1.collections.array.makeArray;
var toMD5 = lowerdash_1.hash.toMD5;
var log = logging_1.logger(module);
var logDecorator = adapter_components_1.client.logDecorator, throttle = adapter_components_1.client.throttle, requiresLogin = adapter_components_1.client.requiresLogin, createRateLimitersFromConfig = adapter_components_1.client.createRateLimitersFromConfig;
exports.API_VERSION = '55.0';
exports.METADATA_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata';
// Salesforce limitation of maximum number of items per create/update/delete call
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_createMetadata.htm
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_updateMetadata.htm
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deleteMetadata.htm
var MAX_ITEMS_IN_WRITE_REQUEST = 10;
// Salesforce limitation of maximum number of items per describeSObjects call
//  https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_calls_describesobjects.htm?search_text=describeSObjects
var MAX_ITEMS_IN_DESCRIBE_REQUEST = 100;
// Salesforce limitation of maximum number of items per readMetadata call
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm
var MAX_ITEMS_IN_READ_METADATA_REQUEST = 10;
// Salesforce limitation of maximum number of ListMetadataQuery per listMetadata call
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_listmetadata.htm?search_text=listmetadata
var MAX_ITEMS_IN_LIST_METADATA_REQUEST = 3;
var DEFAULT_RETRY_OPTS = {
    maxAttempts: 3,
    retryDelay: 5000,
    retryStrategy: 'NetworkError',
    timeout: 60 * 1000 * 8,
};
var DEFAULT_READ_METADATA_CHUNK_SIZE = {
    "default": MAX_ITEMS_IN_READ_METADATA_REQUEST,
    overrides: {
        Profile: 1,
        PermissionSet: 1,
    },
};
// This is attempting to work around issues where the Salesforce API sometimes
// returns invalid responses for no apparent reason, causing jsforce to crash.
// We hope retrying will help...
var errorMessagesToRetry = [
    'Cannot read property \'result\' of null',
    'Too many properties to enumerate',
    /**
     * We saw "unknown_error: retry your request" error message,
     * but in case there is another error that says "retry your request", probably we should retry it
     */
    'retry your request',
    'Polling time out',
    'SERVER_UNAVAILABLE',
    'system may be currently unavailable',
    'Unexpected internal servlet state',
    'socket hang up',
    'An internal server error has occurred',
    'An unexpected connection error occurred',
    'ECONNREFUSED',
    'Internal_Error',
];
var isAlreadyDeletedError = function (error) { return (error.statusCode === 'INVALID_CROSS_REFERENCE_KEY'
    && error.message.match(/no.*named.*found/) !== null); };
var isSFDCUnhandledException = function (error) { return (!config_change_1.HANDLED_ERROR_PREDICATES.some(function (predicate) { return predicate(error); })); };
var validateCRUDResult = function (isDelete) {
    return lowerdash_1.decorators.wrapMethodWith(function (original) { return __awaiter(void 0, void 0, void 0, function () {
        var result, errors, _a, silencedErrors, realErrors;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, original.call()];
                case 1:
                    result = _b.sent();
                    errors = lodash_1["default"](makeArray(result))
                        .filter(function (r) { return r; })
                        .map(function (r) { return r; })
                        .map(function (r) { return makeArray(r.errors); })
                        .flatten()
                        .value();
                    _a = lodash_1["default"].partition(errors, function (err) { return isDelete && isAlreadyDeletedError(err); }), silencedErrors = _a[0], realErrors = _a[1];
                    if (silencedErrors.length > 0) {
                        log.debug('ignoring errors:%s%s', os_1.EOL, silencedErrors.map(function (e) { return e.message; }).join(os_1.EOL));
                    }
                    if (realErrors.length > 0) {
                        throw new Error(realErrors.map(function (e) { return e.message; }).join(os_1.EOL));
                    }
                    return [2 /*return*/, result];
            }
        });
    }); });
};
var validateDeleteResult = validateCRUDResult(true);
var validateSaveResult = validateCRUDResult(false);
var DEFAULT_POLLING_CONFIG = {
    interval: 3000,
    deployTimeout: 1000 * 60 * 90,
    fetchTimeout: 1000 * 60 * 30,
};
var setPollIntervalForConnection = function (connection, pollingConfig) {
    // Set poll interval for fetch & bulk ops (e.g. CSV deletes)
    connection.metadata.pollInterval = pollingConfig.interval;
    connection.bulk.pollInterval = pollingConfig.interval;
};
exports.setPollIntervalForConnection = setPollIntervalForConnection;
var createRequestModuleFunction = function (retryOptions) {
    return function (opts, callback) {
        return requestretry_1["default"](__assign(__assign({}, retryOptions), opts), function (err, response, body) {
            var attempts = lodash_1["default"].get(response, 'attempts') || lodash_1["default"].get(err, 'attempts');
            if (attempts && attempts > 1) {
                log.warn('sfdc client retry attempts: %o', attempts);
            }
            // Temp code to check to have more details to fix https://salto-io.atlassian.net/browse/SALTO-1600
            // response can be undefined when there was an error
            if (response !== undefined && !response.request.path.startsWith('/services/Soap')) {
                log.debug('Received headers: %o from request to path: %s', response.headers, response.request.path);
            }
            return callback(err, response, body);
        });
    };
};
exports.createRequestModuleFunction = createRequestModuleFunction;
var oauthConnection = function (params) {
    log.debug('creating OAuth connection', {
        instanceUrl: params.instanceUrl,
        accessToken: toMD5(params.accessToken),
        refreshToken: toMD5(params.refreshToken),
    });
    var conn = new jsforce_1.Connection({
        oauth2: {
            clientId: params.clientId,
            clientSecret: params.clientSecret,
            loginUrl: params.isSandbox ? 'https://test.salesforce.com' : 'https://login.salesforce.com',
        },
        version: exports.API_VERSION,
        instanceUrl: params.instanceUrl,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        requestModule: exports.createRequestModuleFunction(params.retryOptions),
    });
    conn.on('refresh', function (accessToken) {
        log.debug('accessToken has been refreshed', { accessToken: toMD5(accessToken) });
    });
    return conn;
};
var realConnection = function (isSandbox, retryOptions) { return (new jsforce_1.Connection({
    version: exports.API_VERSION,
    loginUrl: "https://" + (isSandbox ? 'test' : 'login') + ".salesforce.com/",
    requestModule: exports.createRequestModuleFunction(retryOptions),
})); };
var sendChunked = function (_a) {
    var input = _a.input, sendChunk = _a.sendChunk, operationInfo = _a.operationInfo, _b = _a.chunkSize, chunkSize = _b === void 0 ? MAX_ITEMS_IN_WRITE_REQUEST : _b, _c = _a.isSuppressedError, isSuppressedError = _c === void 0 ? function () { return false; } : _c, _d = _a.isUnhandledError, isUnhandledError = _d === void 0 ? function () { return true; } : _d;
    return __awaiter(void 0, void 0, void 0, function () {
        var sendSingleChunk, result;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    sendSingleChunk = function (chunkInput) { return __awaiter(void 0, void 0, void 0, function () {
                        var result_1, _a, error_1, sendChunkResult;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 5]);
                                    log.debug('Sending chunked %s on %o', operationInfo, chunkInput);
                                    _a = makeArray;
                                    return [4 /*yield*/, sendChunk(chunkInput)];
                                case 1:
                                    result_1 = _a.apply(void 0, [_b.sent()]).map(adapter_utils_1.flatValues);
                                    if (chunkSize === 1 && chunkInput.length > 0) {
                                        log.debug('Finished %s on %o', operationInfo, chunkInput[0]);
                                    }
                                    return [2 /*return*/, { result: result_1, errors: [] }];
                                case 2:
                                    error_1 = _b.sent();
                                    if (!(chunkInput.length > 1)) return [3 /*break*/, 4];
                                    // Try each input individually to single out the one that caused the error
                                    log.warn('chunked %s failed on chunk with error: %s. Message: %s. Trying each element separately.', operationInfo, error_1.name, error_1.message);
                                    return [4 /*yield*/, Promise.all(chunkInput.map(function (item) { return sendSingleChunk([item]); }))];
                                case 3:
                                    sendChunkResult = _b.sent();
                                    return [2 /*return*/, {
                                            result: lodash_1["default"].flatten(sendChunkResult.map(function (e) { return e.result; }).map(adapter_utils_1.flatValues)),
                                            errors: lodash_1["default"].flatten(sendChunkResult.map(function (e) { return e.errors; })),
                                        }];
                                case 4:
                                    if (isSuppressedError(error_1)) {
                                        log.warn('chunked %s ignoring recoverable error on %o: %s', operationInfo, chunkInput[0], error_1.message);
                                        return [2 /*return*/, { result: [], errors: [] }];
                                    }
                                    if (isUnhandledError(error_1)) {
                                        log.warn('chunked %s unrecoverable error on %o: %o', operationInfo, chunkInput[0], error_1);
                                        throw error_1;
                                    }
                                    log.warn('chunked %s unknown error on %o: %o', operationInfo, chunkInput[0], error_1);
                                    return [2 /*return*/, { result: [], errors: chunkInput.map(function (i) { return ({ input: i, error: error_1 }); }) }];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, Promise.all(lodash_1["default"].chunk(makeArray(input), chunkSize)
                            .filter(function (chunk) { return !lodash_1["default"].isEmpty(chunk); })
                            .map(sendSingleChunk))];
                case 1:
                    result = _e.sent();
                    return [2 /*return*/, {
                            result: lodash_1["default"].flatten(result.map(function (e) { return e.result; })),
                            errors: lodash_1["default"].flatten(result.map(function (e) { return e.errors; })),
                        }];
            }
        });
    });
};
var ApiLimitsTooLowError = /** @class */ (function (_super) {
    __extends(ApiLimitsTooLowError, _super);
    function ApiLimitsTooLowError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ApiLimitsTooLowError;
}(Error));
exports.ApiLimitsTooLowError = ApiLimitsTooLowError;
var retry400ErrorWrapper = function (strategy) {
    return function (err, response, body) {
        if (strategy(err, response, body)) {
            return true;
        }
        if (response.statusCode === 400) {
            log.trace("Retrying on 400 due to known salesforce issues. Err: " + err);
            return true;
        }
        return false;
    };
};
var createRetryOptions = function (retryOptions) { return ({
    maxAttempts: retryOptions.maxAttempts,
    retryStrategy: retry400ErrorWrapper(requestretry_1.RetryStrategies[retryOptions.retryStrategy]),
    timeout: retryOptions.timeout,
    delayStrategy: function (err, _response, _body) {
        var _a;
        log.warn('failed to run SFDC call for reason: %s. Retrying in %ss.', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : '', (retryOptions.retryDelay / 1000));
        return retryOptions.retryDelay;
    },
}); };
var createConnectionFromCredentials = function (creds, options) {
    if (creds instanceof types_1.OauthAccessTokenCredentials) {
        try {
            return oauthConnection({
                instanceUrl: creds.instanceUrl,
                accessToken: creds.accessToken,
                refreshToken: creds.refreshToken,
                retryOptions: options,
                clientId: creds.clientId,
                clientSecret: creds.clientSecret,
                isSandbox: creds.isSandbox,
            });
        }
        catch (error) {
            throw new adapter_api_1.CredentialError(error.message);
        }
    }
    return realConnection(creds.isSandbox, options);
};
var retryOnBadResponse = function (request, retryAttempts) {
    if (retryAttempts === void 0) { retryAttempts = DEFAULT_RETRY_OPTS.maxAttempts; }
    return __awaiter(void 0, void 0, void 0, function () {
        var requestWithRetry;
        return __generator(this, function (_a) {
            requestWithRetry = function (attempts) { return __awaiter(void 0, void 0, void 0, function () {
                var res, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, request()];
                        case 1:
                            res = _a.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            e_1 = _a.sent();
                            log.warn("caught exception: " + e_1.message + ". " + attempts + " retry attempts left from " + retryAttempts + " in total");
                            if (attempts > 1 && errorMessagesToRetry.some(function (message) { return e_1.message.includes(message); })) {
                                log.warn('Encountered invalid result from salesforce, error message: %s, will retry %d more times', e_1.message, attempts - 1);
                                return [2 /*return*/, requestWithRetry(attempts - 1)];
                            }
                            throw e_1;
                        case 3:
                            if (typeof res === 'string') {
                                log.warn('Received string when expected object, attempting the json parse the received string');
                                try {
                                    return [2 /*return*/, JSON.parse(res)];
                                }
                                catch (e) {
                                    log.warn('Received string that is not json parsable when expected object. Retries left %d', attempts - 1);
                                    if (attempts > 1) {
                                        return [2 /*return*/, requestWithRetry(attempts - 1)];
                                    }
                                    throw e;
                                }
                            }
                            return [2 /*return*/, res];
                    }
                });
            }); };
            return [2 /*return*/, requestWithRetry(retryAttempts)];
        });
    });
};
var loginFromCredentialsAndReturnOrgId = function (connection, creds) { return __awaiter(void 0, void 0, void 0, function () {
    var error_2, identityInfo;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!(creds instanceof types_1.UsernamePasswordCredentials)) return [3 /*break*/, 4];
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, connection.login(creds.username, creds.password + ((_a = creds.apiToken) !== null && _a !== void 0 ? _a : ''))];
            case 2: return [2 /*return*/, (_b.sent()).organizationId];
            case 3:
                error_2 = _b.sent();
                throw new adapter_api_1.CredentialError(error_2.message);
            case 4: return [4 /*yield*/, retryOnBadResponse(function () { return connection.identity(); })];
            case 5:
                identityInfo = _b.sent();
                log.debug("connected salesforce user: " + identityInfo.username, { identityInfo: identityInfo });
                return [2 /*return*/, identityInfo.organization_id];
        }
    });
}); };
exports.loginFromCredentialsAndReturnOrgId = loginFromCredentialsAndReturnOrgId;
var getConnectionDetails = function (creds, connection) { return __awaiter(void 0, void 0, void 0, function () {
    var options, conn, orgId, limits;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                options = {
                    maxAttempts: 2,
                    retryStrategy: requestretry_1.RetryStrategies.HTTPOrNetworkError,
                };
                conn = connection || createConnectionFromCredentials(creds, options);
                return [4 /*yield*/, exports.loginFromCredentialsAndReturnOrgId(conn, creds)];
            case 1:
                orgId = (_a.sent());
                return [4 /*yield*/, conn.limits()];
            case 2:
                limits = _a.sent();
                return [2 /*return*/, {
                        remainingDailyRequests: limits.DailyApiRequests.Remaining,
                        orgId: orgId,
                    }];
        }
    });
}); };
exports.getConnectionDetails = getConnectionDetails;
var validateCredentials = function (creds, minApiRequestsRemaining, connection) {
    if (minApiRequestsRemaining === void 0) { minApiRequestsRemaining = 0; }
    return __awaiter(void 0, void 0, void 0, function () {
        var _a, remainingDailyRequests, orgId;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, exports.getConnectionDetails(creds, connection)];
                case 1:
                    _a = _b.sent(), remainingDailyRequests = _a.remainingDailyRequests, orgId = _a.orgId;
                    if (remainingDailyRequests < minApiRequestsRemaining) {
                        throw new ApiLimitsTooLowError("Remaining limits: " + remainingDailyRequests + ", needed: " + minApiRequestsRemaining);
                    }
                    return [2 /*return*/, orgId];
            }
        });
    });
};
exports.validateCredentials = validateCredentials;
var SalesforceClient = /** @class */ (function () {
    function SalesforceClient(_a) {
        var _this = this;
        var credentials = _a.credentials, connection = _a.connection, config = _a.config;
        var _b;
        this.isLoggedIn = false;
        this.retryOnBadResponse = function (request) {
            var _a;
            var retryAttempts = (_a = _this.retryOptions.maxAttempts) !== null && _a !== void 0 ? _a : DEFAULT_RETRY_OPTS.maxAttempts;
            return retryOnBadResponse(request, retryAttempts);
        };
        this.credentials = credentials;
        this.config = config;
        this.retryOptions = createRetryOptions(lodash_1["default"].defaults({}, config === null || config === void 0 ? void 0 : config.retry, DEFAULT_RETRY_OPTS));
        this.conn = connection !== null && connection !== void 0 ? connection : createConnectionFromCredentials(credentials, this.retryOptions);
        var pollingConfig = lodash_1["default"].defaults({}, config === null || config === void 0 ? void 0 : config.polling, DEFAULT_POLLING_CONFIG);
        this.setFetchPollingTimeout = function () {
            _this.conn.metadata.pollTimeout = pollingConfig.fetchTimeout;
            _this.conn.bulk.pollTimeout = pollingConfig.fetchTimeout;
        };
        this.setDeployPollingTimeout = function () {
            _this.conn.metadata.pollTimeout = pollingConfig.deployTimeout;
            _this.conn.bulk.pollTimeout = pollingConfig.deployTimeout;
        };
        exports.setPollIntervalForConnection(this.conn, pollingConfig);
        this.setFetchPollingTimeout();
        this.rateLimiters = createRateLimitersFromConfig({
            rateLimit: lodash_1["default"].defaults({}, config === null || config === void 0 ? void 0 : config.maxConcurrentApiRequests, constants_1.DEFAULT_MAX_CONCURRENT_API_REQUESTS),
            clientName: constants_1.SALESFORCE,
        });
        this.dataRetry = (_b = config === null || config === void 0 ? void 0 : config.dataRetry) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_CUSTOM_OBJECTS_DEFAULT_RETRY_OPTIONS;
        this.clientName = 'SFDC';
        this.readMetadataChunkSize = lodash_1["default"].merge({}, DEFAULT_READ_METADATA_CHUNK_SIZE, config === null || config === void 0 ? void 0 : config.readMetadataChunkSize);
    }
    SalesforceClient.prototype.ensureLoggedIn = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.isLoggedIn) return [3 /*break*/, 2];
                        return [4 /*yield*/, exports.loginFromCredentialsAndReturnOrgId(this.conn, this.credentials)];
                    case 1:
                        _a.sent();
                        this.isLoggedIn = true;
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    SalesforceClient.prototype.isSandbox = function () {
        return this.credentials.isSandbox;
    };
    SalesforceClient.prototype.countInstances = function (typeName) {
        return __awaiter(this, void 0, void 0, function () {
            var countResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.conn.query("SELECT COUNT() FROM " + typeName)];
                    case 1:
                        countResult = _a.sent();
                        return [2 /*return*/, countResult.totalSize];
                }
            });
        });
    };
    /**
     * Extract metadata object names
     */
    SalesforceClient.prototype.listMetadataTypes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var describeResult;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.retryOnBadResponse(function () { return _this.conn.metadata.describe(); })];
                    case 1:
                        describeResult = _a.sent();
                        return [2 /*return*/, adapter_utils_1.flatValues((describeResult).metadataObjects)];
                }
            });
        });
    };
    /**
     * Read information about a value type
     * @param type The name of the metadata type for which you want metadata
     */
    SalesforceClient.prototype.describeMetadataType = function (type) {
        return __awaiter(this, void 0, void 0, function () {
            var fullName, describeResult;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fullName = "{" + exports.METADATA_NAMESPACE + "}" + type;
                        return [4 /*yield*/, this.retryOnBadResponse(function () { return _this.conn.metadata.describeValueType(fullName); })];
                    case 1:
                        describeResult = _a.sent();
                        return [2 /*return*/, adapter_utils_1.flatValues(describeResult)];
                }
            });
        });
    };
    SalesforceClient.prototype.listMetadataObjects = function (listMetadataQuery, isUnhandledError) {
        if (isUnhandledError === void 0) { isUnhandledError = isSFDCUnhandledException; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, sendChunked({
                        operationInfo: 'listMetadataObjects',
                        input: listMetadataQuery,
                        sendChunk: function (chunk) { return _this.retryOnBadResponse(function () { return _this.conn.metadata.list(chunk); }); },
                        chunkSize: MAX_ITEMS_IN_LIST_METADATA_REQUEST,
                        isUnhandledError: isUnhandledError,
                    })];
            });
        });
    };
    SalesforceClient.prototype.getUrl = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                try {
                    return [2 /*return*/, new URL(this.conn.instanceUrl)];
                }
                catch (e) {
                    log.error("Caught exception when tried to parse salesforce url: " + e.stack);
                    return [2 /*return*/, undefined];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Read metadata for salesforce object of specific type and name
     */
    SalesforceClient.prototype.readMetadata = function (type, name, isUnhandledError) {
        var _a;
        if (isUnhandledError === void 0) { isUnhandledError = isSFDCUnhandledException; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_b) {
                return [2 /*return*/, sendChunked({
                        operationInfo: "readMetadata (" + type + ")",
                        input: name,
                        sendChunk: function (chunk) { return _this.retryOnBadResponse(function () { return _this.conn.metadata.read(type, chunk); }); },
                        chunkSize: (_a = this.readMetadataChunkSize.overrides[type]) !== null && _a !== void 0 ? _a : this.readMetadataChunkSize["default"],
                        isSuppressedError: function (error) { return (
                        // This seems to happen with actions that relate to sending emails - these are disabled in
                        // some way on sandboxes and for some reason this causes the SF API to fail reading
                        (_this.credentials.isSandbox && type === 'QuickAction' && error.message === 'targetObject is invalid')
                            || (error.name === 'sf:INSUFFICIENT_ACCESS')
                            // Seems that reading TopicsForObjects for Problem, Incident and ChangeRequest fails.
                            // Unclear why this happens, might be a SF API bug, suppressing as this seems unimportant
                            || (type === 'TopicsForObjects' && error.name === 'sf:INVALID_TYPE_FOR_OPERATION')); },
                        isUnhandledError: isUnhandledError,
                    })];
            });
        });
    };
    /**
     * Extract sobject names
     */
    SalesforceClient.prototype.listSObjects = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = adapter_utils_1.flatValues;
                        return [4 /*yield*/, this.retryOnBadResponse(function () { return _this.conn.describeGlobal(); })];
                    case 1: return [2 /*return*/, _a.apply(void 0, [(_b.sent()).sobjects])];
                }
            });
        });
    };
    SalesforceClient.prototype.describeSObjects = function (objectNames) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, sendChunked({
                        operationInfo: 'describeSObjects',
                        input: objectNames,
                        sendChunk: function (chunk) { return _this.retryOnBadResponse(function () { return _this.conn.soap.describeSObjects(chunk); }); },
                        chunkSize: MAX_ITEMS_IN_DESCRIBE_REQUEST,
                    })];
            });
        });
    };
    /**
     * Create or update a salesforce object
     * @param type The metadata type of the components to be created or updated
     * @param metadata The metadata of the object
     * @returns The save result of the requested creation
     */
    SalesforceClient.prototype.upsert = function (type, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, sendChunked({
                            operationInfo: "upsert (" + type + ")",
                            input: metadata,
                            sendChunk: function (chunk) { return _this.retryOnBadResponse(function () { return _this.conn.metadata.upsert(type, chunk); }); },
                        })];
                    case 1:
                        result = _a.sent();
                        log.debug('upsert %o of type %s [result=%o]', makeArray(metadata).map(function (f) { return f.fullName; }), type, result.result);
                        return [2 /*return*/, result.result];
                }
            });
        });
    };
    /**
     * Deletes salesforce client
     * @param type The metadata type of the components to be deleted
     * @param fullNames The full names of the metadata components
     * @returns The save result of the requested deletion
     */
    SalesforceClient.prototype["delete"] = function (type, fullNames) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, sendChunked({
                            operationInfo: "delete (" + type + ")",
                            input: fullNames,
                            sendChunk: function (chunk) { return _this.retryOnBadResponse(function () { return _this.conn.metadata["delete"](type, chunk); }); },
                        })];
                    case 1:
                        result = _a.sent();
                        log.debug('deleted %o of type %s [result=%o]', fullNames, type, result.result);
                        return [2 /*return*/, result.result];
                }
            });
        });
    };
    SalesforceClient.prototype.retrieve = function (retrieveRequest) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = adapter_utils_1.flatValues;
                        return [4 /*yield*/, this.retryOnBadResponse(function () { return _this.conn.metadata.retrieve(retrieveRequest).complete(); })];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    };
    /**
     * Updates salesforce metadata with the Deploy API
     * @param zip The package zip
     * @param deployOptions Salesforce deployment options
     * @returns The save result of the requested update
     */
    SalesforceClient.prototype.deploy = function (zip, deployOptions) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var defaultDeployOptions, _b, checkOnly, optionsToSend, deployResult, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        this.setDeployPollingTimeout();
                        defaultDeployOptions = { rollbackOnError: true, ignoreWarnings: true };
                        _b = (deployOptions !== null && deployOptions !== void 0 ? deployOptions : {}).checkOnly, checkOnly = _b === void 0 ? false : _b;
                        optionsToSend = ['rollbackOnError', 'ignoreWarnings', 'purgeOnDelete', 'testLevel', 'runTests'];
                        _c = adapter_utils_1.flatValues;
                        return [4 /*yield*/, this.conn.metadata.deploy(zip, __assign(__assign(__assign({}, defaultDeployOptions), lodash_1["default"].pick((_a = this.config) === null || _a === void 0 ? void 0 : _a.deploy, optionsToSend)), { checkOnly: checkOnly })).complete(true)];
                    case 1:
                        deployResult = _c.apply(void 0, [_d.sent()]);
                        this.setFetchPollingTimeout();
                        return [2 /*return*/, deployResult];
                }
            });
        });
    };
    /**
     * preform quick deploy to salesforce metadata
     * @param validationId The package zip
     * @returns The save result of the requested update
     */
    SalesforceClient.prototype.quickDeploy = function (validationId) {
        return __awaiter(this, void 0, void 0, function () {
            var deployResult, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.setDeployPollingTimeout();
                        _a = adapter_utils_1.flatValues;
                        return [4 /*yield*/, this.conn.metadata.deployRecentValidation(validationId).complete(true)];
                    case 1:
                        deployResult = _a.apply(void 0, [_b.sent()]);
                        this.setFetchPollingTimeout();
                        return [2 /*return*/, deployResult];
                }
            });
        });
    };
    SalesforceClient.prototype.query = function (queryString, useToolingApi) {
        var conn = useToolingApi ? this.conn.tooling : this.conn;
        return this.retryOnBadResponse(function () { return conn.query(queryString); });
    };
    SalesforceClient.prototype.queryMore = function (queryString, useToolingApi) {
        var conn = useToolingApi ? this.conn.tooling : this.conn;
        return this.retryOnBadResponse(function () { return conn.queryMore(queryString); });
    };
    /**
     * Queries for all the available Records given a query string
     *
     * This function should be called after logging in
     *
     * @param queryString the string to query with for records
     */
    SalesforceClient.prototype.getQueryAllIterable = function (queryString, useToolingApi) {
        if (useToolingApi === void 0) { useToolingApi = false; }
        return __asyncGenerator(this, arguments, function getQueryAllIterable_1() {
            var hadMore, results, hasMore, nextRecordsUrl;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        hadMore = function (results) {
                            return !lodash_1["default"].isUndefined(results.nextRecordsUrl);
                        };
                        return [4 /*yield*/, __await(this.query(queryString, useToolingApi))];
                    case 1:
                        results = _a.sent();
                        if (!(results.records === undefined)) return [3 /*break*/, 3];
                        log.warn('could not find records in queryAll response for query(\'%s\', %s), response: %o', queryString, useToolingApi, results);
                        return [4 /*yield*/, __await(void 0)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3: return [4 /*yield*/, __await(results.records)];
                    case 4: return [4 /*yield*/, _a.sent()];
                    case 5:
                        _a.sent();
                        hasMore = hadMore(results);
                        _a.label = 6;
                    case 6:
                        if (!hasMore) return [3 /*break*/, 10];
                        nextRecordsUrl = results.nextRecordsUrl;
                        return [4 /*yield*/, __await(this.queryMore(nextRecordsUrl, useToolingApi))];
                    case 7:
                        // eslint-disable-next-line no-await-in-loop
                        results = _a.sent();
                        if (results.records === undefined) {
                            log.warn('could not find records in queryAll response for queryMore(\'%s\', %s), response: %o', queryString, useToolingApi, results);
                            return [3 /*break*/, 10];
                        }
                        return [4 /*yield*/, __await(results.records)];
                    case 8: return [4 /*yield*/, _a.sent()];
                    case 9:
                        _a.sent();
                        hasMore = hadMore(results);
                        return [3 /*break*/, 6];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Queries for all the available Records given a query string
     * @param queryString the string to query with for records
     */
    SalesforceClient.prototype.queryAll = function (queryString, useToolingApi) {
        if (useToolingApi === void 0) { useToolingApi = false; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getQueryAllIterable(queryString, useToolingApi)];
            });
        });
    };
    SalesforceClient.prototype.bulkLoadOperation = function (type, operation, records) {
        return __awaiter(this, void 0, void 0, function () {
            var batch, job, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        batch = this.conn.bulk.load(type, operation, { extIdField: constants_1.CUSTOM_OBJECT_ID_FIELD, concurrencyMode: 'Parallel' }, records);
                        job = batch.job;
                        return [4 /*yield*/, new Promise(function (resolve) { return job.on('close', resolve); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, batch.then()];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, adapter_utils_1.flatValues(result)];
                }
            });
        });
    };
    __decorate([
        throttle({ bucketName: 'query' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "countInstances");
    __decorate([
        throttle({ bucketName: 'describe' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "listMetadataTypes");
    __decorate([
        throttle({ bucketName: 'describe' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "describeMetadataType");
    __decorate([
        throttle({ bucketName: 'list', keys: ['type', '0.type'] }),
        logDecorator(['type', '0.type']),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "listMetadataObjects");
    __decorate([
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "getUrl");
    __decorate([
        throttle({ bucketName: 'read' }),
        logDecorator([], function (args) {
            var arg = args[1];
            return (lodash_1["default"].isArray(arg) ? arg : [arg]).length.toString();
        }),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "readMetadata");
    __decorate([
        throttle({ bucketName: 'describe' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "listSObjects");
    __decorate([
        throttle({ bucketName: 'describe' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "describeSObjects");
    __decorate([
        logDecorator(['fullName']),
        validateSaveResult,
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "upsert");
    __decorate([
        logDecorator(),
        validateDeleteResult,
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "delete");
    __decorate([
        throttle({ bucketName: 'retrieve' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "retrieve");
    __decorate([
        throttle({ bucketName: 'deploy' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "deploy");
    __decorate([
        throttle({ bucketName: 'deploy' }),
        logDecorator(),
        requiresLogin()
    ], SalesforceClient.prototype, "quickDeploy");
    __decorate([
        throttle({ bucketName: 'query' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "query");
    __decorate([
        throttle({ bucketName: 'query' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "queryMore");
    __decorate([
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "queryAll");
    __decorate([
        throttle({ bucketName: 'deploy' }),
        logDecorator(),
        requiresLogin(),
        user_facing_errors_1.mapToUserFriendlyErrorMessages
    ], SalesforceClient.prototype, "bulkLoadOperation");
    return SalesforceClient;
}());
exports["default"] = SalesforceClient;
