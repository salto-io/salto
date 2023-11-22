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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
exports.__esModule = true;
exports.loadElementsFromFolder = exports.getAllInstances = exports.OauthAccessTokenCredentials = exports.UsernamePasswordCredentials = exports.SalesforceClient = exports.adapter = exports["default"] = void 0;
var adapter_1 = require("./src/adapter");
__createBinding(exports, adapter_1, "default");
var adapter_creator_1 = require("./src/adapter_creator");
__createBinding(exports, adapter_creator_1, "adapter");
var client_1 = require("./src/client/client");
__createBinding(exports, client_1, "default", "SalesforceClient");
var types_1 = require("./src/types");
__createBinding(exports, types_1, "UsernamePasswordCredentials");
__createBinding(exports, types_1, "OauthAccessTokenCredentials");
var custom_objects_instances_1 = require("./src/filters/custom_objects_instances");
__createBinding(exports, custom_objects_instances_1, "getAllInstances");
var sfdx_parser_1 = require("./src/sfdx_parser/sfdx_parser");
__createBinding(exports, sfdx_parser_1, "loadElementsFromFolder");
