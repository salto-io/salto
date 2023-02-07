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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
exports.__esModule = true;
exports.allMissingSubTypes = void 0;
var adapter_api_1 = require("@salto-io/adapter-api");
var constants_1 = require("../constants");
var subTypesPath = [constants_1.SALESFORCE, constants_1.TYPES_PATH, constants_1.SUBTYPES_PATH];
var lightningComponentBundleObjectType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'LightningComponentBundleObject'),
    fields: {
        object: { refType: adapter_api_1.BuiltinTypes.STRING },
    },
    annotations: (_a = {},
        _a[constants_1.METADATA_TYPE] = 'LightningComponentBundleObject',
        _a),
    path: __spreadArrays(subTypesPath, ['LightningComponentBundleObject']),
});
var lightningComponentBundlePropertyType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'LightningComponentBundleProperty'),
    fields: {
        datasource: {
            // SALTO-861: retrieved as string delimited by ',' but is a list
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_b = {},
                _b[constants_1.IS_ATTRIBUTE] = true,
                _b),
        },
        "default": {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_c = {},
                _c[constants_1.IS_ATTRIBUTE] = true,
                _c),
        },
        description: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_d = {},
                _d[constants_1.IS_ATTRIBUTE] = true,
                _d),
        },
        label: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_e = {},
                _e[constants_1.IS_ATTRIBUTE] = true,
                _e),
        },
        max: {
            refType: adapter_api_1.BuiltinTypes.NUMBER,
            annotations: (_f = {},
                _f[constants_1.IS_ATTRIBUTE] = true,
                _f),
        },
        min: {
            refType: adapter_api_1.BuiltinTypes.NUMBER,
            annotations: (_g = {},
                _g[constants_1.IS_ATTRIBUTE] = true,
                _g),
        },
        name: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_h = {},
                _h[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true,
                _h[constants_1.IS_ATTRIBUTE] = true,
                _h),
        },
        placeholder: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_j = {},
                _j[constants_1.IS_ATTRIBUTE] = true,
                _j),
        },
        required: {
            refType: adapter_api_1.BuiltinTypes.BOOLEAN,
            annotations: (_k = {},
                _k[constants_1.IS_ATTRIBUTE] = true,
                _k),
        },
        role: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_l = {},
                _l[constants_1.IS_ATTRIBUTE] = true,
                _l),
        },
        type: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_m = {},
                _m[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true,
                _m[constants_1.IS_ATTRIBUTE] = true,
                _m[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({
                    values: ['Boolean', 'Integer', 'String', 'Color', 'Date', 'DateTime'],
                    // eslint-disable-next-line camelcase
                    enforce_value: false,
                }),
                _m),
        },
    },
    annotations: (_o = {},
        _o[constants_1.METADATA_TYPE] = 'LightningComponentBundleProperty',
        _o),
    path: __spreadArrays(subTypesPath, ['LightningComponentBundleProperty']),
});
var lightningComponentBundleSupportedFormFactorType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'LightningComponentBundleSupportedFormFactor'),
    fields: {
        type: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_p = {},
                _p[adapter_api_1.CORE_ANNOTATIONS.REQUIRED] = true,
                _p[adapter_api_1.CORE_ANNOTATIONS.RESTRICTION] = adapter_api_1.createRestriction({ values: ['Small', 'Large'] }),
                _p[constants_1.IS_ATTRIBUTE] = true,
                _p),
        },
    },
    annotations: (_q = {},
        _q[constants_1.METADATA_TYPE] = 'LightningComponentBundleSupportedFormFactor',
        _q),
    path: __spreadArrays(subTypesPath, ['LightningComponentBundleSupportedFormFactor']),
});
var lightningComponentBundleSupportedFormFactorsType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'LightningComponentBundleSupportedFormFactors'),
    fields: {
        supportedFormFactor: {
            refType: new adapter_api_1.ListType(lightningComponentBundleSupportedFormFactorType),
        },
    },
    annotations: (_r = {},
        _r[constants_1.METADATA_TYPE] = 'LightningComponentBundleSupportedFormFactors',
        _r),
    path: __spreadArrays(subTypesPath, ['LightningComponentBundleSupportedFormFactors']),
});
var lightningComponentBundleTargetConfigType = new adapter_api_1.ObjectType({
    elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'LightningComponentBundleTargetConfig'),
    fields: {
        targets: {
            // SALTO-861: retrieved as string delimited by ',' but is a list
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_s = {},
                _s[constants_1.IS_ATTRIBUTE] = true,
                _s),
        },
        configurationEditor: {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_t = {},
                _t[constants_1.IS_ATTRIBUTE] = true,
                _t),
        },
        objects: {
            refType: new adapter_api_1.ListType(lightningComponentBundleObjectType),
        },
        property: {
            refType: lightningComponentBundlePropertyType,
        },
        supportedFormFactors: {
            refType: lightningComponentBundleSupportedFormFactorsType,
        },
    },
    annotations: (_u = {},
        _u[constants_1.METADATA_TYPE] = 'LightningComponentBundleTargetConfig',
        _u),
    path: __spreadArrays(subTypesPath, ['LightningComponentBundleTargetConfig']),
});
exports.allMissingSubTypes = [
    new adapter_api_1.ObjectType({
        // taken from https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_configuration_tags
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'TargetConfigs'),
        fields: {
            targetConfig: {
                refType: new adapter_api_1.ListType(lightningComponentBundleTargetConfigType),
            },
        },
        annotations: (_v = {},
            _v[constants_1.METADATA_TYPE] = 'TargetConfigs',
            _v),
        path: __spreadArrays(subTypesPath, ['TargetConfigs']),
    }),
    lightningComponentBundleTargetConfigType,
    lightningComponentBundleObjectType,
    lightningComponentBundlePropertyType,
    lightningComponentBundleSupportedFormFactorsType,
    lightningComponentBundleSupportedFormFactorType,
];
