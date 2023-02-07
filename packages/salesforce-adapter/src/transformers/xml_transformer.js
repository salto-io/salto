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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.createDeployPackage = exports.fromRetrieveResult = exports.xmlToValues = exports.isComplexType = exports.complexTypesMap = exports.toRetrieveRequest = exports.getManifestTypeName = exports.PACKAGE = exports.metadataTypesWithAttributes = exports.CONTENT_FILENAME_OVERRIDE = void 0;
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
var he_1 = require("he");
var fast_xml_parser_1 = require("fast-xml-parser");
var jszip_1 = require("jszip");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var logging_1 = require("@salto-io/logging");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var client_1 = require("../client/client");
var constants_1 = require("../constants");
var transformer_1 = require("./transformer");
var isDefined = lowerdash_1.values.isDefined;
var makeArray = lowerdash_1.collections.array.makeArray;
var log = logging_1.logger(module);
// if added to an instance, includes the content filename for the deploy package
// and maybe more nesting levels
exports.CONTENT_FILENAME_OVERRIDE = 'deployPkgPartialPath';
exports.metadataTypesWithAttributes = [
    constants_1.LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
];
exports.PACKAGE = 'unpackaged';
var HIDDEN_CONTENT_VALUE = '(hidden)';
var METADATA_XML_SUFFIX = '-meta.xml';
var UNFILED_PUBLIC_FOLDER = 'unfiled$public';
// ComplexTypes used constants
var TYPE = 'type';
var MARKUP = 'markup';
var TARGET_CONFIGS = 'targetConfigs';
var LWC_RESOURCES = 'lwcResources';
var LWC_RESOURCE = 'lwcResource';
var getManifestTypeName = function (type) {
    var _a;
    return (
    // Salesforce quirk - folder instances are listed under their content's type in the manifest
    // Salesforce quirk - settings intances should be deployed under Settings type,
    // although their recieved type is "<name>Settings"
    type.annotations.dirName === 'settings'
        ? constants_1.SETTINGS_METADATA_TYPE
        : ((_a = type.annotations.folderContentType) !== null && _a !== void 0 ? _a : type.annotations.metadataType));
};
exports.getManifestTypeName = getManifestTypeName;
var toRetrieveRequest = function (files) {
    var _a;
    return (_a = {
            apiVersion: client_1.API_VERSION,
            singlePackage: false
        },
        _a[exports.PACKAGE] = {
            version: client_1.API_VERSION,
            types: lodash_1["default"](files)
                .groupBy(function (file) { return file.type; })
                .entries()
                .map(function (_a) {
                var type = _a[0], typeFiles = _a[1];
                return ({ name: type, members: typeFiles.map(function (file) { return file.fullName; }) });
            })
                .value(),
        },
        _a);
};
exports.toRetrieveRequest = toRetrieveRequest;
var addContentFieldAsStaticFile = function (values, valuePath, content, fileName, type, namespacePrefix) {
    var folder = namespacePrefix === undefined
        ? constants_1.SALESFORCE + "/" + constants_1.RECORDS_PATH + "/" + type
        : constants_1.SALESFORCE + "/" + constants_1.INSTALLED_PACKAGES_PATH + "/" + namespacePrefix + "/" + constants_1.RECORDS_PATH + "/" + type;
    lodash_1["default"].set(values, valuePath, content.toString() === HIDDEN_CONTENT_VALUE
        ? content.toString()
        : new adapter_api_1.StaticFile({
            filepath: folder + "/" + fileName.split('/').slice(2).join('/'),
            content: content,
        }));
};
var auraFileSuffixToFieldName = {
    'Controller.js': 'controllerContent',
    '.design': 'designContent',
    '.auradoc': 'documentationContent',
    'Helper.js': 'helperContent',
    '.app': MARKUP,
    '.cmp': MARKUP,
    '.evt': MARKUP,
    '.intf': MARKUP,
    '.tokens': MARKUP,
    'Renderer.js': 'rendererContent',
    '.css': 'styleContent',
    '.svg': 'SVGContent',
};
var auraTypeToFileSuffix = {
    Application: '.app',
    Component: '.cmp',
    Event: '.evt',
    Interface: '.intf',
    Tokens: '.tokens',
};
exports.complexTypesMap = {
    /**
     * AuraDefinitionBundle has several base64Binary content fields. We should use its content fields
     * suffix in order to set their content to the correct field
     */
    AuraDefinitionBundle: {
        addContentFields: function (fileNameToContent, values, type, namespacePrefix) {
            Object.entries(fileNameToContent)
                .forEach(function (_a) {
                var _b;
                var contentFileName = _a[0], content = _a[1];
                var fieldName = (_b = Object.entries(auraFileSuffixToFieldName)
                    .find(function (_a) {
                    var fileSuffix = _a[0], _fieldName = _a[1];
                    return contentFileName.endsWith(fileSuffix);
                })) === null || _b === void 0 ? void 0 : _b[1];
                if (fieldName === undefined) {
                    log.warn("Could not extract field content from " + contentFileName);
                    return;
                }
                addContentFieldAsStaticFile(values, [fieldName], content, contentFileName, type, namespacePrefix);
            });
        },
        /**
         * TYPE field is not returned in the retrieve API and is necessary for future deploys logic
         */
        getMissingFields: function (metadataFileName) {
            var _a;
            var _b;
            var fileName = metadataFileName.split(METADATA_XML_SUFFIX)[0];
            var auraType = (_b = Object.entries(auraTypeToFileSuffix)
                .find(function (_a) {
                var _typeName = _a[0], fileSuffix = _a[1];
                return fileName.endsWith(fileSuffix);
            })) === null || _b === void 0 ? void 0 : _b[0];
            if (auraType === undefined) {
                throw new Error('failed to extract AuraDefinitionBundle type');
            }
            return _a = {}, _a[TYPE] = auraType, _a;
        },
        mapContentFields: function (instanceName, values) {
            var _a;
            var type = values[TYPE];
            if (!Object.keys(auraTypeToFileSuffix).includes(type)) {
                throw new Error(type + " is an invalid AuraDefinitionBundle type");
            }
            return Object.fromEntries(Object.entries(auraFileSuffixToFieldName)
                .filter(function (_a) {
                var _fileSuffix = _a[0], fieldName = _a[1];
                return fieldName !== MARKUP;
            })
                .filter(function (_a) {
                var _fileSuffix = _a[0], fieldName = _a[1];
                return isDefined(values[fieldName]);
            })
                .map(function (_a) {
                var _b;
                var fileSuffix = _a[0], fieldName = _a[1];
                return [fieldName, (_b = {}, _b[exports.PACKAGE + "/aura/" + instanceName + "/" + instanceName + fileSuffix] = values[fieldName], _b)];
            })
                .concat([[MARKUP, (_a = {}, _a[exports.PACKAGE + "/aura/" + instanceName + "/" + instanceName + auraTypeToFileSuffix[type]] = values[MARKUP], _a)]]));
        },
        getMetadataFilePath: function (instanceName, values) {
            var type = values[TYPE];
            if (!Object.keys(auraTypeToFileSuffix).includes(type)) {
                throw new Error(type + " is an invalid AuraDefinitionBundle type");
            }
            return exports.PACKAGE + "/aura/" + instanceName + "/" + instanceName + auraTypeToFileSuffix[type] + METADATA_XML_SUFFIX;
        },
        folderName: 'aura',
    },
    /**
     * LightningComponentBundle has array of base64Binary content fields under LWC_RESOURCES field.
     */
    LightningComponentBundle: {
        addContentFields: function (fileNameToContent, values, type, namespacePrefix) {
            Object.entries(fileNameToContent)
                .forEach(function (_a, index) {
                var contentFileName = _a[0], content = _a[1];
                var resourcePath = [LWC_RESOURCES, LWC_RESOURCE, String(index)];
                addContentFieldAsStaticFile(values, __spreadArrays(resourcePath, ['source']), content, contentFileName, type, namespacePrefix);
                lodash_1["default"].set(values, __spreadArrays(resourcePath, ['filePath']), contentFileName.split(exports.PACKAGE + "/")[1]);
            });
        },
        mapContentFields: function (_instanceName, values) {
            var _a;
            var _b;
            return (_a = {},
                _a[LWC_RESOURCES] = Object.fromEntries(makeArray((_b = values[LWC_RESOURCES]) === null || _b === void 0 ? void 0 : _b[LWC_RESOURCE])
                    .map(function (lwcResource) { return [exports.PACKAGE + "/" + lwcResource.filePath, lwcResource.source]; })),
                _a);
        },
        /**
         * Due to SF quirk, TARGET_CONFIGS field must be in the xml after the targets field
         */
        sortMetadataValues: function (metadataValues) {
            return Object.fromEntries(Object.entries(metadataValues)
                .filter(function (_a) {
                var name = _a[0];
                return name !== TARGET_CONFIGS;
            })
                .concat([[TARGET_CONFIGS, metadataValues[TARGET_CONFIGS]]]));
        },
        getMetadataFilePath: function (instanceName) {
            return exports.PACKAGE + "/lwc/" + instanceName + "/" + instanceName + ".js" + METADATA_XML_SUFFIX;
        },
        folderName: 'lwc',
    },
};
var isComplexType = function (typeName) {
    return Object.keys(exports.complexTypesMap).includes(typeName);
};
exports.isComplexType = isComplexType;
var xmlToValues = function (xmlAsString) {
    var parsedXml = fast_xml_parser_1["default"].parse(xmlAsString, {
        ignoreAttributes: false,
        attributeNamePrefix: constants_1.XML_ATTRIBUTE_PREFIX,
        tagValueProcessor: function (val) { return he_1["default"].decode(val); },
    });
    var parsedEntries = Object.entries(parsedXml);
    if (parsedEntries.length !== 1) {
        // Should never happen
        log.debug('Found %d root nodes in xml: %s', parsedEntries.length, Object.keys(parsedXml).join(','));
        if (parsedEntries.length === 0) {
            return { typeName: '', values: {} };
        }
    }
    var _a = parsedEntries[0], typeName = _a[0], values = _a[1];
    if (!lodash_1["default"].isPlainObject(values)) {
        log.debug('Could not find values for type %s in xml:\n%s', typeName, xmlAsString);
        return { typeName: typeName, values: {} };
    }
    var xmlnsAttributes = ['xmlns', 'xmlns:xsi'].map(function (attr) { return "" + constants_1.XML_ATTRIBUTE_PREFIX + attr; });
    return { typeName: typeName, values: lodash_1["default"].omit(values, xmlnsAttributes) };
};
exports.xmlToValues = xmlToValues;
var extractFileNameToData = function (zip, fileName, withMetadataSuffix, complexType, namespacePrefix) { return __awaiter(void 0, void 0, void 0, function () {
    var zipFile, _a, _b, instanceFolderName, zipFiles, _c, _d, _e;
    var _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                if (!!complexType) return [3 /*break*/, 4];
                zipFile = zip.file(exports.PACKAGE + "/" + fileName + (withMetadataSuffix ? METADATA_XML_SUFFIX : ''));
                if (!(zipFile === null)) return [3 /*break*/, 1];
                _a = {};
                return [3 /*break*/, 3];
            case 1:
                _f = {};
                _b = zipFile.name;
                return [4 /*yield*/, zipFile.async('nodebuffer')];
            case 2:
                _a = (_f[_b] = _g.sent(), _f);
                _g.label = 3;
            case 3: return [2 /*return*/, _a];
            case 4:
                instanceFolderName = namespacePrefix === undefined ? fileName : fileName.replace("" + namespacePrefix + constants_1.NAMESPACE_SEPARATOR, '');
                zipFiles = zip.file(new RegExp("^" + exports.PACKAGE + "/" + instanceFolderName + "/.*"))
                    .filter(function (zipFile) { return zipFile.name.endsWith(METADATA_XML_SUFFIX) === withMetadataSuffix; });
                if (!lodash_1["default"].isEmpty(zipFiles)) return [3 /*break*/, 5];
                _c = {};
                return [3 /*break*/, 7];
            case 5:
                _e = (_d = Object).fromEntries;
                return [4 /*yield*/, Promise.all(zipFiles.map(function (zipFile) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _a = [zipFile.name];
                                return [4 /*yield*/, zipFile.async('nodebuffer')];
                            case 1: return [2 /*return*/, _a.concat([_b.sent()])];
                        }
                    }); }); }))];
            case 6:
                _c = _e.apply(_d, [_g.sent()]);
                _g.label = 7;
            case 7: return [2 /*return*/, _c];
        }
    });
}); };
var fromRetrieveResult = function (result, fileProps, typesWithMetaFile, typesWithContent) { return __awaiter(void 0, void 0, void 0, function () {
    var fromZip, zip, instances;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                fromZip = function (zip, file) { return __awaiter(void 0, void 0, void 0, function () {
                    var fileNameToValuesBuffer, _a, valuesFileName, instanceValuesBuffer, metadataValues, fileNameToContent, complexType, _b, contentFileName, content;
                    var _c;
                    var _d, _e;
                    return __generator(this, function (_f) {
                        switch (_f.label) {
                            case 0: return [4 /*yield*/, extractFileNameToData(zip, file.fileName, typesWithMetaFile.has(file.type) || exports.isComplexType(file.type), exports.isComplexType(file.type), file.namespacePrefix)];
                            case 1:
                                fileNameToValuesBuffer = _f.sent();
                                if (Object.values(fileNameToValuesBuffer).length !== 1) {
                                    if (file.fullName !== UNFILED_PUBLIC_FOLDER) {
                                        log.warn("Expected to retrieve only single values file for instance (type:" + file.type + ", fullName:" + file.fullName + "), found " + Object.values(fileNameToValuesBuffer).length);
                                    }
                                    return [2 /*return*/, undefined];
                                }
                                _a = Object.entries(fileNameToValuesBuffer)[0], valuesFileName = _a[0], instanceValuesBuffer = _a[1];
                                metadataValues = Object.assign(exports.xmlToValues(instanceValuesBuffer.toString()).values, (_c = {}, _c[constants_1.INSTANCE_FULL_NAME_FIELD] = file.fullName, _c));
                                if (!(typesWithContent.has(file.type) || exports.isComplexType(file.type))) return [3 /*break*/, 3];
                                return [4 /*yield*/, extractFileNameToData(zip, file.fileName, false, exports.isComplexType(file.type), file.namespacePrefix)];
                            case 2:
                                fileNameToContent = _f.sent();
                                if (lodash_1["default"].isEmpty(fileNameToContent)) {
                                    log.warn("Could not find content files for instance (type:" + file.type + ", fullName:" + file.fullName + ")");
                                    return [2 /*return*/, undefined];
                                }
                                if (exports.isComplexType(file.type)) {
                                    complexType = exports.complexTypesMap[file.type];
                                    Object.assign(metadataValues, (_e = (_d = complexType.getMissingFields) === null || _d === void 0 ? void 0 : _d.call(complexType, valuesFileName)) !== null && _e !== void 0 ? _e : {});
                                    complexType.addContentFields(fileNameToContent, metadataValues, file.type, file.namespacePrefix);
                                }
                                else {
                                    _b = Object.entries(fileNameToContent)[0], contentFileName = _b[0], content = _b[1];
                                    addContentFieldAsStaticFile(metadataValues, [constants_1.METADATA_CONTENT_FIELD], content, contentFileName, file.type, file.namespacePrefix);
                                }
                                _f.label = 3;
                            case 3:
                                if (file.id !== undefined) {
                                    metadataValues[constants_1.INTERNAL_ID_FIELD] = file.id;
                                }
                                return [2 /*return*/, metadataValues];
                        }
                    });
                }); };
                return [4 /*yield*/, new jszip_1["default"]().loadAsync(Buffer.from(result.zipFile, 'base64'))];
            case 1:
                zip = _a.sent();
                return [4 /*yield*/, Promise.all(fileProps.map(function (file) { return __awaiter(void 0, void 0, void 0, function () {
                        var values;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, fromZip(zip, file)];
                                case 1:
                                    values = _a.sent();
                                    return [2 /*return*/, values === undefined ? undefined : { file: file, values: values }];
                            }
                        });
                    }); }))];
            case 2:
                instances = _a.sent();
                return [2 /*return*/, instances.filter(isDefined)];
        }
    });
}); };
exports.fromRetrieveResult = fromRetrieveResult;
var toMetadataXml = function (name, values) {
    var _a;
    // eslint-disable-next-line new-cap
    return new fast_xml_parser_1["default"].j2xParser({
        attributeNamePrefix: constants_1.XML_ATTRIBUTE_PREFIX,
        ignoreAttributes: false,
        tagValueProcessor: function (val) { return he_1["default"].encode(String(val)); },
    }).parse((_a = {}, _a[name] = lodash_1["default"].omit(values, constants_1.INSTANCE_FULL_NAME_FIELD), _a));
};
var cloneValuesWithAttributePrefixes = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
    var allAttributesPaths, createPathsSetCallback, _a, addAttributePrefixFunc;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                allAttributesPaths = new Set();
                createPathsSetCallback = function (_a) {
                    var value = _a.value, field = _a.field, path = _a.path;
                    if (path && field && field.annotations[constants_1.IS_ATTRIBUTE]) {
                        allAttributesPaths.add(path.getFullName());
                    }
                    return value;
                };
                _a = adapter_utils_1.transformValues;
                _b = {
                    values: instance.value
                };
                return [4 /*yield*/, instance.getType()];
            case 1: return [4 /*yield*/, _a.apply(void 0, [(_b.type = _c.sent(),
                        _b.transformFunc = createPathsSetCallback,
                        _b.pathID = instance.elemID,
                        _b.strict = false,
                        _b.allowEmpty = true,
                        _b)])];
            case 2:
                _c.sent();
                addAttributePrefixFunc = function (_a) {
                    var key = _a.key, pathID = _a.pathID;
                    if (pathID && allAttributesPaths.has(pathID.getFullName())) {
                        return constants_1.XML_ATTRIBUTE_PREFIX + key;
                    }
                    return key;
                };
                return [2 /*return*/, adapter_utils_1.mapKeysRecursive(instance.value, addAttributePrefixFunc, instance.elemID)];
        }
    });
}); };
// Create values with the XML_ATTRIBUTE_PREFIX for xml attributes fields
var getValuesToDeploy = function (instance) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _b = (_a = exports.metadataTypesWithAttributes).includes;
                return [4 /*yield*/, transformer_1.metadataType(instance)];
            case 1:
                if (!_b.apply(_a, [_c.sent()])) {
                    return [2 /*return*/, instance.value];
                }
                return [2 /*return*/, cloneValuesWithAttributePrefixes(instance)];
        }
    });
}); };
var toPackageXml = function (manifest) { return (toMetadataXml('Package', {
    version: client_1.API_VERSION,
    types: __spreadArrays(manifest.entries()).map(function (_a) {
        var name = _a[0], members = _a[1];
        return ({ name: name, members: members });
    }),
})); };
var createDeployPackage = function (deleteBeforeUpdate) {
    var zip = new jszip_1["default"]();
    var addManifest = new lowerdash_1.collections.map.DefaultMap(function () { return []; });
    var deleteManifest = new lowerdash_1.collections.map.DefaultMap(function () { return []; });
    var deletionsPackageName = deleteBeforeUpdate ? 'destructiveChanges.xml' : 'destructiveChangesPost.xml';
    var addToManifest = function (type, name) {
        var typeName = exports.getManifestTypeName(type);
        addManifest.get(typeName).push(name);
    };
    return {
        add: function (instance, withManifest) {
            if (withManifest === void 0) { withManifest = true; }
            return __awaiter(void 0, void 0, void 0, function () {
                var instanceName, _a, _b, typeName, values, _c, complexType, fieldToFileToContent, metadataValues, fileNameToContentMaps, _d, dirName, suffix, hasMetaFile, instanceContentPath;
                var _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0: return [4 /*yield*/, transformer_1.apiName(instance)];
                        case 1:
                            instanceName = _h.sent();
                            if (!withManifest) return [3 /*break*/, 3];
                            _a = addToManifest;
                            _b = transformer_1.assertMetadataObjectType;
                            return [4 /*yield*/, instance.getType()];
                        case 2:
                            _a.apply(void 0, [_b.apply(void 0, [_h.sent()]), instanceName]);
                            _h.label = 3;
                        case 3: return [4 /*yield*/, transformer_1.metadataType(instance)];
                        case 4:
                            typeName = _h.sent();
                            _c = getValuesToDeploy;
                            return [4 /*yield*/, transformer_1.toDeployableInstance(instance)];
                        case 5: return [4 /*yield*/, _c.apply(void 0, [_h.sent()])];
                        case 6:
                            values = _h.sent();
                            if (!exports.isComplexType(typeName)) return [3 /*break*/, 7];
                            complexType = exports.complexTypesMap[typeName];
                            fieldToFileToContent = complexType.mapContentFields(instanceName, values);
                            metadataValues = lodash_1["default"].omit.apply(lodash_1["default"], __spreadArrays([values], Object.keys(fieldToFileToContent)));
                            zip.file(complexType.getMetadataFilePath(instanceName, values), toMetadataXml(typeName, (_f = (_e = complexType.sortMetadataValues) === null || _e === void 0 ? void 0 : _e.call(complexType, metadataValues)) !== null && _f !== void 0 ? _f : metadataValues));
                            fileNameToContentMaps = Object.values(fieldToFileToContent);
                            fileNameToContentMaps.forEach(function (fileNameToContentMap) {
                                return Object.entries(fileNameToContentMap)
                                    .forEach(function (_a) {
                                    var fileName = _a[0], content = _a[1];
                                    return zip.file(fileName, content);
                                });
                            });
                            return [3 /*break*/, 9];
                        case 7: return [4 /*yield*/, instance.getType()];
                        case 8:
                            _d = (_h.sent()).annotations, dirName = _d.dirName, suffix = _d.suffix, hasMetaFile = _d.hasMetaFile;
                            instanceContentPath = __spreadArrays([
                                exports.PACKAGE,
                                dirName
                            ], (_g = instance.annotations[exports.CONTENT_FILENAME_OVERRIDE]) !== null && _g !== void 0 ? _g : ["" + instanceName + (suffix === undefined ? '' : "." + suffix)]).join('/');
                            if (hasMetaFile) {
                                zip.file("" + instanceContentPath + METADATA_XML_SUFFIX, toMetadataXml(typeName, lodash_1["default"].omit(values, constants_1.METADATA_CONTENT_FIELD)));
                                if (values[constants_1.METADATA_CONTENT_FIELD] !== undefined) {
                                    zip.file(instanceContentPath, values[constants_1.METADATA_CONTENT_FIELD]);
                                }
                            }
                            else {
                                zip.file(instanceContentPath, toMetadataXml(typeName, values));
                            }
                            _h.label = 9;
                        case 9: return [2 /*return*/];
                    }
                });
            });
        },
        addToManifest: addToManifest,
        "delete": function (type, name) {
            var typeName = exports.getManifestTypeName(type);
            deleteManifest.get(typeName).push(name);
        },
        getZip: function () {
            zip.file(exports.PACKAGE + "/package.xml", toPackageXml(addManifest));
            if (deleteManifest.size !== 0) {
                zip.file(exports.PACKAGE + "/" + deletionsPackageName, toPackageXml(deleteManifest));
            }
            return zip.generateAsync({ type: 'nodebuffer' });
        },
        getDeletionsPackageName: function () { return deletionsPackageName; },
    };
};
exports.createDeployPackage = createDeployPackage;
