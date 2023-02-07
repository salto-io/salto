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
exports.retrieveMetadataInstances = exports.fetchMetadataInstances = exports.listMetadataObjects = exports.fetchMetadataType = void 0;
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
var listMetadataObjects = function (client, metadataTypeName, isUnhandledError) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, result, errors;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, client.listMetadataObjects({ type: metadataTypeName }, isUnhandledError)];
            case 1:
                _a = _b.sent(), result = _a.result, errors = _a.errors;
                return [2 /*return*/, {
                        elements: result,
                        configChanges: errors
                            .map(function (e) { return e.input; })
                            .map(config_change_1.createListMetadataObjectsConfigChange),
                    }];
        }
    });
}); };
exports.listMetadataObjects = listMetadataObjects;
var getNamespace = function (obj) { return (obj.namespacePrefix === undefined || obj.namespacePrefix === '' ? constants_1.DEFAULT_NAMESPACE : obj.namespacePrefix); };
var notInSkipList = function (metadataQuery, file, isFolderType) { return (metadataQuery.isInstanceMatch({
    namespace: getNamespace(file),
    metadataType: file.type,
    name: file.fullName,
    isFolderType: isFolderType,
})); };
var listMetadataObjectsWithinFolders = function (client, metadataQuery, type, folderType, isUnhandledError) { return __awaiter(void 0, void 0, void 0, function () {
    var folderPathByName, folders, includedFolderElements, folderNames, _a, result, errors, elements, configChanges;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                folderPathByName = metadataQuery.getFolderPathsByName(folderType);
                return [4 /*yield*/, exports.listMetadataObjects(client, folderType)];
            case 1:
                folders = _b.sent();
                includedFolderElements = folders.elements
                    .map(function (props) { return withFullPath(props, folderPathByName); })
                    .filter(function (props) { return notInSkipList(metadataQuery, props, true); });
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
var getFullName = function (obj) {
    var namePrefix = obj.namespacePrefix
        ? "" + obj.namespacePrefix + constants_1.NAMESPACE_SEPARATOR : '';
    if (obj.type === constants_1.LAYOUT_TYPE_ID_METADATA_TYPE && obj.namespacePrefix) {
        // Ensure layout name starts with the namespace prefix if there is one.
        // needed due to a SF quirk where sometimes layout metadata instances fullNames return as
        // <namespace>__<objectName>-<layoutName> where it should be
        // <namespace>__<objectName>-<namespace>__<layoutName>
        var _a = obj.fullName.split('-'), objectName = _a[0], layoutName = _a.slice(1);
        if (layoutName.length !== 0 && !layoutName[0].startsWith(obj.namespacePrefix)) {
            return objectName + "-" + namePrefix + layoutName.join('-');
        }
    }
    return obj.fullName;
};
var getPropsWithFullName = function (obj) {
    var correctFullName = getFullName(obj);
    return __assign(__assign({}, obj), { fullName: correctFullName, fileName: obj.fileName.includes(correctFullName)
            ? obj.fileName
            : obj.fileName.replace(obj.fullName, correctFullName) });
};
var getInstanceFromMetadataInformation = function (metadata, filePropertiesMap, metadataType) {
    var _a;
    var _b, _c, _d;
    var newMetadata = ((_b = filePropertiesMap[metadata.fullName]) === null || _b === void 0 ? void 0 : _b.id) ? __assign(__assign({}, metadata), (_a = {}, _a[constants_1.INTERNAL_ID_FIELD] = (_c = filePropertiesMap[metadata.fullName]) === null || _c === void 0 ? void 0 : _c.id, _a)) : metadata;
    return transformer_1.createInstanceElement(newMetadata, metadataType, (_d = filePropertiesMap[newMetadata.fullName]) === null || _d === void 0 ? void 0 : _d.namespacePrefix, transformer_1.getAuthorAnnotations(filePropertiesMap[newMetadata.fullName]));
};
var fetchMetadataInstances = function (_a) {
    var client = _a.client, metadataType = _a.metadataType, fileProps = _a.fileProps, metadataQuery = _a.metadataQuery, _b = _a.maxInstancesPerType, maxInstancesPerType = _b === void 0 ? constants_1.UNLIMITED_INSTANCES_VALUE : _b;
    return __awaiter(void 0, void 0, void 0, function () {
        var typeName, instancesCount, reason, skippedListConfigChange, metadataTypeName, _c, metadataInfos, errors, filePropertiesMap, elements;
        return __generator(this, function (_d) {
            switch (_d.label) {
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
                    metadataTypeName = _d.sent();
                    return [4 /*yield*/, client.readMetadata(metadataTypeName, fileProps.map(function (prop) { return ({
                            name: getFullName(prop),
                            namespace: getNamespace(prop),
                            fileName: prop.fileName,
                        }); }).filter(function (_a) {
                            var name = _a.name, namespace = _a.namespace;
                            return metadataQuery.isInstanceMatch({
                                namespace: namespace,
                                metadataType: metadataTypeName,
                                name: name,
                                isFolderType: isDefined(metadataType.annotations[constants_1.FOLDER_CONTENT_TYPE]),
                            });
                        }).map(function (_a) {
                            var name = _a.name;
                            return name;
                        }))];
                case 2:
                    _c = _d.sent(), metadataInfos = _c.result, errors = _c.errors;
                    filePropertiesMap = lodash_1["default"].keyBy(fileProps, getFullName);
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
    var client = _a.client, types = _a.types, maxItemsInRetrieveRequest = _a.maxItemsInRetrieveRequest, metadataQuery = _a.metadataQuery;
    return __awaiter(void 0, void 0, void 0, function () {
        var configChanges, listFilesOfType, typesByName, typesWithMetaFile, typesWithContent, retrieveInstances, filesToRetrieve, _b, _c, instances;
        return __generator(this, function (_d) {
            switch (_d.label) {
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
                                case 3: return [4 /*yield*/, exports.listMetadataObjects(client, typeName)];
                                case 4:
                                    _b = _c.sent();
                                    _c.label = 5;
                                case 5:
                                    _a = _b, res = _a.elements, listObjectsConfigChanges = _a.configChanges;
                                    configChanges.push.apply(configChanges, listObjectsConfigChanges);
                                    return [2 /*return*/, lodash_1["default"](res)
                                            .uniqBy(function (file) { return file.fullName; })
                                            .map(getPropsWithFullName)
                                            .value()];
                            }
                        });
                    }); };
                    return [4 /*yield*/, keyByAsync(types, function (t) { return transformer_1.apiName(t); })];
                case 1:
                    typesByName = _d.sent();
                    return [4 /*yield*/, getTypesWithMetaFile(types)];
                case 2:
                    typesWithMetaFile = _d.sent();
                    return [4 /*yield*/, getTypesWithContent(types)];
                case 3:
                    typesWithContent = _d.sent();
                    retrieveInstances = function (fileProps) { return __awaiter(void 0, void 0, void 0, function () {
                        var filesToRetrieve, typesToRetrieve, request, result, chunkSize, allValues;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    filesToRetrieve = fileProps.map(function (inst) { return (__assign(__assign({}, inst), { type: xml_transformer_1.getManifestTypeName(typesByName[inst.type]) })); });
                                    typesToRetrieve = __spreadArrays(new Set(filesToRetrieve.map(function (prop) { return prop.type; }))).join(',');
                                    log.debug('retrieving types %s', typesToRetrieve);
                                    request = xml_transformer_1.toRetrieveRequest(filesToRetrieve);
                                    return [4 /*yield*/, client.retrieve(request)];
                                case 1:
                                    result = _a.sent();
                                    log.debug('retrieve result for types %s: %o', typesToRetrieve, lodash_1["default"].omit(result, ['zipFile', 'fileProperties']));
                                    if (!(result.errorStatusCode === constants_1.RETRIEVE_SIZE_LIMIT_ERROR)) return [3 /*break*/, 3];
                                    if (fileProps.length <= 1) {
                                        configChanges.push.apply(configChanges, fileProps.map(function (fileProp) {
                                            return config_change_1.createSkippedListConfigChange({ type: fileProp.type, instance: fileProp.fullName });
                                        }));
                                        log.warn("retrieve request for " + typesToRetrieve + " failed: " + result.errorStatusCode + " " + result.errorMessage + ", adding to skip list");
                                        return [2 /*return*/, []];
                                    }
                                    chunkSize = Math.ceil(fileProps.length / 2);
                                    log.debug('reducing retrieve item count %d -> %d', fileProps.length, chunkSize);
                                    configChanges.push({ type: types_1.MAX_ITEMS_IN_RETRIEVE_REQUEST, value: chunkSize });
                                    return [4 /*yield*/, Promise.all(lodash_1["default"].chunk(fileProps, chunkSize).map(retrieveInstances))];
                                case 2: return [2 /*return*/, (_a.sent()).flat()];
                                case 3:
                                    configChanges.push.apply(configChanges, config_change_1.createRetrieveConfigChange(result));
                                    // Unclear when / why this can happen, but it seems like sometimes zipFile is not a string
                                    // TODO: investigate further why this happens and find a better solution than just failing
                                    if (!lodash_1["default"].isString(result.zipFile)) {
                                        log.warn('retrieve request for types %s failed, zipFile is %o', typesToRetrieve, result.zipFile);
                                        throw new Error("Retrieve request for " + typesToRetrieve + " failed. messages: " + adapter_utils_1.safeJsonStringify(result.messages));
                                    }
                                    return [4 /*yield*/, xml_transformer_1.fromRetrieveResult(result, fileProps, typesWithMetaFile, typesWithContent)];
                                case 4:
                                    allValues = _a.sent();
                                    return [2 /*return*/, allValues.map(function (_a) {
                                            var file = _a.file, values = _a.values;
                                            return (transformer_1.createInstanceElement(values, typesByName[file.type], file.namespacePrefix, transformer_1.getAuthorAnnotations(file)));
                                        })];
                            }
                        });
                    }); };
                    _c = (_b = lodash_1["default"]).flatten;
                    return [4 /*yield*/, Promise.all(types
                            // We get folders as part of getting the records inside them
                            .filter(function (type) { return type.annotations.folderContentType === undefined; })
                            .map(listFilesOfType))];
                case 4:
                    filesToRetrieve = _c.apply(_b, [_d.sent()]).filter(function (props) { return notInSkipList(metadataQuery, props, false); });
                    log.info('going to retrieve %d files', filesToRetrieve.length);
                    return [4 /*yield*/, Promise.all(lodash_1["default"].chunk(filesToRetrieve, maxItemsInRetrieveRequest)
                            .filter(function (filesChunk) { return filesChunk.length > 0; })
                            .map(function (filesChunk) { return retrieveInstances(filesChunk); }))];
                case 5:
                    instances = _d.sent();
                    return [2 /*return*/, {
                            elements: lodash_1["default"].flatten(instances),
                            configChanges: configChanges,
                        }];
            }
        });
    });
};
exports.retrieveMetadataInstances = retrieveMetadataInstances;
