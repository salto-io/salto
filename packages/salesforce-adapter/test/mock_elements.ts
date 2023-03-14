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
import _ from 'lodash'
import { ObjectType, ElemID, TypeElement, BuiltinTypes, ListType } from '@salto-io/adapter-api'
import {
  SALESFORCE,
  INSTANCE_FULL_NAME_FIELD,
  ASSIGNMENT_RULES_METADATA_TYPE,
  WORKFLOW_METADATA_TYPE,
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
  SETTINGS_METADATA_TYPE,
  CUSTOM_METADATA,
  API_NAME,
  METADATA_TYPE,
  CUSTOM_OBJECT,
  CPQ_QUOTE,
  DUPLICATE_RULE_METADATA_TYPE,
  ACTIVATE_RSS,
  INSTALLED_PACKAGE_METADATA,
} from '../src/constants'
import { createInstanceElement, createMetadataObjectType } from '../src/transformers/transformer'
import { allMissingSubTypes } from '../src/transformers/salesforce_types'
import { API_VERSION } from '../src/client/client'
import { WORKFLOW_FIELD_TO_TYPE } from '../src/filters/workflow'
import { createCustomObjectType } from './utils'
import { SORT_ORDER } from '../src/change_validators/duplicate_rules_sort_order'


export const mockTypes = {
  ApexClass: createMetadataObjectType({
    annotations: {
      metadataType: 'ApexClass',
      dirName: 'classes',
      suffix: 'cls',
      hasMetaFile: true,
    },
  }),
  ApexPage: createMetadataObjectType({
    annotations: {
      metadataType: 'ApexPage',
      dirName: 'pages',
      suffix: 'page',
      hasMetaFile: true,
    },
  }),
  ApexTrigger: createMetadataObjectType({
    annotations: {
      metadataType: 'ApexTrigger',
      hasMetaFile: true,
      dirName: 'triggers',
      suffix: 'trigger',
    },
  }),
  ApexComponent: createMetadataObjectType({
    annotations: {
      metadataType: 'ApexComponent',
      hasMetaFile: true,
      dirName: 'components',
      suffix: 'component',
    },
  }),
  AuraDefinitionBundle: createMetadataObjectType({
    annotations: {
      metadataType: 'AuraDefinitionBundle',
      dirName: 'aura',
    },
  }),
  CustomObject: createMetadataObjectType({
    annotations: {
      metadataType: 'CustomObject',
    },
  }),
  StaticResource: createMetadataObjectType({
    annotations: {
      metadataType: 'StaticResource',
      dirName: 'staticresources',
      suffix: 'resource',
      hasMetaFile: true,
    },
  }),
  LightningComponentBundle: createMetadataObjectType({
    annotations: { metadataType: LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE, dirName: 'lwc' },
    fields: {
      targetConfigs: {
        refType: allMissingSubTypes.find(t => t.elemID.typeName === 'TargetConfigs') as TypeElement
        ,
      },
      lwcResources: { refType: createMetadataObjectType({ annotations: { metadataType: 'LwcResources' },
        fields: {
          lwcResource: { refType: new ListType(BuiltinTypes.STRING) },
        } }) },
    },
  }),
  Layout: createMetadataObjectType({
    annotations: { metadataType: 'Layout', dirName: 'layouts', suffix: 'layout' },
  }),
  Profile: createMetadataObjectType({
    annotations: { metadataType: 'Profile', dirName: 'profiles', suffix: 'profile' },
  }),
  PermissionSet: createMetadataObjectType({
    annotations: { metadataType: 'PermissionSet', dirName: 'PermissionSets', suffix: 'permissionSet' },
  }),
  EmailFolder: createMetadataObjectType({
    annotations: {
      metadataType: 'EmailFolder',
      dirName: 'email',
      hasMetaFile: true,
      folderContentType: 'EmailTemplate',
    },
  }),
  AssignmentRules: createMetadataObjectType({
    annotations: {
      metadataType: ASSIGNMENT_RULES_METADATA_TYPE,
      dirName: 'assignmentRules',
      suffix: 'assignmentRules',
    },
    fields: {
      assignmentRule: {
        refType: new ListType(createMetadataObjectType(
          { annotations: { metadataType: 'AssignmentRule' } }
        )),
      },
    },
  }),
  Workflow: createMetadataObjectType({
    annotations: {
      metadataType: WORKFLOW_METADATA_TYPE,
      dirName: 'workflows',
      suffix: 'workflow',
    },
    fields: _.mapValues(
      WORKFLOW_FIELD_TO_TYPE,
      typeName => ({
        refType: new ListType(createMetadataObjectType(
          { annotations: { metadataType: typeName } }
        )),
      }),
    ),
  }),
  TestSettings: createMetadataObjectType({
    annotations: {
      metadataType: 'TestSettings',
      dirName: SETTINGS_METADATA_TYPE.toLowerCase(), // set to this value upon fetch
      suffix: SETTINGS_METADATA_TYPE.toLowerCase(), // set to this value upon fetch
    },
    isSettings: true,
  }),
  TerritoryModel: createMetadataObjectType({
    annotations: {
      metadataType: 'Territory2Model',
      suffix: 'territory2Model',
      dirName: 'territory2Models',
    },
  }),
  TerritoryRule: createMetadataObjectType({
    annotations: {
      metadataType: 'Territory2Rule',
      suffix: 'territory2Rule',
      dirName: 'territory2Models',
    },
  }),
  CustomMetadata: createMetadataObjectType({
    annotations: {
      metadataType: 'CustomMetadata',
      dirName: 'customMetadata',
      suffix: 'md',
    },
  }),
  EmailTemplate: createMetadataObjectType({
    annotations: {
      metadataType: 'EmailTemplate',
      suffix: 'email',
      dirName: 'emails',
    },
    fields: {
      content: { refType: BuiltinTypes.STRING },
      attachments: { refType: new ListType(BuiltinTypes.STRING) },
    },
  }),
  RecordType: createMetadataObjectType({
    annotations: {
      metadataType: 'RecordType',
      dirName: 'RecordType',
      suffix: 'recordType',
    },
  }),
  Flow: createMetadataObjectType({
    annotations: {
      metadataType: 'Flow',
      suffix: 'flow',
      dirName: 'flow',
    },
    fields: {
      status: { refType: BuiltinTypes.STRING },
      actionType: { refType: BuiltinTypes.STRING },
    },
  }),
  FlowDefinition: createMetadataObjectType({
    annotations: {
      metadataType: 'FlowDefinition',
      suffix: 'flowDefinition',
      dirName: 'flowDefinition',
    },
    fields: {
      activeVersionNumber: { refType: BuiltinTypes.NUMBER },
    },
  }),
  QuickAction: createMetadataObjectType({
    annotations: {
      metadataType: 'QuickAction',
      dirName: 'quickActions',
      suffix: 'quickAction',
    },
    fields: {
      optionsCreateFeedItem: { refType: BuiltinTypes.BOOLEAN },
      standardLabel: { refType: BuiltinTypes.STRING },
      type: { refType: BuiltinTypes.STRING },
      targetObject: { refType: BuiltinTypes.STRING },
      quickActionLayout: {
        refType: createMetadataObjectType({
          annotations: {
            metadataType: 'QuickActionLayout',
          },
          fields: {
            layoutSectionStyle: { refType: BuiltinTypes.STRING },
            quickActionLayoutColumns: {
              refType: new ListType(createMetadataObjectType(
                {
                  annotations: { metadataType: 'QuickActionLayoutColumn' },
                  fields: {
                    quickActionLayoutItems: { refType: new ListType(BuiltinTypes.STRING) },
                  },
                }
              )),
            },
          },
        }),
      },

    },
  }),
  FlowSettings: createMetadataObjectType({
    annotations: {
      metadataType: 'FlowSettings',
    },
    fields: {
      enableFlowDeployAsActiveEnabled: { refType: BuiltinTypes.BOOLEAN },
    },
  }),
  [INSTALLED_PACKAGE_METADATA]: createMetadataObjectType({
    annotations: {
      metadataType: INSTALLED_PACKAGE_METADATA,
    },
    fields: {
      [ACTIVATE_RSS]: { refType: BuiltinTypes.BOOLEAN },
    },
  }),
  Product2: new ObjectType({
    elemID: new ElemID(SALESFORCE, 'Product2'),
    fields: {
      ProductCode: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'Product2.ProductCode',
        },
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'Product2',
    },
  }),
  [CPQ_QUOTE]: new ObjectType({
    elemID: new ElemID(SALESFORCE, CPQ_QUOTE),
    fields: {
      SBQQ__Primary__c: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'SBQQ__Primary__c',
        },
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: CPQ_QUOTE,
    },
  }),
  Account: new ObjectType({
    elemID: new ElemID(SALESFORCE, 'Account'),
    fields: {
      Name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'Account.Name',
        },
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'Account',
    },
  }),
  ListView: createMetadataObjectType({
    annotations: {
      metadataType: 'ListView',
      suffix: 'listview',
      dirName: 'listview',
    },
    fields: {
      filter: { refType: BuiltinTypes.STRING },
    },
  }),
  [DUPLICATE_RULE_METADATA_TYPE]: createMetadataObjectType({
    annotations: {
      metadataType: DUPLICATE_RULE_METADATA_TYPE,
      suffix: 'rule',
      dirName: 'rules',
    },
    fields: {
      [INSTANCE_FULL_NAME_FIELD]: { refType: BuiltinTypes.STRING },
      [SORT_ORDER]: { refType: BuiltinTypes.NUMBER },
    },
  }),
  // CustomMetadataRecordType with name MDType__mdt
  CustomMetadataRecordType: new ObjectType({
    elemID: new ElemID(SALESFORCE, 'MDType__mdt'),
    annotations: {
      [API_NAME]: 'MDType__mdt',
      [METADATA_TYPE]: CUSTOM_METADATA,
    },
  }),
  [CPQ_QUOTE]: new ObjectType({
    elemID: new ElemID(SALESFORCE, CPQ_QUOTE),
    fields: {
      Status: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'Quote.Status',
        },
      },
      ProductOption: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [API_NAME]: 'Quote.ProductOption',
        },
      },
    },
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: CPQ_QUOTE,
    },
  }),
  CustomLabel: createMetadataObjectType({
    annotations: {
      metadataType: 'CustomLabel',
    },
  }),
  CaseSettings: createCustomObjectType(
    'CaseSettings',
    {
      fields: {
        defaultCaseOwner: {
          refType: BuiltinTypes.STRING,
        },
        defaultCaseUser: {
          refType: BuiltinTypes.STRING,
        },
        defaultCaseOwnerType: {
          refType: BuiltinTypes.STRING,
        },
      },
    }
  ),
  FolderShare: createCustomObjectType(
    'FolderShare',
    {
      fields: {
        sharedTo: {
          refType: BuiltinTypes.STRING,
        },
        sharedToType: {
          refType: BuiltinTypes.STRING,
        },
      },
    }
  ),
  WorkflowAlert: createMetadataObjectType({
    annotations: {
      [METADATA_TYPE]: 'WorkflowAlert',
    },
    fields: {
      recipients: {
        refType: new ListType(createMetadataObjectType({
          annotations: {
            [METADATA_TYPE]: 'WorkflowEmailRecipient',
          },
          fields: {
            recipient: {
              refType: BuiltinTypes.STRING,
            },
            type: {
              refType: BuiltinTypes.STRING,
            },
          },
        })),
      },
    },
  }),
  AccountSettings: new ObjectType({
    elemID: new ElemID(SALESFORCE, 'AccountSettings'),
    fields: {
      enableAccountOwnerReport: {
        refType: BuiltinTypes.BOOLEAN,
      },
    },
    annotations: {
      metadataType: 'AccountSettings',
    },
    isSettings: true,
  }),
}

export const lwcJsResourceContent = "import { LightningElement } from 'lwc';\nexport default class BikeCard extends LightningElement {\n   name = 'Electra X4';\n   description = 'A sweet bike built for comfort.';\n   category = 'Mountain';\n   material = 'Steel';\n   price = '$2,700';\n   pictureUrl = 'https://s3-us-west-1.amazonaws.com/sfdc-demo/ebikes/electrax4.jpg';\n }"
export const lwcHtmlResourceContent = '<template>\n    <div>\n        <div>Name: {name}</div>\n        <div>Description: {description}</div>\n        <lightning-badge label={material}></lightning-badge>\n        <lightning-badge label={category}></lightning-badge>\n        <div>Price: {price}</div>\n        <div><img src={pictureUrl}/></div>\n    </div>\n</template>'

export const mockDefaultValues = {
  ApexClass: {
    [INSTANCE_FULL_NAME_FIELD]: 'ApexClassForProfile',
    apiVersion: API_VERSION,
    content: "public class ApexClassForProfile {\n    public void printLog() {\n        System.debug('Created');\n    }\n}",
  },
  ApexPage: {
    [INSTANCE_FULL_NAME_FIELD]: 'ApexPageForProfile',
    apiVersion: API_VERSION,
    content: '<apex:page>Created by e2e test for profile test!</apex:page>',
    label: 'ApexPageForProfile',
  },
  AuraDefinitionBundle: {
    [INSTANCE_FULL_NAME_FIELD]: 'TestAuraDefinitionBundle',
    SVGContent: '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg width="120px" height="120px" viewBox="0 0 120 120" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n\t<g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n\t\t<path d="M120,108 C120,114.6 114.6,120 108,120 L12,120 C5.4,120 0,114.6 0,108 L0,12 C0,5.4 5.4,0 12,0 L108,0 C114.6,0 120,5.4 120,12 L120,108 L120,108 Z" id="Shape" fill="#2A739E"/>\n\t\t<path d="M77.7383308,20 L61.1640113,20 L44.7300055,63.2000173 L56.0543288,63.2000173 L40,99.623291 L72.7458388,54.5871812 L60.907727,54.5871812 L77.7383308,20 Z" id="Path-1" fill="#FFFFFF"/>\n\t</g>\n</svg>',
    apiVersion: 49,
    controllerContent: '({ myAction : function(component, event, helper) {} })',
    description: 'Test Lightning Component Bundle',
    designContent: '<design:component/>',
    documentationContent: '<aura:documentation>\n\t<aura:description>Documentation</aura:description>\n\t<aura:example name="ExampleName" ref="exampleComponentName" label="Label">\n\t\tEdited Example Description\n\t</aura:example>\n</aura:documentation>',
    helperContent: '({ helperMethod : function() {} })',
    markup: '<aura:component >\n\t<p>Hello Lightning!</p>\n</aura:component>',
    rendererContent: '({})',
    styleContent: '.THIS{\n}',
    type: 'Component',
  },
  LightningComponentBundle: {
    [INSTANCE_FULL_NAME_FIELD]: 'testLightningComponentBundle',
    apiVersion: 49,
    isExposed: true,
    lwcResources: {
      lwcResource: [
        {
          source: lwcJsResourceContent,
          filePath: 'lwc/testLightningComponentBundle/testLightningComponentBundle.js',
        },
        {
          source: lwcHtmlResourceContent,
          filePath: 'lwc/testLightningComponentBundle/testLightningComponentBundle.html',
        },
      ],
    },
    targetConfigs: {
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
    targets: {
      target: [
        'lightning__AppPage',
        'lightning__RecordPage',
        'lightning__HomePage',
      ],
    },
  },
  Profile: {
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
        default: false,
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
    description: 'new e2e profile',
    [INSTANCE_FULL_NAME_FIELD]: 'TestAddProfileInstance__c',
  },
  StaticResource: {
    [INSTANCE_FULL_NAME_FIELD]: 'TestStaticResource',
    cacheControl: 'Private',
    contentType: 'text/xml',
    description: 'Test Static Resource Description',
    content: Buffer.from('<xml/>'),
  },
}

// Intentionally let typescript infer the return type here to avoid repeating
// the definitions from the constants above
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const mockInstances = () => _.mapValues(
  mockDefaultValues,
  (values, typeName) => createInstanceElement(
    values,
    mockTypes[typeName as keyof typeof mockDefaultValues],
  )
)
