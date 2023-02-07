"use strict";
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
var utils_1 = require("./utils");
describe('createCustomObjectType', function () {
    it('should use the provided annotations', function () {
        var objType = utils_1.createCustomObjectType('SomeTypeName', { annotations: { someAnnotation: true } });
        expect(objType.annotations.someAnnotation).toEqual(true);
    });
});
