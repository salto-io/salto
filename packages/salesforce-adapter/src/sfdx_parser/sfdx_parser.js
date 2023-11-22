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
exports.loadElementsFromFolder = void 0;
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
var path_1 = require("path");
var readdirp_1 = require("readdirp");
var logging_1 = require("@salto-io/logging");
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var adapter_api_1 = require("@salto-io/adapter-api");
var file_1 = require("@salto-io/file");
var adapter_1 = require("../adapter");
var xml_transformer_1 = require("../transformers/xml_transformer");
var transformer_1 = require("../transformers/transformer");
var fetch_profile_1 = require("../fetch_profile/fetch_profile");
var constants_1 = require("../constants");
var filters_1 = require("./filters");
var log = logging_1.logger(module);
var awu = lowerdash_1.collections.asynciterable.awu;
var SUPPORTED_TYPE_NAMES = [
    'ApexClass',
    'ApexPage',
    'ApexTrigger',
    'AssignmentRules',
    'AuraDefinitionBundle',
    // 'CompactLayout', // TODO: handle instances that are nested under custom object
    'ContentAsset',
    'CustomApplication',
    'CustomObject',
    'CustomTab',
    // 'EmailTemplate', // TODO: add folder name to fullName
    // 'FieldSet', // TODO: handle instances that are nested under custom object
    'FlexiPage',
    'Flow',
    'InstalledPackage',
    // 'LanguageSettings', // TODO: generally handle settings
    'Layout',
    'LightningComponentBundle',
    // 'ListView', // TODO: handle instances that are nested under custom object
    'Profile',
    // 'StaticResource', // TODO: handle static resources that have their content unzipped by SFDX
    // 'Territory2Rule', // TODO: add folder name to fullName (should be <FolderName>.<FullName>)
    'Territory2Type',
];
var getElementsFromFile = function (packageDir, fileName, resolvedTypes, staticFileNames) { return __awaiter(void 0, void 0, void 0, function () {
    var fileContent, _a, typeName, values, fullNameWithSuffix, fullName, complexType_1, fileDir_1, relevantFileNames, relevantFiles, _b, _c, contentFileName, contentFile, type;
    var _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, file_1.readTextFile.notFoundAsUndefined(path_1["default"].join(packageDir, fileName))];
            case 1:
                fileContent = _f.sent();
                if (fileContent === undefined) {
                    // Should never happen
                    log.warn('skipping %s because we could not get its content', fileName);
                    return [2 /*return*/, []];
                }
                _a = xml_transformer_1.xmlToValues(fileContent), typeName = _a.typeName, values = _a.values;
                fullNameWithSuffix = path_1["default"].basename(fileName).slice(0, -'-meta.xml'.length);
                fullName = fullNameWithSuffix.split('.').slice(0, -1).join('.');
                values.fullName = fullName;
                if (!xml_transformer_1.isComplexType(typeName)) return [3 /*break*/, 3];
                complexType_1 = xml_transformer_1.complexTypesMap[typeName];
                fileDir_1 = path_1["default"].dirname(fileName);
                relevantFileNames = staticFileNames
                    .filter(function (name) { return name.startsWith(path_1["default"].join(fileDir_1, fullName)); });
                _c = (_b = Object).fromEntries;
                return [4 /*yield*/, Promise.all(relevantFileNames.map(function (name) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _a = [path_1["default"].join(xml_transformer_1.PACKAGE, complexType_1.folderName, path_1["default"].relative(path_1["default"].dirname(fileDir_1), name))];
                                    return [4 /*yield*/, file_1.readFile(path_1["default"].join(packageDir, name))];
                                case 1: return [2 /*return*/, _a.concat([
                                        _b.sent()
                                    ])];
                            }
                        });
                    }); }))];
            case 2:
                relevantFiles = _c.apply(_b, [_f.sent()]);
                Object.assign(values, (_e = (_d = complexType_1.getMissingFields) === null || _d === void 0 ? void 0 : _d.call(complexType_1, fullNameWithSuffix)) !== null && _e !== void 0 ? _e : {});
                complexType_1.addContentFields(relevantFiles, values, typeName);
                return [3 /*break*/, 5];
            case 3:
                contentFileName = path_1["default"].join(path_1["default"].dirname(fileName), fullNameWithSuffix);
                return [4 /*yield*/, file_1.readFile(path_1["default"].join(packageDir, contentFileName))["catch"](function () { return undefined; })];
            case 4:
                contentFile = _f.sent();
                if (contentFile !== undefined) {
                    values[constants_1.METADATA_CONTENT_FIELD] = new adapter_api_1.StaticFile({
                        filepath: path_1["default"].join(constants_1.SALESFORCE, constants_1.RECORDS_PATH, typeName, fullNameWithSuffix),
                        content: contentFile,
                    });
                }
                _f.label = 5;
            case 5:
                type = resolvedTypes[typeName];
                if (!adapter_api_1.isObjectType(type)) {
                    log.warn('Could not find type %s, skipping instance %s', typeName, fullName);
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, [
                        transformer_1.createInstanceElement(values, type),
                    ]];
        }
    });
}); };
var getElementsFromDXFolder = function (packageDir, workspaceElements, types) { return __awaiter(void 0, void 0, void 0, function () {
    var allFiles, fileNames, _a, sourceFileNames, staticFileNames, elements, localFilters, filtersToRun, filterRunner, result;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, readdirp_1["default"].promise(packageDir, {
                    directoryFilter: function (e) { return e.basename[0] !== '.'; },
                    type: 'files',
                })];
            case 1:
                allFiles = _b.sent();
                fileNames = allFiles.map(function (entry) { return path_1["default"].relative(packageDir, entry.fullPath); });
                _a = lodash_1["default"].partition(fileNames, function (name) { return name.endsWith('-meta.xml'); }), sourceFileNames = _a[0], staticFileNames = _a[1];
                return [4 /*yield*/, awu(sourceFileNames)
                        .flatMap(function (name) { return getElementsFromFile(packageDir, name, types, staticFileNames); })
                        .toArray()];
            case 2:
                elements = _b.sent();
                localFilters = adapter_1.allFilters
                    .filter(adapter_utils_1.filter.isLocalFilterCreator)
                    .map(function (_a) {
                    var creator = _a.creator;
                    return creator;
                });
                filtersToRun = filters_1.sfdxFilters.concat(localFilters);
                filterRunner = adapter_utils_1.filter.filtersRunner({
                    config: {
                        unsupportedSystemFields: adapter_1.UNSUPPORTED_SYSTEM_FIELDS,
                        systemFields: adapter_1.SYSTEM_FIELDS,
                        fetchProfile: fetch_profile_1.buildFetchProfile({
                            fetchParams: { target: ['hack to make filters think this is partial fetch'] },
                        }),
                        elementsSource: workspaceElements,
                    },
                    files: {
                        baseDirName: packageDir,
                        sourceFileNames: sourceFileNames,
                        staticFileNames: staticFileNames,
                    },
                }, filtersToRun);
                result = elements.concat(Object.values(lodash_1["default"].omit(types, constants_1.CUSTOM_OBJECT)));
                return [4 /*yield*/, filterRunner.onFetch(result)];
            case 3:
                _b.sent();
                return [2 /*return*/, result];
        }
    });
}); };
var getElementTypesForSFDX = function (elementSource) { return __awaiter(void 0, void 0, void 0, function () {
    var typeNames, types, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                typeNames = Object.fromEntries(SUPPORTED_TYPE_NAMES
                    .map(function (typeName) { var _a; return [typeName, (_a = transformer_1.METADATA_TYPES_TO_RENAME.get(typeName)) !== null && _a !== void 0 ? _a : typeName]; }));
                _b = (_a = lodash_1["default"]).pickBy;
                return [4 /*yield*/, lowerdash_1.promises.object.mapValuesAsync(typeNames, function (name) { return elementSource.get(new adapter_api_1.ElemID(constants_1.SALESFORCE, name)); })];
            case 1:
                types = _b.apply(_a, [_c.sent(), adapter_api_1.isObjectType]);
                // We need to create explicit types for CustomObject and CustomField because
                // we remove them when we fetch
                types.CustomObject = transformer_1.createMetadataObjectType({ annotations: { metadataType: constants_1.CUSTOM_OBJECT } });
                return [2 /*return*/, types];
        }
    });
}); };
var PROJECT_MANIFEST_FILENAME = 'sfdx-project.json';
var getDXPackageDirs = function (baseDir) { return __awaiter(void 0, void 0, void 0, function () {
    var projectFile, project;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, file_1.readTextFile.notFoundAsUndefined(path_1["default"].join(baseDir, PROJECT_MANIFEST_FILENAME))];
            case 1:
                projectFile = _a.sent();
                if (projectFile === undefined) {
                    return [2 /*return*/, []];
                }
                project = JSON.parse(projectFile);
                return [2 /*return*/, project.packageDirectories
                        .map(function (packageDir) { return path_1["default"].join(baseDir, packageDir.path); })];
        }
    });
}); };
var loadElementsFromFolder = function (_a) {
    var baseDir = _a.baseDir, elementsSource = _a.elementsSource;
    return __awaiter(void 0, void 0, void 0, function () {
        var packages, types;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, getDXPackageDirs(baseDir)];
                case 1:
                    packages = _c.sent();
                    return [4 /*yield*/, getElementTypesForSFDX(elementsSource)];
                case 2:
                    types = _c.sent();
                    _b = {};
                    return [4 /*yield*/, awu(packages)
                            .flatMap(function (pkg) { return getElementsFromDXFolder(pkg, elementsSource, types); })
                            .toArray()];
                case 3: return [2 /*return*/, (_b.elements = _c.sent(),
                        _b)];
            }
        });
    });
};
exports.loadElementsFromFolder = loadElementsFromFolder;
