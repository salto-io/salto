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
import fs from 'fs'
import path from 'path'
import { exists, readTextFile } from '@salto-io/file'
import { setupTmpDir } from '@salto-io/test-utils'
import {
  CORE_ANNOTATIONS,
  DumpElementsResult,
  ElemID,
  Field,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { dumpElementsToFolder } from '../../src/sfdx_parser/sfdx_dump'
import { mockTypes, mockDefaultValues } from '../mock_elements'
import { createInstanceElement, createMetadataObjectType, Types } from '../../src/transformers/transformer'
import { createCustomObjectType } from '../utils'
import { WORKFLOW_RULE_METADATA_TYPE } from '../../src/constants'

describe('dumpElementsToFolder', () => {
  const setupTmpProject = (): ReturnType<typeof setupTmpDir> => {
    const tmpDir = setupTmpDir('all')
    beforeAll(async () => {
      await fs.promises.cp(path.join(__dirname, 'test_sfdx_project'), tmpDir.name(), { recursive: true })
    })
    return tmpDir
  }

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
    describe('when adding a new nested instance of a non-decomposed type', () => {
      const project = setupTmpProject()
      let dumpResult: DumpElementsResult
      beforeAll(async () => {
        // The SFDX code has special treatment for types that are "non-decomposed", meaning, remain nested within their parent XML
        // this is in contrast to "decomposed" types, like, CustomField for example, where they are split into a different file
        // Here we use an example of a WorkflowRule that is dumped into a Workflow xml
        // Doing this makes us go through different code paths in SFDX, specifically, the flow that requires "readFileSync"
        // to be implemented in our SyncZipTreeContainer
        const workflowRuleType = createMetadataObjectType({
          annotations: { metadataType: WORKFLOW_RULE_METADATA_TYPE },
        })
        const workflowRule = createInstanceElement(
          { fullName: 'Test__c.Rule', actions: [], active: false },
          workflowRuleType,
          undefined,
          { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID('salesforce', 'Test__c'))] },
        )
        dumpResult = await dumpElementsToFolder({
          baseDir: project.name(),
          changes: [toChange({ after: workflowRule })],
          elementsSource: buildElementsSourceFromElements([workflowRuleType, workflowRule]),
        })
      })
      it('should apply all changes and have no errors', () => {
        expect(dumpResult.unappliedChanges).toHaveLength(0)
        expect(dumpResult.errors).toHaveLength(0)
      })
      it('should create the parent XML', async () => {
        await expect(
          exists(path.join(project.name(), 'force-app/main/default/workflows/Test__c.workflow-meta.xml')),
        ).resolves.toBeTrue()
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
    <length>80</length>
    <required>false</required>
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
})
