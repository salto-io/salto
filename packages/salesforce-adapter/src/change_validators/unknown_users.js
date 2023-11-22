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
var lowerdash_1 = require("@salto-io/lowerdash");
var adapter_api_1 = require("@salto-io/adapter-api");
var adapter_utils_1 = require("@salto-io/adapter-utils");
var lodash_1 = require("lodash");
var utils_1 = require("../filters/utils");
var awu = lowerdash_1.collections.asynciterable.awu;
var makeArray = lowerdash_1.collections.array.makeArray;
// cf. 'Statement Character Limit' in https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select.htm
var SALESFORCE_MAX_QUERY_LEN = 100000;
// https://stackoverflow.com/a/44154193
var TYPES_WITH_USER_FIELDS = [
    'CaseSettings',
    'EscalationRules',
    'FolderShare',
    'WorkflowAlert',
    'WorkflowTask',
    'WorkflowOutboundMessage',
    'AssignmentRules',
    'ApprovalProcess',
    'CustomSite',
    'EmailServicesFunction',
    'PresenceUserConfig',
    'Queue',
];
var userFieldValue = function (container, fieldName) { return makeArray(container === null || container === void 0 ? void 0 : container[fieldName]); };
var getUserDependingOnType = function (typeField) { return (function (container, userField) {
    var type = container[typeField];
    if (!type || type.toLocaleLowerCase() !== 'user') {
        return [];
    }
    return [container[userField]];
}); };
var isEmailRecipientsValue = function (recipients) { return (lodash_1["default"].isArray(recipients)
    && recipients.every(function (recipient) { return lodash_1["default"].isString(recipient.type) && lodash_1["default"].isString(recipient.recipient); })); };
var getEmailRecipients = function (_a) {
    var recipients = _a.recipients;
    if (!isEmailRecipientsValue(recipients)) {
        return [];
    }
    return recipients
        .filter(function (recipient) { return recipient.type === 'user'; })
        .map(function (recipient) { return recipient.recipient; });
};
var userField = function (fieldName, userFieldGetter) { return ({
    subType: undefined,
    field: fieldName,
    getter: function (container) { return userFieldGetter(container, fieldName); },
}); };
var userNestedField = function (subType, fieldName, userFieldGetter) { return ({
    subType: subType,
    field: fieldName,
    getter: function (container) { return userFieldGetter(container, fieldName); },
}); };
var USER_GETTERS = {
    CaseSettings: [
        userField('defaultCaseUser', userFieldValue),
        userField('defaultCaseOwner', getUserDependingOnType('defaultCaseOwnerType')),
    ],
    FolderShare: [
        userField('sharedTo', getUserDependingOnType('sharedToType')),
    ],
    WorkflowAlert: [
        userField('recipients', getEmailRecipients),
    ],
    WorkflowTask: [
        userField('assignedTo', getUserDependingOnType('assignedToType')),
    ],
    WorkflowOutboundMessage: [
        userField('integrationUser', userFieldValue),
    ],
    AssignmentRules: [
        userNestedField('RuleEntry', 'assignedTo', getUserDependingOnType('assignedToType')),
    ],
    ApprovalProcess: [
        userNestedField('Approver', 'name', getUserDependingOnType('type')),
    ],
    CustomSite: [
        userField('siteAdmin', userFieldValue),
        userField('siteGuestRecordDefaultOwner', userFieldValue),
    ],
    EmailServicesFunction: [
        userNestedField('EmailServicesAddress', 'runAsUser', userFieldValue),
    ],
    PresenceUserConfig: [
        userNestedField('PresenceConfigAssignments', 'user', userFieldValue),
    ],
    Queue: [
        userNestedField('Users', 'user', userFieldValue),
    ],
    EscalationRules: [
        userNestedField('EscalationAction', 'assignedTo', getUserDependingOnType('assignedToType')),
    ],
};
var userFieldGettersForType = function (defMapping, type) {
    var instanceTypeAsTypeWithUserFields = function () { return (TYPES_WITH_USER_FIELDS.find(function (t) { return t === type; })); };
    var instanceType = instanceTypeAsTypeWithUserFields();
    return instanceType ? defMapping[instanceType] : [];
};
var getUsersFromInstance = function (instance, getterDefs) { return __awaiter(void 0, void 0, void 0, function () {
    var gettersForInstanceType, _a, _b, _c, topLevelGetters, nestedGetters, users, gettersBySubType, extractUsers;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = userFieldGettersForType;
                _b = [getterDefs];
                return [4 /*yield*/, instance.getType()];
            case 1:
                gettersForInstanceType = _a.apply(void 0, _b.concat([(_d.sent()).elemID.typeName]));
                _c = lodash_1["default"].partition(gettersForInstanceType, function (g) { return g.subType === undefined; }), topLevelGetters = _c[0], nestedGetters = _c[1];
                users = topLevelGetters
                    .flatMap(function (getter) { return (getter.getter(instance.value).map(function (user) { return ({ user: user, elemId: instance.elemID, field: getter.field }); })); });
                gettersBySubType = new Map(nestedGetters.map(function (getter) { return ([getter.subType, getter]); }));
                extractUsers = function (_a) {
                    var value = _a.value, path = _a.path, field = _a.field;
                    return __awaiter(void 0, void 0, void 0, function () {
                        var subType, subTypeGetter, userRefs;
                        var _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0: return [4 /*yield*/, (field === null || field === void 0 ? void 0 : field.getType())];
                                case 1:
                                    subType = (_b = (_c.sent())) === null || _b === void 0 ? void 0 : _b.elemID.typeName;
                                    subTypeGetter = gettersBySubType.get(subType);
                                    if (subTypeGetter && path) {
                                        userRefs = subTypeGetter.getter(value).map(function (user) { return ({ user: user, elemId: path, field: subTypeGetter.field }); });
                                        users.push.apply(users, userRefs);
                                    }
                                    return [2 /*return*/, value];
                            }
                        });
                    });
                };
                return [4 /*yield*/, adapter_utils_1.transformElement({
                        element: instance,
                        transformFunc: extractUsers,
                    })];
            case 2:
                _d.sent();
                return [2 /*return*/, users];
        }
    });
}); };
var getUsersFromInstances = function (defMapping, instances) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, (awu(instances)
                .map(function (instance) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, getUsersFromInstance(instance, defMapping)];
            }); }); })
                .flat()
                .toArray())];
    });
}); };
var getSalesforceUsers = function (client, users) { return __awaiter(void 0, void 0, void 0, function () {
    var queries, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (users.length === 0) {
                    return [2 /*return*/, []];
                }
                return [4 /*yield*/, utils_1.buildSelectQueries('User', ['Username'], users.map(function (userName) { return ({ Username: "'" + userName + "'" }); }), SALESFORCE_MAX_QUERY_LEN)];
            case 1:
                queries = _b.sent();
                _a = awu;
                return [4 /*yield*/, utils_1.queryClient(client, queries)];
            case 2: return [2 /*return*/, _a.apply(void 0, [_b.sent()]).map(function (sfRecord) { return sfRecord.Username; }).toArray()];
        }
    });
}); };
var unknownUserError = function (_a) {
    var elemId = _a.elemId, field = _a.field, user = _a.user;
    return ({
        elemID: elemId,
        severity: 'Error',
        message: "User " + user + " doesn't exist",
        detailedMessage: "The field " + field + " in '" + elemId.getFullName() + "' refers to the user '" + user + "' which does not exist in this Salesforce environment",
    });
};
/**
 * Fields that reference users may refer to users that don't exist. The most common case would be when deploying
 * between different environment, as users by definition can't exist in multiple environments.
 */
var changeValidator = function (client) { return function (changes) { return __awaiter(void 0, void 0, void 0, function () {
    var instancesOfInterest, userRefs, existingUsers, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, awu(changes)
                    .filter(adapter_api_1.isAdditionOrModificationChange)
                    .filter(adapter_api_1.isInstanceChange)
                    .map(adapter_api_1.getChangeData)
                    .filter(utils_1.isInstanceOfType.apply(void 0, Object.keys(USER_GETTERS)))
                    .toArray()];
            case 1:
                instancesOfInterest = _b.sent();
                return [4 /*yield*/, getUsersFromInstances(USER_GETTERS, instancesOfInterest)];
            case 2:
                userRefs = _b.sent();
                _a = Set.bind;
                return [4 /*yield*/, getSalesforceUsers(client, userRefs.map(function (_a) {
                        var user = _a.user;
                        return user;
                    }))];
            case 3:
                existingUsers = new (_a.apply(Set, [void 0, _b.sent()]))();
                return [2 /*return*/, userRefs
                        .filter(function (_a) {
                        var user = _a.user;
                        return !existingUsers.has(user);
                    })
                        .map(unknownUserError)];
        }
    });
}); }; };
exports["default"] = changeValidator;
