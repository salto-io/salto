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
exports.retrieveMetadataInstances = exports.fetchMetadataInstances = exports.notInSkipList = exports.fetchMetadataType = void 0;
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
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lowerdash_1 = require("@salto-io/lowerdash");
var logging_1 = require("@salto-io/logging");
var types_1 = require("./types");
var constants_1 = require("./constants");
var config_change_1 = require("./config_change");
var transformer_1 = require("./transformers/transformer");
var xml_transformer_1 = require("./transformers/xml_transformer");
var utils_1 = require("./filters/utils");
var isDefined = lowerdash_1.values.isDefined;
var makeArray = lowerdash_1.collections.array.makeArray;
var _a = lowerdash_1.collections.asynciterable, awu = _a.awu, keyByAsync = _a.keyByAsync;
var log = logging_1.logger(module);
var fetchMetadataType = function (client, typeInfo, knownTypes, baseTypeNames, childTypeNames) { return __awaiter(void 0, void 0, void 0, function () {
    var typeDesc, folderType, mainTypes, folderTypes, _a, _b;
    var _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, client.describeMetadataType(typeInfo.xmlName)];
            case 1:
                typeDesc = _e.sent();
                folderType = typeInfo.inFolder ? (_d = typeDesc.parentField) === null || _d === void 0 ? void 0 : _d.foreignKeyDomain : undefined;
                return [4 /*yield*/, transformer_1.createMetadataTypeElements({
                        name: typeInfo.xmlName,
                        fields: typeDesc.valueTypeFields,
                        knownTypes: knownTypes,
                        baseTypeNames: baseTypeNames,
                        childTypeNames: childTypeNames,
                        client: client,
                        annotations: {
                            hasMetaFile: typeInfo.metaFile ? true : undefined,
                            folderType: folderType,
                            suffix: typeInfo.suffix,
                            dirName: typeInfo.directoryName,
                        },
                    })];
            case 2:
                mainTypes = _e.sent();
                if (!(folderType === undefined)) return [3 /*break*/, 3];
                _a = [];
                return [3 /*break*/, 6];
            case 3:
                _b = transformer_1.createMetadataTypeElements;
                _c = {
                    name: folderType
                };
                return [4 /*yield*/, client.describeMetadataType(folderType)];
            case 4: return [4 /*yield*/, _b.apply(void 0, [(_c.fields = (_e.sent()).valueTypeFields,
                        _c.knownTypes = knownTypes,
                        _c.baseTypeNames = baseTypeNames,
                        _c.childTypeNames = childTypeNames,
                        _c.client = client,
                        _c.annotations = {
                            hasMetaFile: true,
                            folderContentType: typeInfo.xmlName,
                            dirName: typeInfo.directoryName,
                        },
                        _c)])];
            case 5:
                _a = _e.sent();
                _e.label = 6;
            case 6:
                folderTypes = _a;
                return [2 /*return*/, __spreadArrays(mainTypes, folderTypes)];
        }
    });
}); };
exports.fetchMetadataType = fetchMetadataType;
var withFullPath = function (props, folderPathByName) {
    // the split is required since the fullName for a record within folder is FolderName/RecordName
    var folderName = props.fullName.split('/')[0];
    var fullPath = folderPathByName[folderName];
    return isDefined(fullPath)
        ? __assign(__assign({}, props), { fileName: props.fileName.replace(folderName, fullPath) }) : props;
};
var getNamespace = function (obj) { return (obj.namespacePrefix === undefined || obj.namespacePrefix === '' ? constants_1.DEFAULT_NAMESPACE : obj.namespacePrefix); };
var notInSkipList = function (metadataQuery, file, isFolderType) { return (metadataQuery.isInstanceMatch({
    namespace: getNamespace(file),
    metadataType: file.type,
    name: file.fullName,
    isFolderType: isFolderType,
    changedAt: file.lastModifiedDate,
})); };
exports.notInSkipList = notInSkipList;
var listMetadataObjectsWithinFolders = function (client, metadataQuery, type, folderType, isUnhandledError) { return __awaiter(void 0, void 0, void 0, function () {
    var folderPathByName, folders, includedFolderElements, folderNames, _a, result, errors, elements, configChanges;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                folderPathByName = metadataQuery.getFolderPathsByName(folderType);
                return [4 /*yield*/, utils_1.listMetadataObjects(client, folderType)];
            case 1:
                folders = _b.sent();
                includedFolderElements = folders.elements
                    .map(function (props) { return withFullPath(props, folderPathByName); })
                    .filter(function (props) { return exports.notInSkipList(metadataQuery, props, true); });
                folderNames = Object.keys(folderPathByName)
                    .concat(includedFolderElements.map(function (props) { return props.fullName; }));
                return [4 /*yield*/, client.listMetadataObjects(folderNames.map(function (folderName) { return ({ type: type, folder: folderName }); }), isUnhandledError)];
            case 2:
                _a = _b.sent(), result = _a.result, errors = _a.errors;
                elements = result
                    .map(function (props) { return withFullPath(props, folderPathByName); })
                    .concat(includedFolderElements);
                configChanges = errors
                    .map(function (e) { return e.input; })
                    .map(config_change_1.createListMetadataObjectsConfigChange)
                    .concat(folders.configChanges);
                return [2 /*return*/, { elements: elements, configChanges: configChanges }];
        }
    });
}); };
var getFullName = function (obj, addNamespacePrefixToFullName) {
    if (!obj.namespacePrefix) {
        return obj.fullName;
    }
    var namePrefix = "" + obj.namespacePrefix + constants_1.NAMESPACE_SEPARATOR;
    if (obj.type === constants_1.LAYOUT_TYPE_ID_METADATA_TYPE) {
        // Ensure layout name starts with the namespace prefix if there is one.
        // needed due to a SF quirk where sometimes layout metadata instances fullNames return as
        // <namespace>__<objectName>-<layoutName> where it should be
        // <namespace>__<objectName>-<namespace>__<layoutName>
        var _a = obj.fullName.split('-'), objectName = _a[0], layoutName = _a.slice(1);
        if (layoutName.length !== 0 && !layoutName[0].startsWith(namePrefix)) {
            return objectName + "-" + namePrefix + layoutName.join('-');
        }
        return obj.fullName;
    }
    if (!addNamespacePrefixToFullName) {
        log.debug('obj.fullName %s is missing namespace %s. Not adding because addNamespacePrefixToFullName is false. FileProps: %o', obj.fullName, obj.namespacePrefix, obj);
        return obj.fullName;
    }
    // Instances of type InstalledPackage fullNames should never include the namespace prefix
    if (obj.type === constants_1.INSTALLED_PACKAGE_METADATA) {
        return obj.fullName;
    }
    var fullNameParts = obj.fullName.split(constants_1.API_NAME_SEPARATOR);
    var name = fullNameParts.slice(-1)[0];
    var parentNames = fullNameParts.slice(0, -1);
    if (name.startsWith(namePrefix)) {
        return obj.fullName;
    }
    // In some cases, obj.fullName does not contain the namespace prefix even though
    // obj.namespacePrefix is defined. In these cases, we want to add the prefix manually
    return __spreadArrays(parentNames, ["" + namePrefix + name]).join(constants_1.API_NAME_SEPARATOR);
};
var getPropsWithFullName = function (obj, addNamespacePrefixToFullName, orgNamespace) {
    // Do not run getFullName logic if the namespace of the instance is the current org namespace.
    // If we couldn't determine the namespace of the org, we will run the logic for all the instances.
    var correctFullName = orgNamespace === undefined || obj.namespacePrefix !== orgNamespace
        ? getFullName(obj, addNamespacePrefixToFullName)
        : obj.fullName;
    return __assign(__assign({}, obj), { fullName: correctFullName, fileName: obj.fileName.includes(correctFullName)
            ? obj.fileName
            : obj.fileName.replace(obj.fullName, correctFullName) });
};
var getInstanceFromMetadataInformation = function (metadata, filePropertiesMap, metadataType) {
    var _a;
    var _b, _c, _d, _e;
    var newMetadata = ((_b = filePropertiesMap[metadata.fullName]) === null || _b === void 0 ? void 0 : _b.id) !== undefined && ((_c = filePropertiesMap[metadata.fullName]) === null || _c === void 0 ? void 0 : _c.id) !== ''
        ? __assign(__assign({}, metadata), (_a = {}, _a[constants_1.INTERNAL_ID_FIELD] = (_d = filePropertiesMap[metadata.fullName]) === null || _d === void 0 ? void 0 : _d.id, _a)) : metadata;
    return transformer_1.createInstanceElement(newMetadata, metadataType, (_e = filePropertiesMap[newMetadata.fullName]) === null || _e === void 0 ? void 0 : _e.namespacePrefix, transformer_1.getAuthorAnnotations(filePropertiesMap[newMetadata.fullName]));
};
var fetchMetadataInstances = function (_a) {
    var client = _a.client, metadataType = _a.metadataType, fileProps = _a.fileProps, metadataQuery = _a.metadataQuery, _b = _a.maxInstancesPerType, maxInstancesPerType = _b === void 0 ? constants_1.UNLIMITED_INSTANCES_VALUE : _b, _c = _a.addNamespacePrefixToFullName, addNamespacePrefixToFullName = _c === void 0 ? true : _c;
    return __awaiter(void 0, void 0, void 0, function () {
        var typeName, instancesCount, reason, skippedListConfigChange, metadataTypeName, filePropsToRead, _d, metadataInfos, errors, fullNamesFromRead, missingMetadata, filePropertiesMap, elements;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (fileProps.length === 0) {
                        return [2 /*return*/, { elements: [], configChanges: [] }];
                    }
                    typeName = fileProps[0].type;
                    instancesCount = fileProps.length;
                    // We exclude metadataTypes with too many instances to avoid unwanted big and slow requests
                    // CustomObjects are checked in another flow
                    if (typeName !== constants_1.CUSTOM_OBJECT
                        && maxInstancesPerType !== constants_1.UNLIMITED_INSTANCES_VALUE
                        && instancesCount > maxInstancesPerType) {
                        reason = "'" + typeName + "' has " + instancesCount + " instances so it was skipped and would be excluded from future fetch operations, as " + types_1.MAX_INSTANCES_PER_TYPE + " is set to " + maxInstancesPerType + ".\n      If you wish to fetch it anyway, remove it from your app configuration exclude block and increase maxInstancePerType to the desired value (" + constants_1.UNLIMITED_INSTANCES_VALUE + " for unlimited).";
                        skippedListConfigChange = config_change_1.createSkippedListConfigChange({ type: typeName, reason: reason });
                        return [2 /*return*/, {
                                elements: [],
                                configChanges: [skippedListConfigChange],
                            }];
                    }
                    return [4 /*yield*/, transformer_1.apiName(metadataType)];
                case 1:
                    metadataTypeName = _e.sent();
                    filePropsToRead = fileProps
                        .map(function (prop) { return (__assign(__assign({}, prop), { fullName: getFullName(prop, addNamespacePrefixToFullName) })); })
                        .filter(function (prop) { return metadataQuery.isInstanceMatch({
                        namespace: getNamespace(prop),
                        metadataType: metadataTypeName,
                        name: prop.fullName,
                        isFolderType: isDefined(metadataType.annotations[constants_1.FOLDER_CONTENT_TYPE]),
                        changedAt: prop.lastModifiedDate,
                    }); });
                    // Avoid sending empty requests for types that had no instances that were changed from the previous fetch
                    // This is a common case for fetchWithChangesDetection mode for types that had no changes on their instances
                    if (filePropsToRead.length === 0) {
                        return [2 /*return*/, { elements: [], configChanges: [] }];
                    }
                    return [4 /*yield*/, client.readMetadata(metadataTypeName, filePropsToRead.map(function (_a) {
                            var fullName = _a.fullName;
                            return fullName;
                        }))];
                case 2:
                    _d = _e.sent(), metadataInfos = _d.result, errors = _d.errors;
                    fullNamesFromRead = new Set(metadataInfos.map(function (info) { return info === null || info === void 0 ? void 0 : info.fullName; }));
                    missingMetadata = filePropsToRead.filter(function (prop) { return !fullNamesFromRead.has(prop.fullName); });
                    if (missingMetadata.length > 0) {
                        log.debug('Missing metadata with valid fileProps: %o', missingMetadata);
                    }
                    filePropertiesMap = lodash_1["default"].keyBy(filePropsToRead, 'fullName');
                    elements = metadataInfos
                        .filter(function (m) { return !lodash_1["default"].isEmpty(m); })
                        .filter(function (m) { return m.fullName !== undefined; })
                        .map(function (m) { return getInstanceFromMetadataInformation(m, filePropertiesMap, metadataType); });
                    return [2 /*return*/, {
                            elements: elements,
                            configChanges: makeArray(errors)
                                .map(function (_a) {
                                var input = _a.input, error = _a.error;
                                return config_change_1.createSkippedListConfigChangeFromError({
                                    creatorInput: { metadataType: metadataTypeName, name: input },
                                    error: error,
                                });
                            }),
                        }];
            }
        });
    });
};
exports.fetchMetadataInstances = fetchMetadataInstances;
var getTypesWithContent = function (types) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = Set.bind;
                return [4 /*yield*/, awu(types)
                        .filter(function (t) { return Object.keys(t.fields).includes(constants_1.METADATA_CONTENT_FIELD); })
                        .map(function (t) { return transformer_1.apiName(t); })
                        .toArray()];
            case 1: return [2 /*return*/, new (_a.apply(Set, [void 0, _b.sent()]))()];
        }
    });
}); };
var getTypesWithMetaFile = function (types) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = Set.bind;
                return [4 /*yield*/, awu(types)
                        .filter(function (t) { return t.annotations.hasMetaFile === true; })
                        .map(function (t) { return transformer_1.apiName(t); })
                        .toArray()];
            case 1: return [2 /*return*/, new (_a.apply(Set, [void 0, _b.sent()]))()];
        }
    });
}); };
var retrieveMetadataInstances = function (_a) {
    var client = _a.client, types = _a.types, maxItemsInRetrieveRequest = _a.maxItemsInRetrieveRequest, metadataQuery = _a.metadataQuery, fetchProfile = _a.fetchProfile, typesToSkip = _a.typesToSkip;
    return __awaiter(void 0, void 0, void 0, function () {
        var configChanges, listFilesOfType, typesByName, typesWithMetaFile, typesWithContent, mergeProfileInstances, retrieveInstances, retrieveProfilesWithContextTypes, filesToRetrieve, _b, _c, _d, profileFiles, nonProfileFiles, instances;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    configChanges = [];
                    listFilesOfType = function (type) { return __awaiter(void 0, void 0, void 0, function () {
                        var typeName, folderType, _a, res, listObjectsConfigChanges, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0: return [4 /*yield*/, transformer_1.apiName(type)];
                                case 1:
                                    typeName = _c.sent();
                                    folderType = type.annotations.folderType;
                                    if (!isDefined(folderType)) return [3 /*break*/, 3];
                                    return [4 /*yield*/, listMetadataObjectsWithinFolders(client, metadataQuery, typeName, folderType)];
                                case 2:
                                    _b = _c.sent();
                                    return [3 /*break*/, 5];
                                case 3: return [4 /*yield*/, utils_1.listMetadataObjects(client, typeName)];
                                case 4:
                                    _b = _c.sent();
                                    _c.label = 5;
                                case 5:
                                    _a = _b, res = _a.elements, listObjectsConfigChanges = _a.configChanges;
                                    configChanges.push.apply(configChanges, listObjectsConfigChanges);
                                    return [2 /*return*/, lodash_1["default"](res)
                                            .uniqBy(function (file) { return file.fullName; })
                                            .map(function (file) { return getPropsWithFullName(file, fetchProfile.addNamespacePrefixToFullName, client.orgNamespace); })
                                            .value()];
                            }
                        });
                    }); };
                    return [4 /*yield*/, keyByAsync(types, function (t) { return transformer_1.apiName(t); })];
                case 1:
                    typesByName = _e.sent();
                    return [4 /*yield*/, getTypesWithMetaFile(types)];
                case 2:
                    typesWithMetaFile = _e.sent();
                    return [4 /*yield*/, getTypesWithContent(types)];
                case 3:
                    typesWithContent = _e.sent();
                    mergeProfileInstances = function (instances) {
                        var result = instances[0].clone();
                        result.value = lodash_1["default"].merge.apply(lodash_1["default"], __spreadArrays([{}], instances.map(function (instance) { return instance.value; })));
                        return result;
                    };
                    retrieveInstances = function (fileProps, filePropsToSendWithEveryChunk) {
                        if (filePropsToSendWithEveryChunk === void 0) { filePropsToSendWithEveryChunk = []; }
                        return __awaiter(void 0, void 0, void 0, function () {
                            var allFileProps, filesToRetrieve, typesToRetrieve, request, result, chunkSize, allValues;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        allFileProps = fileProps.concat(filePropsToSendWithEveryChunk);
                                        filesToRetrieve = allFileProps.map(function (inst) { return (__assign(__assign({}, inst), { type: xml_transformer_1.getManifestTypeName(typesByName[inst.type]) })); });
                                        typesToRetrieve = __spreadArrays(new Set(filesToRetrieve.map(function (prop) { return prop.type; }))).join(',');
                                        log.debug('retrieving types %s', typesToRetrieve);
                                        request = xml_transformer_1.toRetrieveRequest(filesToRetrieve);
                                        return [4 /*yield*/, client.retrieve(request)];
                                    case 1:
                                        result = _b.sent();
                                        log.debug('retrieve result for types %s: %o', typesToRetrieve, lodash_1["default"].omit(result, ['zipFile', 'fileProperties']));
                                        if (!(result.errorStatusCode === constants_1.RETRIEVE_SIZE_LIMIT_ERROR)) return [3 /*break*/, 3];
                                        if (fileProps.length <= 1) {
                                            if (filePropsToSendWithEveryChunk.length > 0) {
                                                log.warn('retrieve request for %s failed with %d elements that can`t be removed from the request', typesToRetrieve, filePropsToSendWithEveryChunk.length);
                                                throw new Error('Retrieve size limit exceeded');
                                            }
                                            configChanges.push.apply(configChanges, fileProps.map(function (fileProp) {
                                                return config_change_1.createSkippedListConfigChange({ type: fileProp.type, instance: fileProp.fullName });
                                            }));
                                            log.warn("retrieve request for " + typesToRetrieve + " failed: " + result.errorStatusCode + " " + result.errorMessage + ", adding to skip list");
                                            return [2 /*return*/, []];
                                        }
                                        chunkSize = Math.ceil(fileProps.length / 2);
                                        log.debug('reducing retrieve item count %d -> %d', fileProps.length, chunkSize);
                                        configChanges.push({ type: types_1.MAX_ITEMS_IN_RETRIEVE_REQUEST, value: chunkSize });
                                        return [4 /*yield*/, Promise.all(lodash_1["default"].chunk(fileProps, chunkSize - filePropsToSendWithEveryChunk.length)
                                                .map(function (chunk) { return retrieveInstances(chunk, filePropsToSendWithEveryChunk); }))];
                                    case 2: return [2 /*return*/, (_b.sent())
                                            .flat()];
                                    case 3:
                                        configChanges.push.apply(configChanges, config_change_1.createRetrieveConfigChange(result));
                                        // if we get an error then result.zipFile will be a single 'nil' XML element, which will be parsed as an object by
                                        // our XML->json parser. Since we only deal with RETRIEVE_SIZE_LIMIT_ERROR above, here is where we handle all other
                                        // errors.
                                        if (!lodash_1["default"].isString(result.zipFile)) {
                                            log.warn('retrieve request for types %s failed, zipFile is %o, Result is %o', typesToRetrieve, result.zipFile, result);
                                            throw new Error("Retrieve request for " + typesToRetrieve + " failed. messages: " + makeArray(adapter_utils_1.safeJsonStringify(result.messages)).concat((_a = result.errorMessage) !== null && _a !== void 0 ? _a : []));
                                        }
                                        return [4 /*yield*/, xml_transformer_1.fromRetrieveResult(result, allFileProps, typesWithMetaFile, typesWithContent, fetchProfile.isFeatureEnabled('fixRetrieveFilePaths'))];
                                    case 4:
                                        allValues = _b.sent();
                                        return [2 /*return*/, allValues.map(function (_a) {
                                                var file = _a.file, values = _a.values;
                                                return (transformer_1.createInstanceElement(values, typesByName[file.type], file.namespacePrefix, transformer_1.getAuthorAnnotations(file)));
                                            })];
                                }
                            });
                        });
                    };
                    retrieveProfilesWithContextTypes = function (profileFileProps, contextFileProps) { return __awaiter(void 0, void 0, void 0, function () {
                        var allInstances, _a, partialProfileInstances, contextInstances, profileInstances;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0: return [4 /*yield*/, Promise.all(lodash_1["default"].chunk(contextFileProps, maxItemsInRetrieveRequest - profileFileProps.length)
                                        .filter(function (filesChunk) { return filesChunk.length > 0; })
                                        .map(function (filesChunk) { return retrieveInstances(filesChunk, profileFileProps); }))];
                                case 1:
                                    allInstances = _b.sent();
                                    _a = lodash_1["default"](allInstances)
                                        .flatten()
                                        .partition(function (instance) { return instance.elemID.typeName === constants_1.PROFILE_METADATA_TYPE; })
                                        .value(), partialProfileInstances = _a[0], contextInstances = _a[1];
                                    profileInstances = lodash_1["default"](partialProfileInstances)
                                        .filter(function (instance) { return instance.elemID.typeName === constants_1.PROFILE_METADATA_TYPE; })
                                        .groupBy(function (instance) { return instance.value.fullName; })
                                        .mapValues(mergeProfileInstances)
                                        .value();
                                    return [2 /*return*/, contextInstances.concat(Object.values(profileInstances))];
                            }
                        });
                    }); };
                    _c = (_b = lodash_1["default"]).flatten;
                    return [4 /*yield*/, Promise.all(types
                            // We get folders as part of getting the records inside them
                            .filter(function (type) { return type.annotations.folderContentType === undefined; })
                            .map(listFilesOfType))];
                case 4:
                    filesToRetrieve = _c.apply(_b, [_e.sent()]).filter(function (props) { return exports.notInSkipList(metadataQuery, props, false); });
                    // Avoid sending empty requests for types that had no instances that were changed from the previous fetch
                    // This is a common case for fetchWithChangesDetection mode for types that had no changes on their instances
                    if (filesToRetrieve.length === 0) {
                        log.debug('No files to retrieve, skipping');
                        return [2 /*return*/, { elements: [], configChanges: configChanges }];
                    }
                    log.info('going to retrieve %d files', filesToRetrieve.length);
                    _d = lodash_1["default"].partition(filesToRetrieve, function (file) { return file.type === constants_1.PROFILE_METADATA_TYPE; }), profileFiles = _d[0], nonProfileFiles = _d[1];
                    return [4 /*yield*/, retrieveProfilesWithContextTypes(profileFiles, nonProfileFiles)];
                case 5:
                    instances = _e.sent();
                    return [2 /*return*/, {
                            elements: instances.filter(function (instance) { return !typesToSkip.has(instance.elemID.typeName); }),
                            configChanges: configChanges,
                        }];
            }
        });
    });
};
exports.retrieveMetadataInstances = retrieveMetadataInstances;
