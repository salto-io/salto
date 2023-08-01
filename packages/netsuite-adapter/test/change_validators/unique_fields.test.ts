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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ElemID, InstanceElement, ObjectType, toChange, ReadOnlyElementsSource, Field, Element, ChangeDataType } from '@salto-io/adapter-api'
import uniqueFields from '../../src/change_validators/unique_fields'
import { CUSTOM_RECORD_TYPE, CUSTOM_RECORD_TYPE_PREFIX, FINANCIAL_LAYOUT, METADATA_TYPE, NAME_FIELD, NETSUITE, SAVED_SEARCH, WORKFLOW } from '../../src/constants'

const DUPLICATED_FIELD = 'test uniqueness'
const UNIQUE_FIELD = 'test uniqueness 2'

const FIELD_DEFAULT_NAME = 'FIELD_DEFAULT_NAME'

describe('unique fields validator', () => {
  type TestElements = {
    basic: ChangeDataType
    sameField: ChangeDataType
    diffField: ChangeDataType
  }

  const getTestElements = (
    typeName: string,
    createElem: (name: string, type: ObjectType, uniqueField: string) => ChangeDataType
  ): TestElements => ({
    basic: createElem(
      'test',
      new ObjectType({ elemID: new ElemID(NETSUITE, typeName) }),
      DUPLICATED_FIELD
    ),
    sameField: createElem(
      'test_same_title_diff_id',
      new ObjectType({ elemID: new ElemID(NETSUITE, typeName) }),
      DUPLICATED_FIELD
    ),
    diffField: createElem(
      'test_diff_title_diff_id',
      new ObjectType({ elemID: new ElemID(NETSUITE, typeName) }),
      UNIQUE_FIELD
    ),
  })

  const getIDToVal = (
    testInstances: TestElements,
    nestedField: string
  ): Map<string, string> => new Map(Object.values(testInstances)
    .map(elem =>
      [elem.elemID.createNestedID(nestedField).getFullName(),
        (elem as InstanceElement).value[nestedField]]))

  const getIDToValWorkflow = (
    testInstances: TestElements,
    nestedField: string
  ): Map<string, string> => new Map(Object.values(testInstances)
    .map(elem =>
      [elem.elemID.createNestedID(nestedField).getFullName(),
        (elem as InstanceElement).value
          .workflowcustomfields.workflowcustomfield.custworkflow1.scriptid]))

  const getIDToValScript = (
    testInstances: TestElements,
    nestedField: string
  ): Map<string, string> => new Map(Object.values(testInstances)
    .map(elem =>
      [elem.elemID.createNestedID(nestedField).getFullName(),
        (elem as InstanceElement).value
          .scriptcustomfields.scriptcustomfield.custscript1.scriptid]))

  const buildMockElementsSource = (
    elementSource: ReadOnlyElementsSource,
    idToVal: Map<string, string>
  ): ReadOnlyElementsSource => {
    const mockGet = jest.fn().mockImplementation((id: ElemID) => idToVal.get(id.getFullName()) ?? elementSource.get(id))
    const mockElementsSource = {
      list: elementSource.list,
      getAll: elementSource.getAll,
      has: elementSource.has,
      get: mockGet,
    } as unknown as ReadOnlyElementsSource

    return mockElementsSource
  }

  const getSavedSearchElements = (): TestElements => getTestElements(SAVED_SEARCH,
    (name: string, elemID: ObjectType, uniqueField: string) =>
      new InstanceElement(name, elemID, { FIELD_DEFAULT_NAME: uniqueField }))

  const getFinancialLayoutElements = (): TestElements => getTestElements(FINANCIAL_LAYOUT,
    (name: string, elemID: ObjectType, uniqueField: string) =>
      new InstanceElement(name, elemID, { name: uniqueField }))

  const getWorkflowElements = (): TestElements => getTestElements(WORKFLOW,
    (name: string, elemID: ObjectType, uniqueField: string) => {
      const custworkflow1 = {
        scriptid: uniqueField,
      }
      const workflowcustomfield = { custworkflow1 }
      const workflowCustomFields = { workflowcustomfield }
      return new InstanceElement(name, elemID, { workflowcustomfields: workflowCustomFields })
    })

  const getScriptSuiteletElements = (): TestElements => getTestElements('suitelet',
    (name: string, elemID: ObjectType, uniqueField: string) => {
      const custscript1 = {
        scriptid: uniqueField,
      }
      const scriptcustomfield = { custscript1 }
      const scriptCustomFields = { scriptcustomfield }
      return new InstanceElement(name, elemID, { scriptcustomfields: scriptCustomFields })
    })

  const getScriptRestletElements = (): TestElements => getTestElements('restlet',
    (name: string, elemID: ObjectType, uniqueField: string) => {
      const custscript1 = {
        scriptid: uniqueField,
      }
      const scriptcustomfield = { custscript1 }
      const scriptCustomFields = { scriptcustomfield }
      return new InstanceElement(name, elemID, { scriptcustomfields: scriptCustomFields })
    })

  const getCustomRecordElements = (): TestElements => getTestElements(CUSTOM_RECORD_TYPE_PREFIX,
    (name: string, elemID: ObjectType, uniqueField: string) =>
      new ObjectType({
        elemID: new ElemID(elemID.elemID.adapter, elemID.elemID.typeName + uniqueField),
        annotations: {
          name,
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        },
        fields: {
          custom_custrecord1: {
            refType: elemID,
            annotations: {
              scriptid: uniqueField,
            },
          },
        },
      }))

  const getCustomRecordChanges = (customRecordTestObjects: TestElements): TestElements => {
    const getFieldFromElement = (element: ObjectType): Field =>
      new Field(element, element.annotations.name, element, element.fields.custom_custrecord1.annotations)
    return {
      basic: getFieldFromElement(customRecordTestObjects.basic as ObjectType),
      sameField: getFieldFromElement(customRecordTestObjects.sameField as ObjectType),
      diffField: getFieldFromElement(customRecordTestObjects.diffField as ObjectType),
    }
  }

  describe('Saved Search unique `title` field validator', () => {
    const testElements = getSavedSearchElements()
    const idToVal = getIDToVal(testElements, FIELD_DEFAULT_NAME)
    const buildElementsSource = (elements: readonly Element[]): ReadOnlyElementsSource =>
      buildMockElementsSource(buildElementsSourceFromElements(elements), idToVal)

    describe('Saved Search with a unique title', () => {
      it('Should not have a change error when adding a new Saved Search with a unique title', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElements.basic })],
          undefined,
          buildElementsSource([
            testElements.diffField,
            testElements.basic])
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when modifying a Saved Search with a unique title', async () => {
        const changeErrors = await uniqueFields(
          [toChange(
            { before: testElements.basic,
              after: testElements.sameField }
          )],
          undefined,
          buildElementsSource([
            testElements.diffField,
            testElements.sameField])
        )
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('Saved Search with an existing title', () => {
      it('Should have a change error when adding a new Saved Search with an existing title', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElements.sameField })],
          undefined,
          buildElementsSource([
            testElements.basic,
            testElements.sameField])
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testElements.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })

      it('Should have a change error when modifying a Saved Search`s title to an existing one', async () => {
        const changeErrors = await uniqueFields([
          toChange(
            { before: testElements.diffField,
              after: testElements.sameField }
          ),
        ], undefined,
        buildElementsSource([
          testElements.basic,
          testElements.sameField]))
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testElements.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })
    })
  })

  describe('Financial Layout unique `name` field validator', () => {
    const testElements = getFinancialLayoutElements()
    const idToVal = getIDToVal(testElements, NAME_FIELD)
    const buildElementsSource = (elements: readonly Element[]): ReadOnlyElementsSource =>
      buildMockElementsSource(buildElementsSourceFromElements(elements), idToVal)

    describe('Financial Layout with a unique name', () => {
      it('Should not have a change error when adding a new Financial Layout with a unique name', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElements.basic })],
          undefined,
          buildElementsSource([
            testElements.diffField,
            testElements.basic])
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when modifying a Financial Layout with a unique name', async () => {
        const changeErrors = await uniqueFields(
          [toChange(
            { before: testElements.basic,
              after: testElements.sameField }
          )],
          undefined,
          buildElementsSource([
            testElements.diffField,
            testElements.sameField])
        )
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('Financial Layout with an existing name', () => {
      it('Should have a change error when adding a new Financial Layout with an existing name', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElements.sameField })],
          undefined,
          buildElementsSource([
            testElements.basic,
            testElements.sameField])
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testElements.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })

      it('Should have a change error when modifying a Financial Layout`s name to an existing one', async () => {
        const changeErrors = await uniqueFields([
          toChange(
            { before: testElements.diffField,
              after: testElements.sameField }
          ),
        ], undefined,
        buildElementsSource([
          testElements.basic,
          testElements.sameField]))
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testElements.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })
    })
  })

  describe('Custom Record Type Field unique `scriptid` field validator', () => {
    const testElements = getCustomRecordElements()
    const testChanges = getCustomRecordChanges(testElements)

    describe('Custom Record Type Field with a unique scriptid', () => {
      it('Should not have a change error when adding a new Custom Record Type Field with a unique scriptid', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testChanges.basic })],
          undefined,
          buildElementsSourceFromElements([
            testElements.diffField,
            testElements.basic])
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when modifying a Custom Record Type Field with a unique scriptid', async () => {
        const changeErrors = await uniqueFields(
          [toChange(
            { before: testChanges.basic,
              after: testChanges.sameField }
          )],
          undefined,
          buildElementsSourceFromElements([
            testElements.diffField,
            testElements.sameField])
        )
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('Custom Record Type Field with an existing scriptid', () => {
      it('Should have a change error when adding a new Custom Record Type Field with an existing scriptid', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testChanges.sameField })],
          undefined,
          buildElementsSourceFromElements([
            testElements.basic,
            testElements.sameField])
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testChanges.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })

      it('Should have a change error when modifying a Custom Record Type Field`s scriptid to an existing one', async () => {
        const changeErrors = await uniqueFields([
          toChange(
            { before: testChanges.diffField,
              after: testChanges.sameField }
          ),
        ], undefined,
        buildElementsSourceFromElements([
          testElements.basic,
          testElements.sameField]))
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testChanges.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })
    })
  })

  describe('Workflow custom field unique `scriptid` field validator', () => {
    const testElements = getWorkflowElements()
    const idToVal = getIDToValWorkflow(testElements, 'workflowcustomfields.workflowcustomfield.custworkflow1.scriptid')
    const buildElementsSource = (elements: readonly Element[]): ReadOnlyElementsSource =>
      buildMockElementsSource(buildElementsSourceFromElements(elements), idToVal)

    describe('Workflow custom field with a unique scriptid', () => {
      it('Should not have a change error when adding a new Workflow with a custom field that has unique scriptid', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElements.basic })],
          undefined,
          buildElementsSource([
            testElements.diffField,
            testElements.basic])
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when modifying a Workflow with uniwue custom fields', async () => {
        const changeErrors = await uniqueFields(
          [toChange(
            { before: testElements.basic,
              after: testElements.sameField }
          )],
          undefined,
          buildElementsSource([
            testElements.diffField,
            testElements.sameField])
        )
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('Workflow with a custom field that has a not-unique scriptid', () => {
      it('Should have a change error when adding a new Workflow with a custom field that has a not-unique scriptid', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElements.sameField })],
          undefined,
          buildElementsSource([
            testElements.basic,
            testElements.sameField])
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testElements.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })

      it('Should have a change error when modifying a custom field scriptid to an existing one', async () => {
        const changeErrors = await uniqueFields([
          toChange(
            { before: testElements.diffField,
              after: testElements.sameField }
          ),
        ], undefined,
        buildElementsSource([
          testElements.basic,
          testElements.sameField]))
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testElements.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })
    })
  })

  describe('Script custom field unique `scriptid` field validator', () => {
    const testElementsRestlet = getScriptRestletElements()
    const testElementsSuitelet = getScriptSuiteletElements()
    const idToValRestlet = getIDToValScript(testElementsRestlet, 'scriptcustomfields.scriptcustomfield.custscript1.scriptid')
    const idToValSuitelet = getIDToValScript(testElementsSuitelet, 'scriptcustomfields.scriptcustomfield.custscript1.scriptid')
    const idToEval = new Map([...idToValRestlet.entries(), ...idToValSuitelet.entries()])

    const buildElementsSource = (elements: readonly Element[]): ReadOnlyElementsSource =>
      buildMockElementsSource(buildElementsSourceFromElements(elements), idToEval)

    describe('Script custom field with a unique scriptid', () => {
      it('Should not have a change error when adding a new Script with a custom field that has unique scriptid', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElementsRestlet.basic })],
          undefined,
          buildElementsSource([
            testElementsRestlet.diffField,
            testElementsRestlet.basic])
        )
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when modifying a Script with unique custom fields', async () => {
        const changeErrors = await uniqueFields(
          [toChange(
            { before: testElementsRestlet.basic,
              after: testElementsRestlet.sameField }
          )],
          undefined,
          buildElementsSource([
            testElementsRestlet.diffField,
            testElementsRestlet.sameField])
        )
        expect(changeErrors).toHaveLength(0)
      })
      it('Should not have a change error when adding a new Script with a custom field that has unique scriptid with 2 different script types', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElementsRestlet.basic })],
          undefined,
          buildElementsSource([
            testElementsRestlet.diffField,
            testElementsSuitelet.basic])
        )
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('Script with a custom field that has a not-unique scriptid', () => {
      it('Should have a change error when adding a new Script with a custom field that has a not-unique scriptid', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElementsRestlet.sameField })],
          undefined,
          buildElementsSource([
            testElementsRestlet.basic,
            testElementsRestlet.sameField])
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testElementsRestlet.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })
      it('Should have a change error when adding a new Script with a custom field that has the same scriptid as another custom field in different script type', async () => {
        const changeErrors = await uniqueFields(
          [toChange({ after: testElementsRestlet.sameField })],
          undefined,
          buildElementsSource([
            testElementsRestlet.basic,
            testElementsSuitelet.sameField])
        )
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testElementsRestlet.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })
      it('Should have a change error when modifying a custom field scriptid to an existing one', async () => {
        const changeErrors = await uniqueFields([
          toChange(
            { before: testElementsRestlet.diffField,
              after: testElementsRestlet.sameField }
          ),
        ], undefined,
        buildElementsSource([
          testElementsRestlet.basic,
          testElementsRestlet.sameField]))
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toBe(testElementsRestlet.sameField.elemID)
        expect(changeErrors[0].detailedMessage).toContain(DUPLICATED_FIELD)
      })
    })
  })

  describe('Multiple types', () => {
    const savedSearchTestInstances = getSavedSearchElements()
    const financialLayoutTestInstances = getFinancialLayoutElements()
    const workflowTestInstances = getWorkflowElements()
    const scriptTestInstances = getScriptRestletElements()
    const customRecordTestObjects = getCustomRecordElements()
    const customRecordTestChanges = getCustomRecordChanges(customRecordTestObjects)

    const idToValSavedSearch = getIDToVal(savedSearchTestInstances, FIELD_DEFAULT_NAME)
    const idToValFinancialLayout = getIDToVal(financialLayoutTestInstances, NAME_FIELD)
    const idToValWorkflow = getIDToValWorkflow(workflowTestInstances, 'workflowcustomfields.workflowcustomfield.custworkflow1.scriptid')
    const idToValScript = getIDToValScript(scriptTestInstances, 'scriptcustomfields.scriptcustomfield.custscript1.scriptid')
    const idToVal = new Map([...idToValSavedSearch, ...idToValFinancialLayout, ...idToValWorkflow, ...idToValScript])

    const buildElementsSource = (elements: readonly Element[]): ReadOnlyElementsSource =>
      buildMockElementsSource(buildElementsSourceFromElements(elements), idToVal)

    describe('All types with a unique field', () => {
      it('Should not have a change error when adding a new type element with a unique field', async () => {
        const changeErrors = await uniqueFields([
          toChange({ after: savedSearchTestInstances.basic }),
          toChange({ after: financialLayoutTestInstances.basic }),
          toChange({ after: customRecordTestChanges.basic }),
          toChange({ after: workflowTestInstances.basic }),
          toChange({ after: scriptTestInstances.basic }),
        ], undefined, buildElementsSource(
          [
            savedSearchTestInstances.diffField, savedSearchTestInstances.basic,
            financialLayoutTestInstances.diffField, financialLayoutTestInstances.basic,
            customRecordTestObjects.diffField, customRecordTestObjects.basic,
            workflowTestInstances.diffField, workflowTestInstances.basic,
            scriptTestInstances.diffField, scriptTestInstances.basic,
          ]
        ))
        expect(changeErrors).toHaveLength(0)
      })

      it('Should not have a change error when modifying a type element with a unique field', async () => {
        const changeErrors = await uniqueFields([
          toChange({ before: savedSearchTestInstances.basic, after: savedSearchTestInstances.sameField }),
          toChange({ before: financialLayoutTestInstances.basic, after: financialLayoutTestInstances.sameField }),
          toChange({ before: customRecordTestChanges.basic, after: customRecordTestChanges.sameField }),
          toChange({ before: workflowTestInstances.basic, after: workflowTestInstances.sameField }),
          toChange({ before: scriptTestInstances.basic, after: scriptTestInstances.sameField }),
        ], undefined, buildElementsSource(
          [
            savedSearchTestInstances.diffField, savedSearchTestInstances.sameField,
            financialLayoutTestInstances.diffField, financialLayoutTestInstances.sameField,
            customRecordTestObjects.diffField, customRecordTestObjects.sameField,
            workflowTestInstances.diffField, workflowTestInstances.sameField,
            scriptTestInstances.diffField, scriptTestInstances.sameField,
          ]
        ))
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('All types with a duplicated field', () => {
      it('Should have a change error when adding a new type element with an existing unique field', async () => {
        const changeErrors = await uniqueFields([
          toChange({ after: savedSearchTestInstances.sameField }),
          toChange({ after: financialLayoutTestInstances.sameField }),
          toChange({ after: customRecordTestChanges.sameField }),
          toChange({ after: workflowTestInstances.sameField }),
          toChange({ after: scriptTestInstances.sameField }),
        ], undefined, buildElementsSource(
          [
            savedSearchTestInstances.basic, savedSearchTestInstances.sameField,
            financialLayoutTestInstances.basic, financialLayoutTestInstances.sameField,
            customRecordTestObjects.basic, customRecordTestObjects.sameField,
            workflowTestInstances.basic, workflowTestInstances.sameField,
            scriptTestInstances.basic, scriptTestInstances.sameField,
          ]
        ))
        expect(changeErrors).toHaveLength(5)
        expect(changeErrors.map(changeError => changeError.severity)).toEqual(['Error', 'Error', 'Error', 'Error', 'Error'])
        expect(changeErrors.map(changeError => changeError.elemID)).toEqual(expect.arrayContaining([
          savedSearchTestInstances.sameField.elemID,
          financialLayoutTestInstances.sameField.elemID,
          customRecordTestChanges.sameField.elemID,
          workflowTestInstances.sameField.elemID,
          scriptTestInstances.sameField.elemID,
        ]))
      })

      it('Should have a change error when modifying a type element`s unique field to an existing one', async () => {
        const changeErrors = await uniqueFields([
          toChange({ before: savedSearchTestInstances.diffField, after: savedSearchTestInstances.sameField }),
          toChange({ before: financialLayoutTestInstances.diffField, after: financialLayoutTestInstances.sameField }),
          toChange({ before: customRecordTestChanges.diffField, after: customRecordTestChanges.sameField }),
          toChange({ before: workflowTestInstances.diffField, after: workflowTestInstances.sameField }),
          toChange({ before: scriptTestInstances.diffField, after: scriptTestInstances.sameField }),
        ], undefined, buildElementsSource(
          [
            savedSearchTestInstances.basic, savedSearchTestInstances.sameField,
            financialLayoutTestInstances.basic, financialLayoutTestInstances.sameField,
            customRecordTestObjects.basic, customRecordTestObjects.sameField,
            workflowTestInstances.basic, workflowTestInstances.sameField,
            scriptTestInstances.basic, scriptTestInstances.sameField,
          ]
        ))
        expect(changeErrors).toHaveLength(5)
        expect(changeErrors.map(changeError => changeError.severity)).toEqual(['Error', 'Error', 'Error', 'Error', 'Error'])
        expect(changeErrors.map(changeError => changeError.elemID)).toEqual(expect.arrayContaining([
          savedSearchTestInstances.sameField.elemID,
          financialLayoutTestInstances.sameField.elemID,
          customRecordTestChanges.sameField.elemID,
          workflowTestInstances.sameField.elemID,
          scriptTestInstances.sameField.elemID,
        ]))
      })
    })
  })
})
