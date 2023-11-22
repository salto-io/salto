"use strict";
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
exports.__esModule = true;
var client_1 = require("../src/client/client");
var connection_1 = require("./connection");
var constants_1 = require("../src/constants");
var mockClient = function (values) {
    var connection = connection_1.mockJsforce();
    var client = new client_1["default"]({
        credentials: {
            username: 'mockUser',
            password: 'mockPassword',
            isSandbox: false,
        },
        connection: connection,
        config: __assign({ maxConcurrentApiRequests: {
                total: constants_1.MAX_TOTAL_CONCURRENT_API_REQUEST,
                retrieve: 3,
                read: constants_1.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
                list: constants_1.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
                query: 4,
                describe: constants_1.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
                deploy: constants_1.RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
            }, dataRetry: {
                maxAttempts: 3,
                retryDelay: 1000,
                retryableFailures: ['err1', 'err2'],
            } }, (values !== null && values !== void 0 ? values : {})),
    });
    return { connection: connection, client: client };
};
exports["default"] = mockClient;
