/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { lightningElementsUrlRetriever } from '../src/elements_url_retriever/elements_url_retriever'
import { mockTypes } from './mock_elements'
import { PATH_ASSISTANT_METADATA_TYPE } from '../src/constants'

describe('lightningElementsUrlRetriever', () => {
  it('when base url is invalid undefined returned', () => {
    expect(
      lightningElementsUrlRetriever(
        new URL('https://google.com'),
        async () => undefined,
      ),
    ).toBeUndefined()
  })

  describe('base url is valid', () => {
    const baseUrl = new URL('https://salto5-dev-ed.my.salesforce.com')

    const standardObject = new ObjectType({
      elemID: new ElemID('salesforce', 'Account'),
      annotations: { apiName: 'Account', metadataType: 'CustomObject' },
    })
    const customObject = new ObjectType({
      elemID: new ElemID('salesforce', 'custom__c'),
      annotations: {
        apiName: 'custom__c',
        internalId: 'someId',
        metadataType: 'CustomObject',
      },
    })
    const flowType = new ObjectType({
      elemID: new ElemID('salesforce', 'Flow'),
      annotations: { metadataType: 'Flow' },
    })

    const elementUrlRetriever = lightningElementsUrlRetriever(
      baseUrl,
      async (id) => {
        if (id.isEqual(new ElemID('salesforce', 'Account'))) {
          return standardObject
        }
        return undefined
      },
    )

    describe('lighteningElementsUrlRetriever creation', () => {
      it('valid baseUrl with my subdomain', () => {
        expect(elementUrlRetriever).toBeDefined()
      })

      it('valid baseUrl without my subdomain', () => {
        const urlRetriever = lightningElementsUrlRetriever(
          new URL('https://salto5-dev-ed.salesforce.com'),
          async () => undefined,
        )

        expect(urlRetriever).toBeDefined()
      })
    })

    describe('retrieveUrl', () => {
      it('generalConstantsResolver', async () => {
        const element = new ObjectType({
          elemID: new ElemID('salesforce', 'PermissionSetGroup'),
          annotations: { metadataType: 'PermissionSetGroup' },
        })
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/PermSetGroups/home',
          ),
        )
      })

      it('settingsConstantsResolver type', async () => {
        const element = new ObjectType({
          elemID: new ElemID('salesforce', 'BusinessHoursSettings'),
          annotations: { metadataType: 'BusinessHoursSettings' },
        })
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/BusinessHours/home',
          ),
        )
      })

      it('settingsConstantsResolver instance', async () => {
        const element = new InstanceElement(
          ElemID.CONFIG_NAME,
          new ObjectType({
            elemID: new ElemID('salesforce', 'BusinessHoursSettings'),
            annotations: { metadataType: 'BusinessHoursSettings' },
          }),
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/BusinessHours/home',
          ),
        )
      })

      it('AssignmentRulesResolver', async () => {
        const element = new InstanceElement(
          'Lead',
          new ObjectType({
            elemID: new ElemID('salesforce', 'AssignmentRules'),
            annotations: { metadataType: 'AssignmentRules' },
          }),
          { fullName: 'Lead' },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/LeadRules/home',
          ),
        )
      })

      it('AutoResponseRulesResolver', async () => {
        const element = new InstanceElement(
          'Case',
          new ObjectType({
            elemID: new ElemID('salesforce', 'AutoResponseRules'),
            annotations: { metadataType: 'AutoResponseRules' },
          }),
          { fullName: 'Case' },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/CaseResponses/home',
          ),
        )
      })

      it('standard object', async () => {
        expect(await elementUrlRetriever?.retrieveUrl(standardObject)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/Details/view',
          ),
        )
      })

      it('custom object', async () => {
        expect(await elementUrlRetriever?.retrieveUrl(customObject)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/someId/Details/view',
          ),
        )
      })

      it('standard field standard object', async () => {
        const element = new Field(
          standardObject,
          'standardField',
          BuiltinTypes.NUMBER,
          { apiName: 'standardField' },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/standardField/view',
          ),
        )
      })

      it('custom field standard object', async () => {
        const element = new Field(
          standardObject,
          'customField__c',
          BuiltinTypes.NUMBER,
          { internalId: 'someId' },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/someId/view',
          ),
        )
      })

      it('standard field custom object', async () => {
        const element = new Field(
          customObject,
          'standardField',
          BuiltinTypes.NUMBER,
          { apiName: 'standardField' },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/someId/FieldsAndRelationships/standardField/view',
          ),
        )
      })

      it('custom field custom object', async () => {
        const element = new Field(
          customObject,
          'customField__c',
          BuiltinTypes.NUMBER,
          { internalId: 'fieldId' },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/someId/FieldsAndRelationships/fieldId/view',
          ),
        )
      })

      it('standard relationship field standard object', async () => {
        const element = new Field(
          standardObject,
          'standardField',
          BuiltinTypes.NUMBER,
          { relationshipName: 'someRelationshipName' },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/someRelationshipName/view',
          ),
        )
      })

      it('custom metadata type', async () => {
        const element = new ObjectType({
          elemID: new ElemID('salesforce', 'custom__mdt'),
          annotations: { internalId: 'someId', apiName: 'custom__mdt' },
        })
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/CustomMetadata/page?address=%2FsomeId%3Fsetupid%3DCustomMetadata',
          ),
        )
      })

      it('flow', async () => {
        const element = new InstanceElement('flowName', flowType, {
          processType: 'Flow',
          internalId: 'someId',
        })
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/builder_platform_interaction/flowBuilder.app?flowId=someId',
          ),
        )
      })

      it('ProcessBuilder', async () => {
        const element = new InstanceElement('flowName', flowType, {
          processType: 'Workflow',
          internalId: 'someId',
        })
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ProcessAutomation/home',
          ),
        )
      })

      it('Queue', async () => {
        const element = new InstanceElement(
          'testQueue',
          new ObjectType({
            elemID: new ElemID('salesforce', 'Queue'),
            annotations: { metadataType: 'Queue' },
          }),
          { internalId: 'someId' },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3DsomeId',
          ),
        )
      })

      it('Object subtype Layout', async () => {
        const element = new InstanceElement(
          'testLayout',
          new ObjectType({
            elemID: new ElemID('salesforce', 'Layout'),
            annotations: { metadataType: 'Layout' },
          }),
          { internalId: 'someId' },
          [],
          {
            [CORE_ANNOTATIONS.PARENT]: [
              new ReferenceExpression(new ElemID('salesforce', 'Account')),
            ],
          },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/PageLayouts/someId/view',
          ),
        )
      })

      it('Object subtype WebLink', async () => {
        const element = new InstanceElement(
          'testWebLink',
          new ObjectType({
            elemID: new ElemID('salesforce', 'WebLink'),
            annotations: { metadataType: 'WebLink' },
          }),
          { internalId: 'someId' },
          [],
          {
            [CORE_ANNOTATIONS.PARENT]: [
              new ReferenceExpression(new ElemID('salesforce', 'Account')),
            ],
          },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/ButtonsLinksActions/someId/view',
          ),
        )
      })

      it('Layout without parent', async () => {
        const element = new InstanceElement(
          'testLayout',
          new ObjectType({ elemID: new ElemID('salesforce', 'Layout') }),
          { internalId: 'someId' },
          [],
          {
            [CORE_ANNOTATIONS.PARENT]: [
              new ReferenceExpression(new ElemID('salesforce', 'NotExists')),
            ],
          },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/_classic/%2FsomeId',
          ),
        )
      })

      it('pathAssistantResolver', async () => {
        const element = new InstanceElement(
          PATH_ASSISTANT_METADATA_TYPE,
          mockTypes.PathAssistant,
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/setup/PathAssistantSetupHome/page?address=%2Fui%2Fsetup%2Fpathassistant%2FPathAssistantSetupPage%3Fisdtp%3Dp1',
          ),
        )
      })

      it('internalIdResolver', async () => {
        const element = new ObjectType({
          elemID: new ElemID('salesforce', 'someType'),
          annotations: { internalId: 'someId' },
        })
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            'https://salto5-dev-ed.lightning.force.com/lightning/_classic/%2FsomeId',
          ),
        )
      })

      it('instance of custom object', async () => {
        const element = new InstanceElement(
          'InstanceOfCustomObject',
          customObject,
          { Id: 'instanceId' },
        )
        expect(await elementUrlRetriever?.retrieveUrl(element)).toEqual(
          new URL(
            `https://salto5-dev-ed.lightning.force.com/lightning/r/${customObject.annotations.apiName}/instanceId/view`,
          ),
        )
      })

      it('unknown element', async () => {
        const element = new ObjectType({
          elemID: new ElemID('salesforce', 'someType'),
        })
        expect(elementUrlRetriever).toBeDefined()
        if (elementUrlRetriever !== undefined) {
          expect(await elementUrlRetriever.retrieveUrl(element)).toBeUndefined()
        }
      })
    })
  })
})
