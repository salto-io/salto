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
exports.CONTENT_TYPE = exports.STATIC_RESOURCE_METADATA_TYPE_ID = void 0;
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
var logging_1 = require("@salto-io/logging");
var lodash_1 = require("lodash");
var mime_types_1 = require("mime-types");
var lowerdash_1 = require("@salto-io/lowerdash");
var constants_1 = require("../constants");
var awu = lowerdash_1.collections.asynciterable.awu;
var log = logging_1.logger(module);
exports.STATIC_RESOURCE_METADATA_TYPE_ID = new adapter_api_1.ElemID(constants_1.SALESFORCE, 'StaticResource');
exports.CONTENT_TYPE = 'contentType';
var RESOURCE_SUFFIX_LENGTH = 'resource'.length;
var modifyFileExtension = function (staticResourceInstance) { return __awaiter(void 0, void 0, void 0, function () {
    var staticFile, content, contentTypeValue, newExtension, currentFilepath;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                staticFile = staticResourceInstance.value[constants_1.METADATA_CONTENT_FIELD];
                if (!adapter_api_1.isStaticFile(staticFile)) {
                    log.debug("Could not modify file extension for " + staticResourceInstance.elemID.getFullName() + " because it is not a StaticFile");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, staticFile.getContent()];
            case 1:
                content = _a.sent();
                if (content === undefined) {
                    log.debug("Could not modify file extension for " + staticResourceInstance.elemID.getFullName() + " because its content is undefined");
                    return [2 /*return*/];
                }
                contentTypeValue = staticResourceInstance.value[exports.CONTENT_TYPE];
                if (!lodash_1["default"].isString(contentTypeValue)) {
                    log.debug("Could not modify file extension for " + staticResourceInstance.elemID.getFullName() + " due to non string contentType: " + contentTypeValue);
                    return [2 /*return*/];
                }
                newExtension = mime_types_1["default"].extension(contentTypeValue);
                if (!lodash_1["default"].isString(newExtension)) {
                    log.debug("Could not modify file extension for " + staticResourceInstance.elemID.getFullName() + " due to unrecognized contentType: " + contentTypeValue);
                    return [2 /*return*/];
                }
                currentFilepath = staticFile.filepath;
                staticResourceInstance.value[constants_1.METADATA_CONTENT_FIELD] = new adapter_api_1.StaticFile({
                    filepath: "" + currentFilepath.slice(0, -RESOURCE_SUFFIX_LENGTH) + newExtension,
                    content: content,
                });
                return [2 /*return*/];
        }
    });
}); };
var filterCreator = function () { return ({
    /**
     * Upon fetch modify the extension of the StaticResource's static file CONTENT field
     * from '.resource' to the correct extension based on the CONTENT_TYPE field
     */
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        var staticResourceInstances;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    staticResourceInstances = adapter_utils_1.findInstances(elements, exports.STATIC_RESOURCE_METADATA_TYPE_ID);
                    return [4 /*yield*/, awu(staticResourceInstances).forEach(modifyFileExtension)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
}); };
exports["default"] = filterCreator;
