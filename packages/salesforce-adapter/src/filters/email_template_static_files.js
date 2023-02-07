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
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var joi_1 = require("joi");
var lodash_1 = require("lodash");
var path_1 = require("path");
var transformer_1 = require("../transformers/transformer");
var constants_1 = require("../constants");
var utils_1 = require("./utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var makeArray = lowerdash_1.collections.array.makeArray;
var log = logging_1.logger(module);
var ATTACHMENT = joi_1["default"].object({
    name: joi_1["default"].string().required(),
    content: joi_1["default"].string().required(),
}).required();
var EMAIL_ATTACHMENTS_ARRAY = joi_1["default"].object({
    attachments: joi_1["default"].array().items(ATTACHMENT).required(),
}).unknown(true);
var isEmailAttachmentsArray = adapter_utils_1.createSchemeGuard(EMAIL_ATTACHMENTS_ARRAY);
var createStaticFile = function (folderName, name, content) {
    return new adapter_api_1.StaticFile({
        filepath: folderName + "/" + name,
        content: Buffer.from(content, 'base64'),
    });
};
var findFolderPath = function (instance) {
    return constants_1.SALESFORCE + "/" + constants_1.RECORDS_PATH + "/" + constants_1.EMAIL_TEMPLATE_METADATA_TYPE + "/" + instance.value.fullName;
};
var organizeStaticFiles = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
    var folderPath, instApiName, emailName, _a, _b;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                folderPath = findFolderPath(instance);
                if (!lodash_1["default"].isUndefined(folderPath)) return [3 /*break*/, 2];
                return [4 /*yield*/, transformer_1.apiName(instance)];
            case 1:
                instApiName = _d.sent();
                log.warn("could not extract the attachments of instance " + instApiName + ", instance path is undefined");
                return [3 /*break*/, 4];
            case 2:
                emailName = folderPath.split('/').pop() + ".email";
                _a = instance.value;
                _b = adapter_api_1.StaticFile.bind;
                _c = {
                    filepath: path_1["default"].join(folderPath, emailName)
                };
                return [4 /*yield*/, instance.value.content.getContent()];
            case 3:
                _a.content = new (_b.apply(adapter_api_1.StaticFile, [void 0, (_c.content = _d.sent(),
                        _c)]))();
                instance.value.attachments = makeArray(instance.value.attachments);
                if (isEmailAttachmentsArray(instance.value)) {
                    instance.value.attachments.forEach(function (attachment) {
                        attachment.content = createStaticFile(
                        // attachmen.content type is a string before the creation of the static file
                        folderPath, attachment.name, attachment.content);
                    });
                }
                _d.label = 4;
            case 4: return [2 /*return*/];
        }
    });
}); };
/**
 * Extract emailTemplate with attachments and save their content in a static file.
 */
var filter = function () { return ({
    onFetch: function (elements) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, awu(elements)
                        .filter(adapter_api_1.isInstanceElement)
                        .filter(utils_1.isInstanceOfType(constants_1.EMAIL_TEMPLATE_METADATA_TYPE))
                        .forEach(organizeStaticFiles)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); },
}); };
exports["default"] = filter;
