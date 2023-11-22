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
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10;
exports.__esModule = true;
exports.createFlowChange = exports.mockInstances = exports.mockDefaultValues = exports.lwcHtmlResourceContent = exports.lwcJsResourceContent = exports.mockTypes = void 0;
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
var adapter_api_1 = require("@salto-io/adapter-api");
var constants_1 = require("../src/constants");
var transformer_1 = require("../src/transformers/transformer");
var salesforce_types_1 = require("../src/transformers/salesforce_types");
var client_1 = require("../src/client/client");
var workflow_1 = require("../src/filters/workflow");
var utils_1 = require("./utils");
var duplicate_rules_sort_order_1 = require("../src/change_validators/duplicate_rules_sort_order");
var SBAA_APPROVAL_RULE_TYPE = utils_1.createCustomObjectType(constants_1.SBAA_APPROVAL_RULE, {
    fields: (_a = {},
        _a[constants_1.SBAA_CONDITIONS_MET] = {
            refType: adapter_api_1.BuiltinTypes.STRING,
            annotations: (_b = {},
                _b[constants_1.FIELD_ANNOTATIONS.QUERYABLE] = true,
                _b[constants_1.FIELD_ANNOTATIONS.CREATABLE] = true,
                _b[constants_1.FIELD_ANNOTATIONS.UPDATEABLE] = true,
                _b),
        },
        _a),
});
var listViewType = transformer_1.createMetadataObjectType({
    annotations: { metadataType: 'ListView' },
    fields: {
        columns: { refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING) },
        filters: { refType: new adapter_api_1.ListType(transformer_1.createMetadataObjectType({ annotations: { metadataType: 'ListViewFilters' } })) },
    },
});
var fieldSetItemType = transformer_1.createMetadataObjectType({ annotations: { metadataType: 'FieldSetItem' } });
var fieldSetType = transformer_1.createMetadataObjectType({
    annotations: { metadataType: 'FieldSet' },
    fields: {
        availableFields: { refType: new adapter_api_1.ListType(fieldSetItemType) },
        displayedFields: { refType: new adapter_api_1.ListType(fieldSetItemType) },
    },
});
var compactLayoutType = transformer_1.createMetadataObjectType({
    annotations: { metadataType: 'CompactLayout' },
    fields: {
        fields: { refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING) },
    },
});
exports.mockTypes = (_c = {
        ApexClass: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'ApexClass',
                dirName: 'classes',
                suffix: 'cls',
                hasMetaFile: true,
            },
        }),
        ApexPage: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'ApexPage',
                dirName: 'pages',
                suffix: 'page',
                hasMetaFile: true,
            },
        }),
        ApexTrigger: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'ApexTrigger',
                hasMetaFile: true,
                dirName: 'triggers',
                suffix: 'trigger',
            },
        }),
        ApexComponent: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'ApexComponent',
                hasMetaFile: true,
                dirName: 'components',
                suffix: 'component',
            },
        }),
        AuraDefinitionBundle: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'AuraDefinitionBundle',
                dirName: 'aura',
            },
        }),
        CustomObject: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'CustomObject',
            },
            fields: {
                listViews: { refType: listViewType },
                fieldSets: { refType: fieldSetType },
                compactLayouts: { refType: compactLayoutType },
            },
        }),
        StaticResource: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'StaticResource',
                dirName: 'staticresources',
                suffix: 'resource',
                hasMetaFile: true,
            },
        }),
        LightningComponentBundle: transformer_1.createMetadataObjectType({
            annotations: { metadataType: constants_1.LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE, dirName: 'lwc' },
            fields: {
                targetConfigs: {
                    refType: salesforce_types_1.allMissingSubTypes.find(function (t) { return t.elemID.typeName === 'TargetConfigs'; }),
                },
                lwcResources: { refType: transformer_1.createMetadataObjectType({ annotations: { metadataType: 'LwcResources' },
                        fields: {
                            lwcResource: { refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING) },
                        } }) },
            },
        }),
        Layout: transformer_1.createMetadataObjectType({
            annotations: { metadataType: 'Layout', dirName: 'layouts', suffix: 'layout' },
        }),
        Profile: transformer_1.createMetadataObjectType({
            annotations: { metadataType: 'Profile', dirName: 'profiles', suffix: 'profile' },
        }),
        PermissionSet: transformer_1.createMetadataObjectType({
            annotations: { metadataType: 'PermissionSet', dirName: 'PermissionSets', suffix: 'permissionSet' },
        }),
        EmailFolder: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'EmailFolder',
                dirName: 'email',
                hasMetaFile: true,
                folderContentType: 'EmailTemplate',
            },
        }),
        AssignmentRules: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: constants_1.ASSIGNMENT_RULES_METADATA_TYPE,
                dirName: 'assignmentRules',
                suffix: 'assignmentRules',
            },
            fields: {
                assignmentRule: {
                    refType: new adapter_api_1.ListType(transformer_1.createMetadataObjectType({ annotations: { metadataType: 'AssignmentRule' } })),
                },
            },
        }),
        Workflow: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: constants_1.WORKFLOW_METADATA_TYPE,
                dirName: 'workflows',
                suffix: 'workflow',
            },
            fields: lodash_1["default"].mapValues(workflow_1.WORKFLOW_FIELD_TO_TYPE, function (typeName) { return ({
                refType: new adapter_api_1.ListType(transformer_1.createMetadataObjectType({ annotations: { metadataType: typeName } })),
            }); }),
        }),
        WorkflowTask: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: constants_1.WORKFLOW_TASK_METADATA_TYPE,
                dirName: 'workflows',
                suffix: 'workflow',
            },
        }),
        WorkflowFieldUpdate: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'WorkflowFieldUpdate',
                dirName: 'workflows',
                suffix: 'workflow',
            },
        }),
        TestSettings: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'TestSettings',
                dirName: constants_1.SETTINGS_METADATA_TYPE.toLowerCase(),
                suffix: constants_1.SETTINGS_METADATA_TYPE.toLowerCase(),
            },
            isSettings: true,
        }),
        TerritoryModel: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'Territory2Model',
                suffix: 'territory2Model',
                dirName: 'territory2Models',
            },
        }),
        TerritoryRule: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'Territory2Rule',
                suffix: 'territory2Rule',
                dirName: 'territory2Models',
            },
        }),
        CustomMetadata: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'CustomMetadata',
                dirName: 'customMetadata',
                suffix: 'md',
            },
        }),
        EmailTemplate: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'EmailTemplate',
                suffix: 'email',
                dirName: 'emails',
            },
            fields: {
                content: { refType: adapter_api_1.BuiltinTypes.STRING },
                attachments: { refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING) },
            },
        }),
        RecordType: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'RecordType',
                dirName: 'RecordType',
                suffix: 'recordType',
            },
        }),
        Flow: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'Flow',
                suffix: 'flow',
                dirName: 'flow',
            },
            fields: {
                status: { refType: adapter_api_1.BuiltinTypes.STRING },
                actionType: { refType: adapter_api_1.BuiltinTypes.STRING },
            },
        }),
        FlowDefinition: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'FlowDefinition',
                suffix: 'flowDefinition',
                dirName: 'flowDefinition',
            },
            fields: {
                activeVersionNumber: { refType: adapter_api_1.BuiltinTypes.NUMBER },
            },
        }),
        QuickAction: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'QuickAction',
                dirName: 'quickActions',
                suffix: 'quickAction',
            },
            fields: {
                optionsCreateFeedItem: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
                standardLabel: { refType: adapter_api_1.BuiltinTypes.STRING },
                type: { refType: adapter_api_1.BuiltinTypes.STRING },
                targetObject: { refType: adapter_api_1.BuiltinTypes.STRING },
                quickActionLayout: {
                    refType: transformer_1.createMetadataObjectType({
                        annotations: {
                            metadataType: 'QuickActionLayout',
                        },
                        fields: {
                            layoutSectionStyle: { refType: adapter_api_1.BuiltinTypes.STRING },
                            quickActionLayoutColumns: {
                                refType: new adapter_api_1.ListType(transformer_1.createMetadataObjectType({
                                    annotations: { metadataType: 'QuickActionLayoutColumn' },
                                    fields: {
                                        quickActionLayoutItems: { refType: new adapter_api_1.ListType(adapter_api_1.BuiltinTypes.STRING) },
                                    },
                                })),
                            },
                        },
                    }),
                },
            },
        }),
        FlowSettings: transformer_1.createMetadataObjectType({
            annotations: {
                metadataType: 'FlowSettings',
            },
            fields: {
                enableFlowDeployAsActiveEnabled: { refType: adapter_api_1.BuiltinTypes.BOOLEAN },
            },
        })
    },
    _c[constants_1.INSTALLED_PACKAGE_METADATA] = transformer_1.createMetadataObjectType({
        annotations: {
            metadataType: constants_1.INSTALLED_PACKAGE_METADATA,
        },
    }),
    _c.Product2 = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'Product2'),
        fields: {
            ProductCode: {
                refType: adapter_api_1.BuiltinTypes.STRING,
                annotations: (_d = {},
                    _d[constants_1.API_NAME] = 'Product2.ProductCode',
                    _d),
            },
        },
        annotations: (_e = {},
            _e[constants_1.METADATA_TYPE] = constants_1.CUSTOM_OBJECT,
            _e[constants_1.API_NAME] = 'Product2',
            _e),
    }),
    _c[constants_1.CPQ_QUOTE] = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.CPQ_QUOTE),
        fields: {
            SBQQ__Primary__c: {
                refType: adapter_api_1.BuiltinTypes.STRING,
                annotations: (_f = {},
                    _f[constants_1.API_NAME] = 'SBQQ__Primary__c',
                    _f),
            },
        },
        annotations: (_g = {},
            _g[constants_1.METADATA_TYPE] = constants_1.CUSTOM_OBJECT,
            _g[constants_1.API_NAME] = constants_1.CPQ_QUOTE,
            _g),
    }),
    _c.ApprovalRule = SBAA_APPROVAL_RULE_TYPE,
    _c.ApprovalCondition = utils_1.createCustomObjectType(constants_1.SBAA_APPROVAL_CONDITION, {
        fields: (_h = {},
            _h[constants_1.SBAA_APPROVAL_RULE] = {
                refType: SBAA_APPROVAL_RULE_TYPE,
                annotations: (_j = {},
                    _j[constants_1.FIELD_ANNOTATIONS.QUERYABLE] = true,
                    _j[constants_1.FIELD_ANNOTATIONS.CREATABLE] = true,
                    _j[constants_1.FIELD_ANNOTATIONS.UPDATEABLE] = true,
                    _j),
            },
            _h),
    }),
    _c.Account = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'Account'),
        fields: {
            Name: {
                refType: adapter_api_1.BuiltinTypes.STRING,
                annotations: (_k = {},
                    _k[constants_1.API_NAME] = 'Account.Name',
                    _k),
            },
        },
        annotations: (_l = {},
            _l[constants_1.METADATA_TYPE] = constants_1.CUSTOM_OBJECT,
            _l[constants_1.API_NAME] = 'Account',
            _l),
    }),
    _c.User = utils_1.createCustomObjectType('User', {
        fields: {
            Manager__c: {
                refType: transformer_1.Types.primitiveDataTypes.Hierarchy,
                annotations: (_m = {},
                    _m[constants_1.API_NAME] = 'User.Manager__c',
                    _m[constants_1.FIELD_ANNOTATIONS.QUERYABLE] = true,
                    _m[constants_1.FIELD_ANNOTATIONS.CREATABLE] = true,
                    _m[constants_1.FIELD_ANNOTATIONS.UPDATEABLE] = true,
                    _m[constants_1.FIELD_ANNOTATIONS.RELATIONSHIP_NAME] = 'Manager',
                    _m[constants_1.FIELD_ANNOTATIONS.REFERENCE_TO] = ['User'],
                    _m),
            },
        },
    }),
    _c.ListView = transformer_1.createMetadataObjectType({
        annotations: {
            metadataType: 'ListView',
            suffix: 'listview',
            dirName: 'listview',
        },
        fields: {
            filter: { refType: adapter_api_1.BuiltinTypes.STRING },
        },
    }),
    _c[constants_1.DUPLICATE_RULE_METADATA_TYPE] = transformer_1.createMetadataObjectType({
        annotations: {
            metadataType: constants_1.DUPLICATE_RULE_METADATA_TYPE,
            suffix: 'rule',
            dirName: 'rules',
        },
        fields: (_o = {},
            _o[constants_1.INSTANCE_FULL_NAME_FIELD] = { refType: adapter_api_1.BuiltinTypes.STRING },
            _o[duplicate_rules_sort_order_1.SORT_ORDER] = { refType: adapter_api_1.BuiltinTypes.NUMBER },
            _o),
    }),
    // CustomMetadataRecordType with name MDType__mdt
    _c.CustomMetadataRecordType = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'MDType__mdt'),
        annotations: (_p = {},
            _p[constants_1.API_NAME] = 'MDType__mdt',
            _p[constants_1.METADATA_TYPE] = constants_1.CUSTOM_METADATA,
            _p),
    }),
    _c[constants_1.CPQ_QUOTE] = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.CPQ_QUOTE),
        fields: {
            Status: {
                refType: adapter_api_1.BuiltinTypes.STRING,
                annotations: (_q = {},
                    _q[constants_1.API_NAME] = 'Quote.Status',
                    _q),
            },
            ProductOption: {
                refType: adapter_api_1.BuiltinTypes.STRING,
                annotations: (_r = {},
                    _r[constants_1.API_NAME] = 'Quote.ProductOption',
                    _r),
            },
        },
        annotations: (_s = {},
            _s[constants_1.METADATA_TYPE] = constants_1.CUSTOM_OBJECT,
            _s[constants_1.API_NAME] = constants_1.CPQ_QUOTE,
            _s),
    }),
    _c.CustomLabel = transformer_1.createMetadataObjectType({
        annotations: {
            metadataType: 'CustomLabel',
        },
    }),
    _c.CaseSettings = utils_1.createCustomObjectType('CaseSettings', {
        fields: {
            defaultCaseOwner: {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            defaultCaseUser: {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            defaultCaseOwnerType: {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
        },
    }),
    _c.FolderShare = utils_1.createCustomObjectType('FolderShare', {
        fields: {
            sharedTo: {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
            sharedToType: {
                refType: adapter_api_1.BuiltinTypes.STRING,
            },
        },
    }),
    _c.WorkflowAlert = transformer_1.createMetadataObjectType({
        annotations: (_t = {},
            _t[constants_1.METADATA_TYPE] = 'WorkflowAlert',
            _t),
        fields: {
            recipients: {
                refType: new adapter_api_1.ListType(transformer_1.createMetadataObjectType({
                    annotations: (_u = {},
                        _u[constants_1.METADATA_TYPE] = 'WorkflowEmailRecipient',
                        _u),
                    fields: {
                        recipient: {
                            refType: adapter_api_1.BuiltinTypes.STRING,
                        },
                        type: {
                            refType: adapter_api_1.BuiltinTypes.STRING,
                        },
                    },
                })),
            },
        },
    }),
    _c.AccountSettings = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, 'AccountSettings'),
        fields: {
            enableAccountOwnerReport: {
                refType: adapter_api_1.BuiltinTypes.BOOLEAN,
            },
        },
        annotations: {
            metadataType: 'AccountSettings',
        },
        isSettings: true,
    }),
    _c.PathAssistant = new adapter_api_1.ObjectType({
        elemID: new adapter_api_1.ElemID(constants_1.SALESFORCE, constants_1.PATH_ASSISTANT_METADATA_TYPE),
        annotations: {
            metadataType: 'PathAssistant',
        },
    }),
    _c.GlobalValueSet = transformer_1.createMetadataObjectType({
        annotations: (_v = {},
            _v[constants_1.METADATA_TYPE] = 'GlobalValueSet',
            _v),
        fields: {
            customValue: {
                refType: new adapter_api_1.ListType(transformer_1.createMetadataObjectType({
                    annotations: (_w = {},
                        _w[constants_1.METADATA_TYPE] = 'CustomValue',
                        _w),
                })),
            },
        },
    }),
    _c.DataCategoryGroup = transformer_1.createMetadataObjectType({
        annotations: (_x = {},
            _x[constants_1.METADATA_TYPE] = 'DataCategoryGroup',
            _x),
    }),
    _c.SBQQ__Template__c = utils_1.createCustomObjectType('SBQQ__Template__c', {}),
    _c.SBQQ__LineColumn__c = utils_1.createCustomObjectType('SBQQ__LineColumn__c', {
        fields: {
            SBQQ__Template__c: {
                refType: transformer_1.Types.primitiveDataTypes.MasterDetail,
                annotations: (_y = {
                        referenceTo: ['SBQQ__Template__c']
                    },
                    _y[constants_1.FIELD_ANNOTATIONS.QUERYABLE] = true,
                    _y),
            },
            SBQQ__FieldName__c: {
                refType: adapter_api_1.BuiltinTypes.STRING,
                annotations: (_z = {},
                    _z[constants_1.FIELD_ANNOTATIONS.QUERYABLE] = true,
                    _z),
            },
        },
    }),
    _c.WebLink = transformer_1.createMetadataObjectType({
        annotations: {
            metadataType: 'WebLink',
            dirName: 'links',
            suffix: 'link',
            hasMetaFile: true,
        },
    }),
    _c.TestCustomObject__c = utils_1.createCustomObjectType('TestCustomObject__c', {}),
    _c.BusinessProcess = transformer_1.createMetadataObjectType({
        annotations: {
            metadataType: 'BusinessProcess',
        },
    }),
    _c);
exports.lwcJsResourceContent = "import { LightningElement } from 'lwc';\nexport default class BikeCard extends LightningElement {\n   name = 'Electra X4';\n   description = 'A sweet bike built for comfort.';\n   category = 'Mountain';\n   material = 'Steel';\n   price = '$2,700';\n   pictureUrl = 'https://s3-us-west-1.amazonaws.com/sfdc-demo/ebikes/electrax4.jpg';\n }";
exports.lwcHtmlResourceContent = '<template>\n    <div>\n        <div>Name: {name}</div>\n        <div>Description: {description}</div>\n        <lightning-badge label={material}></lightning-badge>\n        <lightning-badge label={category}></lightning-badge>\n        <div>Price: {price}</div>\n        <div><img src={pictureUrl}/></div>\n    </div>\n</template>';
exports.mockDefaultValues = (_0 = {
        ApexClass: (_1 = {},
            _1[constants_1.INSTANCE_FULL_NAME_FIELD] = 'ApexClassForProfile',
            _1.apiVersion = client_1.API_VERSION,
            _1.content = "public class ApexClassForProfile {\n    public void printLog() {\n        System.debug('Created');\n    }\n}",
            _1),
        ApexPage: (_2 = {},
            _2[constants_1.INSTANCE_FULL_NAME_FIELD] = 'ApexPageForProfile',
            _2.apiVersion = client_1.API_VERSION,
            _2.content = '<apex:page>Created by e2e test for profile test!</apex:page>',
            _2.label = 'ApexPageForProfile',
            _2),
        AuraDefinitionBundle: (_3 = {},
            _3[constants_1.INSTANCE_FULL_NAME_FIELD] = 'TestAuraDefinitionBundle',
            _3.SVGContent = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg width="120px" height="120px" viewBox="0 0 120 120" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n\t<g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n\t\t<path d="M120,108 C120,114.6 114.6,120 108,120 L12,120 C5.4,120 0,114.6 0,108 L0,12 C0,5.4 5.4,0 12,0 L108,0 C114.6,0 120,5.4 120,12 L120,108 L120,108 Z" id="Shape" fill="#2A739E"/>\n\t\t<path d="M77.7383308,20 L61.1640113,20 L44.7300055,63.2000173 L56.0543288,63.2000173 L40,99.623291 L72.7458388,54.5871812 L60.907727,54.5871812 L77.7383308,20 Z" id="Path-1" fill="#FFFFFF"/>\n\t</g>\n</svg>',
            _3.apiVersion = 49,
            _3.controllerContent = '({ myAction : function(component, event, helper) {} })',
            _3.description = 'Test Lightning Component Bundle',
            _3.designContent = '<design:component/>',
            _3.documentationContent = '<aura:documentation>\n\t<aura:description>Documentation</aura:description>\n\t<aura:example name="ExampleName" ref="exampleComponentName" label="Label">\n\t\tEdited Example Description\n\t</aura:example>\n</aura:documentation>',
            _3.helperContent = '({ helperMethod : function() {} })',
            _3.markup = '<aura:component >\n\t<p>Hello Lightning!</p>\n</aura:component>',
            _3.rendererContent = '({})',
            _3.styleContent = '.THIS{\n}',
            _3.type = 'Component',
            _3),
        LightningComponentBundle: (_4 = {},
            _4[constants_1.INSTANCE_FULL_NAME_FIELD] = 'testLightningComponentBundle',
            _4.apiVersion = 49,
            _4.isExposed = true,
            _4.lwcResources = {
                lwcResource: [
                    {
                        source: exports.lwcJsResourceContent,
                        filePath: 'lwc/testLightningComponentBundle/testLightningComponentBundle.js',
                    },
                    {
                        source: exports.lwcHtmlResourceContent,
                        filePath: 'lwc/testLightningComponentBundle/testLightningComponentBundle.html',
                    },
                ],
            },
            _4.targetConfigs = {
                targetConfig: [
                    {
                        objects: [
                            {
                                object: 'Contact',
                            },
                        ],
                        targets: 'lightning__RecordPage',
                    },
                    {
                        supportedFormFactors: {
                            supportedFormFactor: [
                                {
                                    type: 'Small',
                                },
                            ],
                        },
                        targets: 'lightning__AppPage,lightning__HomePage',
                    },
                ],
            },
            _4.targets = {
                target: [
                    'lightning__AppPage',
                    'lightning__RecordPage',
                    'lightning__HomePage',
                ],
            },
            _4),
        Profile: (_5 = {
                fieldPermissions: {
                    Lead: {
                        Fax: {
                            field: 'Lead.Fax',
                            readable: true,
                            editable: false,
                        },
                    },
                    Account: {
                        AccountNumber: {
                            editable: false,
                            field: 'Account.AccountNumber',
                            readable: false,
                        },
                    },
                },
                objectPermissions: {
                    Account: {
                        allowCreate: true,
                        allowDelete: true,
                        allowEdit: true,
                        allowRead: true,
                        modifyAllRecords: false,
                        viewAllRecords: false,
                        object: 'Account',
                    },
                },
                tabVisibilities: [
                    {
                        tab: 'standard-Account',
                        visibility: 'DefaultOff',
                    },
                ],
                userPermissions: {
                    ConvertLeads: {
                        enabled: false,
                        name: 'ConvertLeads',
                    },
                },
                applicationVisibilities: {
                    // eslint-disable-next-line camelcase
                    standard__ServiceConsole: {
                        application: 'standard__ServiceConsole',
                        "default": false,
                        visible: true,
                    },
                },
                pageAccesses: {
                    ApexPageForProfile: {
                        apexPage: 'ApexPageForProfile',
                        enabled: false,
                    },
                },
                classAccesses: {
                    ApexClassForProfile: {
                        apexClass: 'ApexClassForProfile',
                        enabled: false,
                    },
                },
                loginHours: {
                    sundayStart: 480,
                    sundayEnd: 1380,
                },
                description: 'new e2e profile'
            },
            _5[constants_1.INSTANCE_FULL_NAME_FIELD] = 'TestAddProfileInstance__c',
            _5),
        StaticResource: (_6 = {},
            _6[constants_1.INSTANCE_FULL_NAME_FIELD] = 'TestStaticResource',
            _6.cacheControl = 'Private',
            _6.contentType = 'text/xml',
            _6.description = 'Test Static Resource Description',
            _6.content = Buffer.from('<xml/>'),
            _6)
    },
    _0[constants_1.INSTALLED_PACKAGE_METADATA] = (_7 = {},
        _7[constants_1.INSTANCE_FULL_NAME_FIELD] = 'test_namespace',
        _7),
    _0.DataCategoryGroup = (_8 = {},
        _8[constants_1.INSTANCE_FULL_NAME_FIELD] = 'TestDataCategoryGroup',
        _8),
    _0.BusinessProcess = (_9 = {},
        _9[constants_1.INSTANCE_FULL_NAME_FIELD] = 'Opportunity.TestBusinessProposal',
        _9.active = true,
        _9.description = 'Test Business Proposal Description',
        _9),
    _0.WorkflowFieldUpdate = (_10 = {},
        _10[constants_1.INSTANCE_FULL_NAME_FIELD] = 'TestWorkflowFieldUpdate',
        _10.actionName = 'TestWorkflowFieldUpdate',
        _10.description = 'Test Workflow Field Update Description',
        _10.assignedTo = 'TestUser',
        _10.status = 'Completed',
        _10),
    _0);
// Intentionally let typescript infer the return type here to avoid repeating
// the definitions from the constants above
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var mockInstances = function () {
    var _a;
    return (__assign(__assign({}, lodash_1["default"].mapValues(exports.mockDefaultValues, function (values, typeName) { return transformer_1.createInstanceElement(values, exports.mockTypes[typeName]); })), (_a = {}, _a[constants_1.CHANGED_AT_SINGLETON] = new adapter_api_1.InstanceElement(adapter_api_1.ElemID.CONFIG_NAME, constants_1.ArtificialTypes.ChangedAtSingleton), _a)));
};
exports.mockInstances = mockInstances;
var createFlowChange = function (_a) {
    var _b, _c;
    var flowApiName = _a.flowApiName, beforeStatus = _a.beforeStatus, afterStatus = _a.afterStatus, _d = _a.additionalModifications, additionalModifications = _d === void 0 ? false : _d;
    var beforeInstance;
    var afterInstance;
    if (beforeStatus) {
        beforeInstance = transformer_1.createInstanceElement((_b = {},
            _b[constants_1.INSTANCE_FULL_NAME_FIELD] = flowApiName,
            _b[constants_1.STATUS] = beforeStatus,
            _b[constants_1.LABEL] = flowApiName,
            _b), exports.mockTypes.Flow);
    }
    if (afterStatus) {
        afterInstance = transformer_1.createInstanceElement((_c = {},
            _c[constants_1.INSTANCE_FULL_NAME_FIELD] = flowApiName,
            _c[constants_1.STATUS] = afterStatus,
            _c[constants_1.LABEL] = "" + flowApiName + (additionalModifications ? 'Modified' : ''),
            _c), exports.mockTypes.Flow);
    }
    return adapter_api_1.toChange({ before: beforeInstance, after: afterInstance });
};
exports.createFlowChange = createFlowChange;
