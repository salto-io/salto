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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { lightiningElementsUrlRetreiver } from '../src/elements_url_retreiver/elements_url_retreiver'


describe('lightiningElementsUrlRetreiver', () => {
  it('when base url is invalid undefined returned', () => {
    expect(lightiningElementsUrlRetreiver(new URL('https://google.com'), _id => Promise.resolve(undefined))).toBeUndefined()
  })

  describe('base url is valid', () => {
    const baseUrl = new URL('https://salto5-dev-ed.my.salesforce.com')

    const standardObject = new ObjectType({ elemID: new ElemID('salesforce', 'Account'), annotations: { apiName: 'Account' } })
    const customObject = new ObjectType({ elemID: new ElemID('salesforce', 'custom__c'), annotations: { internalId: 'someId' } })
    const flowType = new ObjectType({ elemID: new ElemID('salesforce', 'Flow') })

    const elementUrlRetreiver = lightiningElementsUrlRetreiver(
      baseUrl,
      async id => {
        if (id.isEqual(new ElemID('salesforce', 'Account'))) {
          return standardObject
        }
        return undefined
      }
    )

    it('valid elementUrlRetreiver is returned', () => {
      expect(elementUrlRetreiver).toBeDefined()
    })

    it('retreiveBaseUrl returns lightining url', () => {
      expect(elementUrlRetreiver?.retreiveBaseUrl()).toEqual(new URL('https://salto5-dev-ed.lightning.force.com'))
    })
    describe('retreiveUrl', () => {
      it('genernalConstantsResolver', async () => {
        const element = new ObjectType({ elemID: new ElemID('salesforce', 'PermissionSetGroup') })
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/PermSetGroups/home'))
      })

      it('settingsConstantsResolver type', async () => {
        const element = new ObjectType({ elemID: new ElemID('salesforce', 'BusinessHoursSettings') })
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/BusinessHours/home'))
      })

      it('settingsConstantsResolver instance', async () => {
        const element = new InstanceElement(ElemID.CONFIG_NAME, new ObjectType({ elemID: new ElemID('salesforce', 'BusinessHoursSettings') }))
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/BusinessHours/home'))
      })

      it('standard object', async () => {
        expect(await elementUrlRetreiver?.retreiveUrl(standardObject)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/Details/view'))
      })

      it('custom object', async () => {
        expect(await elementUrlRetreiver?.retreiveUrl(customObject)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/someId/Details/view'))
      })

      it('standard field standard object', async () => {
        const element = new Field(standardObject, 'standardField', BuiltinTypes.NUMBER)
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/standardField/view'))
      })

      it('custom field standard object', async () => {
        const element = new Field(standardObject, 'customField__c', BuiltinTypes.NUMBER, { internalId: 'someId' })
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/someId/view'))
      })

      it('standard field custom object', async () => {
        const element = new Field(customObject, 'standardField', BuiltinTypes.NUMBER)
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/someId/FieldsAndRelationships/standardField/view'))
      })

      it('custom field custom object', async () => {
        const element = new Field(customObject, 'customField__c', BuiltinTypes.NUMBER, { internalId: 'fieldId' })
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/someId/FieldsAndRelationships/fieldId/view'))
      })

      it('standard relationship field standard object', async () => {
        const element = new Field(standardObject, 'standardField', BuiltinTypes.NUMBER, { relationshipName: 'someRelationshipName' })
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/FieldsAndRelationships/someRelationshipName/view'))
      })

      it('custom metadata type', async () => {
        const element = new ObjectType({ elemID: new ElemID('salesforce', 'custom__mdt'), annotations: { internalId: 'someId' } })
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/CustomMetadata/page?address=%2FsomeId%3Fsetupid%3DCustomMetadata'))
      })

      it('flow', async () => {
        const element = new InstanceElement('flowName', flowType, { processType: 'Flow', internalId: 'someId' })
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/builder_platform_interaction/flowBuilder.app?flowId=someId'))
      })

      it('ProcessBuilder', async () => {
        const element = new InstanceElement('flowName', flowType, { processType: 'Workflow', internalId: 'someId' })
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/ProcessAutomation/home'))
      })

      it('Queue', async () => {
        const element = new InstanceElement(
          'testQueue',
          new ObjectType({ elemID: new ElemID('salesforce', 'Queue') }),
          { internalId: 'someId' }
        )
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/Queues/page?address=%2Fp%2Fown%2FQueue%2Fd%3Fid%3DsomeId'))
      })

      it('Layout', async () => {
        const element = new InstanceElement(
          'testLayout',
          new ObjectType({ elemID: new ElemID('salesforce', 'Layout') }),
          { internalId: 'someId' },
          [],
          { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID('salesforce', 'Account'))] }
        )
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/setup/ObjectManager/Account/PageLayouts/someId/view'))
      })

      it('Layout without parent', async () => {
        const element = new InstanceElement(
          'testLayout',
          new ObjectType({ elemID: new ElemID('salesforce', 'Layout') }),
          { internalId: 'someId' },
          [],
          { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID('salesforce', 'NotExists'))] }
        )
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/_classic/%2FsomeId'))
      })

      it('internalIdResolver', async () => {
        const element = new ObjectType({ elemID: new ElemID('salesforce', 'someType'), annotations: { internalId: 'someId' } })
        expect(await elementUrlRetreiver?.retreiveUrl(element)).toEqual(new URL('https://salto5-dev-ed.lightning.force.com/lightning/_classic/%2FsomeId'))
      })

      it('unkown element', async () => {
        const element = new ObjectType({ elemID: new ElemID('salesforce', 'someType') })
        expect(elementUrlRetreiver).toBeDefined()
        if (values.isDefined(elementUrlRetreiver)) {
          expect(await elementUrlRetreiver.retreiveUrl(element)).toBeUndefined()
        }
      })
    })
  })
})
