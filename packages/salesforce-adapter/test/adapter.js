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
var adapter_utils_1 = require("@salto-io/adapter-utils");
var adapter_1 = require("../src/adapter");
var client_1 = require("./client");
var mockAdapter = function (_a) {
    var _b;
    var _c = _a === void 0 ? {} : _a, adapterParams = _c.adapterParams;
    var _d = client_1["default"]((_b = adapterParams === null || adapterParams === void 0 ? void 0 : adapterParams.config) === null || _b === void 0 ? void 0 : _b.client), connection = _d.connection, client = _d.client;
    var adapter = new adapter_1["default"](__assign({ client: client, metadataTypesOfInstancesFetchedInFilters: ['Queue'], config: {}, elementsSource: adapter_utils_1.buildElementsSourceFromElements([]) }, adapterParams || {}));
    return {
        connection: connection, client: client, adapter: adapter,
    };
};
exports["default"] = mockAdapter;
