/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'
import { collections } from '@salto-io/lowerdash'
import { exists, readTextFile } from '@salto-io/file'
import {
  Change,
  CORE_ANNOTATIONS,
  DumpElementsResult,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { dumpElementsToFolder } from '../../src/sfdx_parser/sfdx_dump'
import { mockTypes, mockDefaultValues } from '../mock_elements'
import { createInstanceElement, Types } from '../../src/transformers/transformer'
import { createCustomObjectType } from '../utils'
import { xmlToValues } from '../../src/transformers/xml_transformer'
import { setupTmpProject } from './utils'

describe('dumpElementsToFolder', () => {
  const getExistingCustomObject = (): ObjectType =>
    createCustomObjectType('Test__c', {
      fields: {
        One__c: { refType: Types.primitiveDataTypes.Number, annotations: { apiName: 'Test__c.One__c' } },
        Check__c: { refType: Types.primitiveDataTypes.Checkbox, annotations: { apiName: 'Test__c.Check__c' } },
      },
    })

  describe('with simple metadata instances', () => {
    describe('when adding a new instance', () => {
      const project = setupTmpProject()
      let dumpResult: DumpElementsResult
      beforeAll(async () => {
        const newElement = createInstanceElement(mockDefaultValues.StaticResource, mockTypes.StaticResource)
        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes: [toChange({ after: newElement })],
          elementsSource: buildElementsSourceFromElements([newElement]),
        })
      })

      it('should apply all changes and have no errors', () => {
        expect(dumpResult.unappliedChanges).toHaveLength(0)
        expect(dumpResult.errors).toHaveLength(0)
      })
      it('should create the XML of the new metadata instance', async () => {
        const metadataPath = path.join(
          project.name(),
          'force-app/main/default/staticresources/TestStaticResource.resource-meta.xml',
        )
        const metadataContent = await readTextFile.notFoundAsUndefined(metadataPath)
        expect(metadataContent).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
<StaticResource xmlns="http://soap.sforce.com/2006/04/metadata">
    <cacheControl>Private</cacheControl>
    <contentType>text/xml</contentType>
    <description>Test Static Resource Description</description>
</StaticResource>
`)
      })
    })

    describe('when deleting an existing instance', () => {
      const project = setupTmpProject()
      let dumpResult: DumpElementsResult
      let elementFilePaths: string[]
      beforeAll(async () => {
        const before = createInstanceElement({ fullName: 'MySampleApexClass' }, mockTypes.ApexClass)

        // Ensure the files exists before we start
        elementFilePaths = [
          path.join(project.name(), 'force-app/main/default/classes/MySampleApexClass.cls'),
          path.join(project.name(), 'force-app/main/default/classes/MySampleApexClass.cls-meta.xml'),
        ]
        await Promise.all(elementFilePaths.map(filePath => expect(exists(filePath)).resolves.toBeTrue()))

        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes: [toChange({ before })],
          elementsSource: buildElementsSourceFromElements([]),
        })
      })
      it('should apply all changes and have no errors', () => {
        expect(dumpResult.unappliedChanges).toHaveLength(0)
        expect(dumpResult.errors).toHaveLength(0)
      })
      it('should delete the XML files of the deleted element', async () => {
        await Promise.all(elementFilePaths.map(filePath => expect(exists(filePath)).resolves.toBeFalse()))
      })
    })
  })

  describe('with nested instances', () => {
    describe('with instances of a non-decomposed type', () => {
      // The SFDX code has special treatment for types that are "non-decomposed", meaning, remain nested within their parent XML
      // this is in contrast to "decomposed" types, like, CustomField for example, where they are split into a different file
      let existingWorkflowRules: InstanceElement[]
      let existingEmailTemplate: InstanceElement
      let existingWorkflowAlert: InstanceElement
      beforeAll(() => {
        existingWorkflowRules = [
          createInstanceElement(
            {
              fullName: 'Test__c.TestRule1',
              active: false,
              formula: 'One__c > 2',
              triggerType: 'onCreateOrTriggeringUpdate',
            },
            mockTypes.WorkflowRule,
            undefined,
            { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID('salesforce', 'Test__c'))] },
          ),
          createInstanceElement(
            {
              fullName: 'Test__c.TestRule2',
              active: false,
              formula: 'One__c < 10',
              triggerType: 'onCreateOrTriggeringUpdate',
            },
            mockTypes.WorkflowRule,
            undefined,
            { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID('salesforce', 'Test__c'))] },
          ),
        ]
        existingEmailTemplate = createInstanceElement(
          {
            fullName: 'Template 1',
            content: 'email content',
          },
          mockTypes.EmailTemplate,
        )
        existingWorkflowAlert = createInstanceElement(
          {
            fullName: 'Test__c.Alert 1',
            description: 'Alert 1',
            protected: false,
            senderType: 'currentUser',
            template: new ReferenceExpression(existingEmailTemplate.elemID),
          },
          mockTypes.WorkflowAlert,
          undefined,
          { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID('salesforce', 'Test__c'))] },
        )
      })
      describe('when adding a new nested instance', () => {
        const project = setupTmpProject()
        let dumpResult: DumpElementsResult
        beforeAll(async () => {
          // Here we use an example of a WorkflowRule that is dumped into a Workflow xml
          // Doing this makes us go through different code paths in SFDX, specifically, the flow that requires "readFileSync"
          // to be implemented in our SyncZipTreeContainer
          const newWorkflowRule = createInstanceElement(
            { fullName: 'Test__c.Rule', actions: [], active: false },
            mockTypes.WorkflowRule,
            undefined,
            { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID('salesforce', 'Test__c'))] },
          )
          dumpResult = await dumpElementsToFolder({
            baseDir: project.name(),
            changes: [toChange({ after: newWorkflowRule })],
            elementsSource: buildElementsSourceFromElements([
              mockTypes.WorkflowRule,
              newWorkflowRule,
              ...existingWorkflowRules,
              existingEmailTemplate,
              existingWorkflowAlert,
            ]),
          })
        })
        it('should apply all changes and have no errors', () => {
          expect(dumpResult.unappliedChanges).toHaveLength(0)
          expect(dumpResult.errors).toHaveLength(0)
        })
        describe('workflow xml content', () => {
          let rules: Value[]
          let alerts: Value[]
          beforeAll(async () => {
            const parentXmlPath = path.join(
              project.name(),
              'force-app/main/default/workflows/Test__c.workflow-meta.xml',
            )
            await expect(exists(parentXmlPath)).resolves.toBeTrue()
            const xmlContent = await readTextFile(parentXmlPath)
            const values = xmlToValues(xmlContent)
            rules = collections.array.makeArray(values.values.rules)
            alerts = collections.array.makeArray(values.values.alerts)
          })
          it('should add the instance to the parent XML', () => {
            expect(rules).toContainEqual(expect.objectContaining({ fullName: 'Rule' }))
          })
          it('should keep the existing nested instances from before', () => {
            expect(rules).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ fullName: 'TestRule1' }),
                expect.objectContaining({ fullName: 'TestRule2' }),
              ]),
            )
            expect(alerts).toEqual(expect.arrayContaining([expect.objectContaining({ fullName: 'Alert 1' })]))
          })
          it('should resolve references', () => {
            expect(alerts[0].template).toEqual(existingEmailTemplate.value.fullName)
          })
        })
      })
      describe('when deleting a nested instance', () => {
        const project = setupTmpProject()
        let dumpResult: DumpElementsResult
        beforeAll(async () => {
          dumpResult = await dumpElementsToFolder({
            baseDir: project.name(),
            changes: [toChange({ before: existingWorkflowRules[0] })],
            elementsSource: buildElementsSourceFromElements([
              mockTypes.WorkflowRule,
              ...existingWorkflowRules.slice(1),
            ]),
          })
        })
        it('should apply all changes and have no errors', () => {
          expect(dumpResult.unappliedChanges).toHaveLength(0)
          expect(dumpResult.errors).toHaveLength(0)
        })
        describe('workflow xml content', () => {
          let rules: Value[]
          beforeAll(async () => {
            const parentXmlPath = path.join(
              project.name(),
              'force-app/main/default/workflows/Test__c.workflow-meta.xml',
            )
            await expect(exists(parentXmlPath)).resolves.toBeTrue()
            const xmlContent = await readTextFile(parentXmlPath)
            const values = xmlToValues(xmlContent)
            rules = collections.array.makeArray(values.values.rules)
          })
          it('should remove the nested instance from the parent XML', () => {
            expect(rules).not.toContainEqual(expect.objectContaining({ fullName: 'TestRule1' }))
          })
          it('should keep nested instances that were not removed', () => {
            expect(rules).toContainEqual(expect.objectContaining({ fullName: 'TestRule2' }))
          })
        })
      })
    })

    describe('when modifying an existing nested instance', () => {
      const project = setupTmpProject()
      let dumpResult: DumpElementsResult
      beforeAll(async () => {
        const parent = createCustomObjectType('Test__c', {})
        const before = createInstanceElement(
          {
            fullName: 'Test__c.All',
            filterScope: 'Everything',
            label: 'All',
          },
          mockTypes.ListView,
          undefined,
          { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
        )
        const after = before.clone()
        after.value.label = 'Updated label'

        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes: [toChange({ before, after })],
          elementsSource: buildElementsSourceFromElements([after]),
        })
      })
      it('should apply all changes and have no errors', () => {
        expect(dumpResult.unappliedChanges).toHaveLength(0)
        expect(dumpResult.errors).toHaveLength(0)
      })
      it('should update the existing XML', async () => {
        const metadataPath = path.join(
          project.name(),
          'force-app/main/default/objects/Test__c/listViews/All.listView-meta.xml',
        )
        const metadataContent = await readTextFile.notFoundAsUndefined(metadataPath)
        expect(metadataContent).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
<ListView xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>All</fullName>
    <filterScope>Everything</filterScope>
    <label>Updated label</label>
</ListView>
`)
      })
    })
  })

  describe('with fields', () => {
    describe('when adding a field', () => {
      const project = setupTmpProject()
      let dumpResult: DumpElementsResult
      beforeAll(async () => {
        const object = getExistingCustomObject()
        object.fields.New__c = new Field(object, 'New__c', Types.primitiveDataTypes.Text, {
          apiName: 'Test__c.New__c',
        })
        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes: [toChange({ after: object.fields.New__c })],
          elementsSource: buildElementsSourceFromElements([object]),
        })
      })
      it('should apply all changes and have no errors', () => {
        expect(dumpResult.unappliedChanges).toHaveLength(0)
        expect(dumpResult.errors).toHaveLength(0)
      })
      it('should create an XML for the new field', async () => {
        const metadataContent = await readTextFile.notFoundAsUndefined(
          path.join(project.name(), 'force-app/main/default/objects/Test__c/fields/New__c.field-meta.xml'),
        )
        expect(metadataContent).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>New__c</fullName>
    <type>Text</type>
    <required>false</required>
    <length>80</length>
</CustomField>
`)
      })
    })
    describe('when deleting a field', () => {
      const project = setupTmpProject()
      let dumpResult: DumpElementsResult
      let fieldFilePath: string
      beforeAll(async () => {
        const before = getExistingCustomObject()
        const after = before.clone()
        delete after.fields.One__c

        // Ensure the field file exists before we start
        fieldFilePath = path.join(project.name(), 'force-app/main/default/objects/Test__c/fields/One__c.field-meta.xml')
        await expect(exists(fieldFilePath)).resolves.toBeTrue()

        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes: [toChange({ before: before.fields.One__c })],
          elementsSource: buildElementsSourceFromElements([after]),
        })
      })
      it('should apply all changes and have no errors', () => {
        expect(dumpResult.unappliedChanges).toHaveLength(0)
        expect(dumpResult.errors).toHaveLength(0)
      })
      it('should delete the XML files of the nested element', async () => {
        await expect(exists(fieldFilePath)).resolves.toBeFalse()
      })
    })
  })

  describe('with custom object', () => {
    describe('when a custom object is deleted', () => {
      const project = setupTmpProject()
      let objectFolderPath: string
      let dumpResult: DumpElementsResult
      beforeAll(async () => {
        // Ensure the folder exists before we start
        objectFolderPath = path.join(project.name(), 'force-app/main/default/objects/Test__c')
        await expect(exists(objectFolderPath)).resolves.toBeTrue()

        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes: [toChange({ before: getExistingCustomObject() })],
          elementsSource: buildElementsSourceFromElements([]),
        })
      })
      it('should apply all changes and have no errors', () => {
        expect(dumpResult.unappliedChanges).toHaveLength(0)
        expect(dumpResult.errors).toHaveLength(0)
      })
      it('should delete the entire object folder', async () => {
        await expect(exists(objectFolderPath)).resolves.toBeFalse()
      })
    })
  })

  describe('with unsupported changes', () => {
    describe('with custom object instance change', () => {
      const project = setupTmpProject()
      let change: Change
      let dumpResult: DumpElementsResult
      beforeAll(async () => {
        const customObject = getExistingCustomObject()
        const customObjectInstance = new InstanceElement('test', customObject, { One__c: 1 })
        change = toChange({ after: customObjectInstance })
        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes: [change],
          elementsSource: buildElementsSourceFromElements([]),
        })
      })
      it('should return the change as unapplied', () => {
        expect(dumpResult.unappliedChanges).toContain(change)
      })
    })
    describe('with type change', () => {
      const project = setupTmpProject()
      let change: Change
      let dumpResult: DumpElementsResult
      beforeAll(async () => {
        const before = mockTypes.ApexClass.clone()
        const after = before.clone()
        after.annotations.bla = 'foo'
        change = toChange({ before, after })
        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes: [change],
          elementsSource: buildElementsSourceFromElements([]),
        })
      })
      it('should return the change as unapplied', () => {
        expect(dumpResult.unappliedChanges).toContain(change)
      })
    })
    describe('with change to unsupported metadata type', () => {
      const project = setupTmpProject()
      let changes: Change[]
      let dumpResult: DumpElementsResult
      beforeAll(async () => {
        const labelInstance = new InstanceElement('label1', mockTypes.CustomLabel, { fullName: 'label1' })
        changes = [toChange({ after: labelInstance })]
        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes,
          elementsSource: buildElementsSourceFromElements([]),
        })
      })
      it('should return the change as unapplied', () => {
        expect(dumpResult.unappliedChanges).toContainAllValues(changes)
      })
    })
  })
})
