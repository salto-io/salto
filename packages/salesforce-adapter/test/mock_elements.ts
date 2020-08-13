/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType, ElemID, TypeElement, BuiltinTypes, ListType } from '@salto-io/adapter-api'
import { SALESFORCE, INSTANCE_FULL_NAME_FIELD, ASSIGNMENT_RULES_METADATA_TYPE } from '../src/constants'
import { MetadataTypeAnnotations, MetadataObjectType } from '../src/transformers/transformer'
import { allMissingSubTypes } from '../src/transformers/salesforce_types'
import { API_VERSION } from '../src/client/client'

type ObjectTypeCtorParam = ConstructorParameters<typeof ObjectType>[0]
type CreateMetadataObjectTypeParams = Omit<ObjectTypeCtorParam, 'elemID'> & {
  annotations: MetadataTypeAnnotations
}
const createMetadataObjectType = (
  params: CreateMetadataObjectTypeParams
): MetadataObjectType => new ObjectType({
  elemID: new ElemID(SALESFORCE, params.annotations.metadataType),
  ...params,
  fields: {
    [INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
    ...params.fields,
  },
}) as MetadataObjectType

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
  StaticResource: createMetadataObjectType({
    annotations: {
      metadataType: 'StaticResource',
      dirName: 'staticresources',
      suffix: 'resource',
      hasMetaFile: true,
    },
  }),
  LightningComponentBundle: createMetadataObjectType({
    annotations: { metadataType: 'LightningComponentBundle', dirName: 'lwc' },
    fields: {
      targetConfigs: {
        type: allMissingSubTypes.find(t => t.elemID.typeName === 'TargetConfigs') as TypeElement,
      },
    },
  }),
  Layout: createMetadataObjectType({
    annotations: { metadataType: 'Layout', dirName: 'layouts', suffix: 'layout' },
  }),
  Profile: createMetadataObjectType({
    annotations: { metadataType: 'Profile', dirName: 'profiles', suffix: 'profile' },
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
        type: new ListType(createMetadataObjectType(
          { annotations: { metadataType: 'AssignmentRule' } }
        )),
      },
    },
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
  StaticResource: {
    [INSTANCE_FULL_NAME_FIELD]: 'TestStaticResource',
    cacheControl: 'Private',
    contentType: 'text/xml',
    description: 'Test Static Resource Description',
    content: Buffer.from('<xml/>'),
  },
}
