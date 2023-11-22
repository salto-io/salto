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
exports.__esModule = true;
exports.validateRegularExpressions = exports.ConfigValidationError = void 0;
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
var lowerdash_1 = require("@salto-io/lowerdash");
var lodash_1 = require("lodash");
var ConfigValidationError = /** @class */ (function (_super) {
    __extends(ConfigValidationError, _super);
    function ConfigValidationError(fieldPath, message) {
        return _super.call(this, "Failed to load config due to an invalid " + fieldPath.join('.') + " value. " + message) || this;
    }
    return ConfigValidationError;
}(Error));
exports.ConfigValidationError = ConfigValidationError;
var validateRegularExpressions = function (regularExpressions, fieldPath) {
    var invalidRegularExpressions = regularExpressions
        .filter(function (strRegex) { return !lowerdash_1.regex.isValidRegex(strRegex); });
    if (!lodash_1["default"].isEmpty(invalidRegularExpressions)) {
        var errMessage = "The following regular expressions are invalid: " + invalidRegularExpressions;
        throw new ConfigValidationError(fieldPath, errMessage);
    }
};
exports.validateRegularExpressions = validateRegularExpressions;
