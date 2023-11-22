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
exports.adapter = exports.getConfigChange = exports.createUrlFromUserInput = void 0;
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
var logging_1 = require("@salto-io/logging");
var client_1 = require("./client/client");
var adapter_1 = require("./adapter");
var types_1 = require("./types");
var fetch_profile_1 = require("./fetch_profile/fetch_profile");
var config_validation_1 = require("./config_validation");
var deprecated_config_1 = require("./deprecated_config");
var change_validator_1 = require("./change_validator");
var group_changes_1 = require("./group_changes");
var config_creator_1 = require("./config_creator");
var sfdx_parser_1 = require("./sfdx_parser/sfdx_parser");
var additional_references_1 = require("./additional_references");
var log = logging_1.logger(module);
var credentialsFromConfig = function (config) {
    if (types_1.isAccessTokenConfig(config)) {
        return new types_1.OauthAccessTokenCredentials({
            refreshToken: config.value.refreshToken,
            instanceUrl: config.value.instanceUrl,
            accessToken: config.value.accessToken,
            isSandbox: config.value.sandbox,
            clientId: config.value.clientId,
            clientSecret: config.value.clientSecret,
        });
    }
    return new types_1.UsernamePasswordCredentials({
        username: config.value.username,
        password: config.value.password,
        isSandbox: config.value.sandbox,
        apiToken: config.value.token,
    });
};
var adapterConfigFromConfig = function (config) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    var validateClientConfig = function (clientConfig) {
        var _a, _b;
        if ((clientConfig === null || clientConfig === void 0 ? void 0 : clientConfig.maxConcurrentApiRequests) !== undefined) {
            var invalidValues = (Object.entries(clientConfig.maxConcurrentApiRequests)
                .filter(function (_a) {
                var _name = _a[0], value = _a[1];
                return value === 0;
            }));
            if (invalidValues.length > 0) {
                throw new config_validation_1.ConfigValidationError([types_1.CLIENT_CONFIG, 'maxConcurrentApiRequests'], "maxConcurrentApiRequests values cannot be set to 0. Invalid keys: " + invalidValues.map(function (_a) {
                    var name = _a[0];
                    return name;
                }).join(', '));
            }
        }
        if (((_a = clientConfig === null || clientConfig === void 0 ? void 0 : clientConfig.retry) === null || _a === void 0 ? void 0 : _a.retryStrategy) !== undefined
            && types_1.RetryStrategyName[clientConfig.retry.retryStrategy] === undefined) {
            throw new config_validation_1.ConfigValidationError([types_1.CLIENT_CONFIG, 'clientConfig', 'retry', 'retryStrategy'], "retryStrategy value '" + clientConfig.retry.retryStrategy + "' is not supported");
        }
        if ((clientConfig === null || clientConfig === void 0 ? void 0 : clientConfig.readMetadataChunkSize) !== undefined) {
            var defaultValue = clientConfig === null || clientConfig === void 0 ? void 0 : clientConfig.readMetadataChunkSize["default"];
            if (defaultValue && (defaultValue < 1 || defaultValue > 10)) {
                throw new config_validation_1.ConfigValidationError([types_1.CLIENT_CONFIG, 'readMetadataChunkSize'], "readMetadataChunkSize default value should be between 1 to 10. current value is " + defaultValue);
            }
            var overrides = clientConfig === null || clientConfig === void 0 ? void 0 : clientConfig.readMetadataChunkSize.overrides;
            if (overrides) {
                var invalidValues = Object.entries(overrides)
                    .filter(function (_a) {
                    var _name = _a[0], value = _a[1];
                    return ((value < 1) || (value > 10));
                });
                if (invalidValues.length > 0) {
                    throw new config_validation_1.ConfigValidationError([types_1.CLIENT_CONFIG, 'readMetadataChunkSize'], "readMetadataChunkSize values should be between 1 to 10. Invalid keys: " + invalidValues.map(function (_a) {
                        var name = _a[0];
                        return name;
                    }).join(', '));
                }
            }
        }
        if (((_b = clientConfig === null || clientConfig === void 0 ? void 0 : clientConfig.deploy) === null || _b === void 0 ? void 0 : _b.quickDeployParams) !== undefined) {
            if (clientConfig.deploy.quickDeployParams.requestId === undefined
                || clientConfig.deploy.quickDeployParams.hash === undefined) {
                throw new config_validation_1.ConfigValidationError([types_1.CLIENT_CONFIG, 'deploy', 'quickDeployParams'], 'quickDeployParams must include requestId and hash');
            }
        }
    };
    var validateValidatorsConfig = function (validators) {
        if (validators !== undefined && !lodash_1["default"].isPlainObject(validators)) {
            throw new config_validation_1.ConfigValidationError(['validators'], 'Enabled validators configuration must be an object if it is defined');
        }
        if (lodash_1["default"].isPlainObject(validators)) {
            var validValidatorsNames_1 = Object.keys(change_validator_1.changeValidators);
            Object.entries(validators).forEach(function (_a) {
                var key = _a[0], value = _a[1];
                if (!validValidatorsNames_1.includes(key)) {
                    throw new config_validation_1.ConfigValidationError(['validators', key], "Validator " + key + " does not exist, expected one of " + validValidatorsNames_1.join(','));
                }
                if (!lodash_1["default"].isBoolean(value)) {
                    throw new config_validation_1.ConfigValidationError(['validators', key], 'Value must be true or false');
                }
            });
        }
    };
    var validateEnumFieldPermissions = function (enumFieldPermissions) {
        if (enumFieldPermissions !== undefined && !lodash_1["default"].isBoolean(enumFieldPermissions)) {
            throw new config_validation_1.ConfigValidationError(['enumFieldPermissions'], 'Enabled enumFieldPermissions configuration must be true or false if it is defined');
        }
    };
    fetch_profile_1.validateFetchParameters((_b = (_a = config === null || config === void 0 ? void 0 : config.value) === null || _a === void 0 ? void 0 : _a[types_1.FETCH_CONFIG]) !== null && _b !== void 0 ? _b : {}, [types_1.FETCH_CONFIG]);
    validateClientConfig((_c = config === null || config === void 0 ? void 0 : config.value) === null || _c === void 0 ? void 0 : _c.client);
    validateValidatorsConfig((_e = (_d = config === null || config === void 0 ? void 0 : config.value) === null || _d === void 0 ? void 0 : _d.deploy) === null || _e === void 0 ? void 0 : _e.changeValidators);
    validateEnumFieldPermissions((_f = config === null || config === void 0 ? void 0 : config.value) === null || _f === void 0 ? void 0 : _f.enumFieldPermissions);
    var adapterConfig = {
        fetch: (_g = config === null || config === void 0 ? void 0 : config.value) === null || _g === void 0 ? void 0 : _g[types_1.FETCH_CONFIG],
        maxItemsInRetrieveRequest: (_h = config === null || config === void 0 ? void 0 : config.value) === null || _h === void 0 ? void 0 : _h[types_1.MAX_ITEMS_IN_RETRIEVE_REQUEST],
        enumFieldPermissions: (_j = config === null || config === void 0 ? void 0 : config.value) === null || _j === void 0 ? void 0 : _j[types_1.ENUM_FIELD_PERMISSIONS],
        client: (_k = config === null || config === void 0 ? void 0 : config.value) === null || _k === void 0 ? void 0 : _k[types_1.CLIENT_CONFIG],
        deploy: (_l = config === null || config === void 0 ? void 0 : config.value) === null || _l === void 0 ? void 0 : _l[types_1.DEPLOY_CONFIG],
    };
    Object.keys((_m = config === null || config === void 0 ? void 0 : config.value) !== null && _m !== void 0 ? _m : {})
        .filter(function (k) { return !Object.keys(adapterConfig).includes(k); })
        .forEach(function (k) { return log.debug('Unknown config property was found: %s', k); });
    return adapterConfig;
};
var createUrlFromUserInput = function (value) {
    var endpoint = value.sandbox ? 'test' : 'login';
    return "https://" + endpoint + ".salesforce.com/services/oauth2/authorize?response_type=token&client_id=" + value.consumerKey + "&scope=refresh_token%20full&redirect_uri=http://localhost:" + value.port + "&prompt=login%20consent";
};
exports.createUrlFromUserInput = createUrlFromUserInput;
var createOAuthRequest = function (userInput) { return ({
    url: exports.createUrlFromUserInput(userInput.value),
    oauthRequiredFields: ['refresh_token', 'instance_url', 'access_token'],
}); };
var getConfigChange = function (configFromFetch, configWithoutDeprecated) {
    if (configWithoutDeprecated !== undefined && configFromFetch !== undefined) {
        return {
            config: configFromFetch.config,
            message: configWithoutDeprecated.message + "\nIn Addition, " + configFromFetch.message,
        };
    }
    if (configWithoutDeprecated !== undefined) {
        return configWithoutDeprecated;
    }
    return configFromFetch;
};
exports.getConfigChange = getConfigChange;
exports.adapter = {
    operations: function (context) {
        var _a;
        var updatedConfig = context.config && deprecated_config_1.updateDeprecatedConfiguration(context.config);
        var config = adapterConfigFromConfig((_a = updatedConfig === null || updatedConfig === void 0 ? void 0 : updatedConfig.config) !== null && _a !== void 0 ? _a : context.config);
        var credentials = credentialsFromConfig(context.credentials);
        var client = new client_1["default"]({ credentials: credentials, config: config[types_1.CLIENT_CONFIG] });
        var createSalesforceAdapter = function () {
            var elementsSource = context.elementsSource, getElemIdFunc = context.getElemIdFunc;
            return new adapter_1["default"]({
                client: client,
                config: config,
                getElemIdFunc: getElemIdFunc,
                elementsSource: elementsSource,
            });
        };
        return {
            fetch: function (opts) { return __awaiter(void 0, void 0, void 0, function () {
                var salesforceAdapter, fetchResults;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            salesforceAdapter = createSalesforceAdapter();
                            return [4 /*yield*/, salesforceAdapter.fetch(opts)];
                        case 1:
                            fetchResults = _a.sent();
                            fetchResults.updatedConfig = exports.getConfigChange(fetchResults.updatedConfig, updatedConfig && {
                                config: [updatedConfig.config],
                                message: updatedConfig.message,
                            });
                            return [2 /*return*/, fetchResults];
                    }
                });
            }); },
            deploy: function (opts) { return __awaiter(void 0, void 0, void 0, function () {
                var salesforceAdapter;
                return __generator(this, function (_a) {
                    salesforceAdapter = createSalesforceAdapter();
                    return [2 /*return*/, salesforceAdapter.deploy(opts)];
                });
            }); },
            validate: function (opts) { return __awaiter(void 0, void 0, void 0, function () {
                var salesforceAdapter;
                return __generator(this, function (_a) {
                    salesforceAdapter = createSalesforceAdapter();
                    return [2 /*return*/, salesforceAdapter.validate(opts)];
                });
            }); },
            deployModifiers: {
                changeValidator: change_validator_1["default"]({ config: config, isSandbox: credentials.isSandbox, checkOnly: false, client: client }),
                getChangeGroupIds: group_changes_1.getChangeGroupIds,
            },
            validationModifiers: {
                changeValidator: change_validator_1["default"]({ config: config, isSandbox: credentials.isSandbox, checkOnly: true, client: client }),
            },
        };
    },
    validateCredentials: function (config) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, client_1.validateCredentials(credentialsFromConfig(config))];
    }); }); },
    authenticationMethods: {
        basic: {
            credentialsType: types_1.usernamePasswordCredentialsType,
        },
        oauth: {
            createOAuthRequest: createOAuthRequest,
            credentialsType: types_1.accessTokenCredentialsType,
            oauthRequestParameters: types_1.oauthRequestParameters,
            createFromOauthResponse: function (oldConfig, response) { return ({
                sandbox: oldConfig.sandbox,
                clientId: oldConfig.consumerKey,
                clientSecret: oldConfig.consumerSecret,
                accessToken: response.fields.accessToken,
                instanceUrl: response.fields.instanceUrl,
                refreshToken: response.fields.refreshToken,
            }); },
        },
    },
    configType: types_1.configType,
    configCreator: config_creator_1.configCreator,
    loadElementsFromFolder: sfdx_parser_1.loadElementsFromFolder,
    getAdditionalReferences: additional_references_1.getAdditionalReferences,
};
