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
import {
  ObjectType, InstanceElement, ElemID, ChangeError, SaltoError, PrimitiveType,
  PrimitiveTypes, BuiltinTypes,
} from '@salto-io/adapter-api'
import { WorkspaceError, FetchChange } from '@salto-io/core'
import { formatExecutionPlan, formatChange,
  formatFetchChangeForApproval, formatWorkspaceError,
  formatChangeErrors, formatConfigChangeNeeded } from '../src/formatter'
import { elements, preview, detailedChange } from './mocks'
import Prompts from '../src/prompts'

describe('formatter', () => {
  const workspaceErrorWithSourceFragments: WorkspaceError<SaltoError> = {
    sourceFragments: [{
      sourceRange: {
        start: { byte: 20, col: 10, line: 2 },
        end: { byte: 30, col: 10, line: 3 },
        filename: 'test.nacl',
      },
      subRange: {
        start: { line: 2, col: 3, byte: 30 },
        end: { line: 2, col: 4, byte: 31 },
        filename: 'test.nacl',
      },
      fragment: '{ This is my first code fragment }',
    },
    {
      sourceRange: {
        start: { byte: 100, col: 10, line: 10 },
        end: { byte: 150, col: 10, line: 15 },
        filename: 'test.nacl',
      },
      fragment: '{ This is my second code fragment }',
    }],
    message: 'This is my error',
    severity: 'Error',
  }
  const workspaceErrorWithoutSourceFragments: WorkspaceError<SaltoError> = {
    message: 'This is my error',
    sourceFragments: [],
    severity: 'Error',
  }

  describe('createPlanOutput', () => {
    const plan = preview()
    const output = formatExecutionPlan(plan, plan.changeErrors.map(ce => ({
      ...ce,
      sourceFragments: workspaceErrorWithSourceFragments.sourceFragments,
    })))

    it('should return type field addition', () => {
      expect(output).toMatch(/|[^\n]+salesforce.lead.*\+[^\n]+do_you_have_a_sales_team/s)
    })
    it('should return type field removal', () => {
      expect(output).toMatch(/|[^\n]+salesforce.lead.*-[^\n]+status/s)
    })
    it('should have titles for all level of nested modifications', () => {
      expect(output).toMatch(/|[^\n]+salesforce.lead.*|[^\n]+how_many_sales_people.*M[^\n]+label/s)
    })
  })

  describe('formatPlanValidations', () => {
    it('should be empty when there are no validations', async () => {
      const output = formatChangeErrors([],)
      expect(output).toEqual('')
    })
    it('should have single validation', () => {
      const changeErrors: ReadonlyArray<WorkspaceError<ChangeError>> = [{
        elemID: new ElemID('salesforce', 'test'),
        severity: 'Error',
        message: 'Message key for test',
        detailedMessage: 'Validation message',
        sourceFragments: workspaceErrorWithSourceFragments.sourceFragments,
      }]
      const output = formatChangeErrors(changeErrors)
      expect(output)
        .toContain('Error')
      expect(output)
        .toMatch(new RegExp(`.*${changeErrors[0].detailedMessage}`, 's'))
      expect(output).toMatch(new RegExp(`.*${workspaceErrorWithSourceFragments.sourceFragments[0].sourceRange.filename}`, 's'))
    })
    it('should have grouped validations', () => {
      const changeErrors: ReadonlyArray<WorkspaceError<ChangeError>> = [{
        elemID: new ElemID('salesforce', 'test'),
        severity: 'Error',
        message: 'Message key for test',
        detailedMessage: 'Validation message',
        sourceFragments: workspaceErrorWithSourceFragments.sourceFragments,

      },
      {
        elemID: new ElemID('salesforce', 'test2'),
        severity: 'Error',
        message: 'Message key for test',
        detailedMessage: 'Validation message 2',
        sourceFragments: workspaceErrorWithSourceFragments.sourceFragments,

      }]
      const output = formatChangeErrors(changeErrors)
      expect(output)
        .toContain('Error')
      expect(output)
        .toMatch(new RegExp(`.*${changeErrors[0].message}.*2 Elements`, 's'))
    })
    it('should order validations from most to least occurrences', () => {
      const differentValidationKey: WorkspaceError<ChangeError> = {
        elemID: new ElemID('salesforce', 'test3'),
        severity: 'Error',
        message: 'Different message key',
        detailedMessage: 'Validation message 3',
        sourceFragments: workspaceErrorWithSourceFragments.sourceFragments,
      }
      const changeErrors: ReadonlyArray<WorkspaceError<ChangeError>> = [{
        elemID: new ElemID('salesforce', 'test'),
        severity: 'Error',
        message: 'Message key for test',
        detailedMessage: 'Validation message',
        sourceFragments: workspaceErrorWithSourceFragments.sourceFragments,

      },
      {
        elemID: new ElemID('salesforce', 'test2'),
        severity: 'Error',
        message: 'Message key for test',
        detailedMessage: 'Validation message 2',
        sourceFragments: workspaceErrorWithSourceFragments.sourceFragments,

      },
      differentValidationKey]
      const output = formatChangeErrors(changeErrors)
      expect(output)
        .toContain('Error')
      expect(output)
        .toMatch(new RegExp(`.*${changeErrors[0].message}.*2 Elements.*\n.*${differentValidationKey.detailedMessage}`, 's'))
    })
  })

  describe('formatChange', () => {
    const allElements = elements()
    const instance = allElements[4] as InstanceElement
    const objectType = allElements[2] as ObjectType
    let output: string

    describe('without value', () => {
      describe('with top level element', () => {
        beforeAll(() => {
          const instanceChange = detailedChange('add', instance.elemID, undefined, instance)
          output = formatChange(instanceChange)
        })
        it('should have element id', () => {
          expect(output).toContain(Prompts.MODIFIERS.add)
          expect(output).toContain(instance.elemID.name)
        })
      })

      describe('with nested element', () => {
        const changedField = objectType.fields.name
        beforeAll(() => {
          const fieldChange = detailedChange('add', changedField.elemID, undefined, changedField)
          output = formatChange(fieldChange)
        })
        it('should not contain the full id', () => {
          expect(output).not.toContain(changedField.elemID.getFullName())
        })
        it('should contain element name', () => {
          expect(output).toContain(Prompts.MODIFIERS.add)
          expect(output).toContain(changedField.name)
        })
      })

      describe('with nested value', () => {
        const changedValueId = instance.elemID.createNestedID('nested', 'value')
        beforeAll(() => {
          const valueChange = detailedChange('add', changedValueId, undefined, 'bla')
          output = formatChange(valueChange)
        })
        it('should not contain the full id', () => {
          expect(output).not.toContain(changedValueId.getFullName())
        })
        it('should contain last part of value path', () => {
          expect(output).toContain(Prompts.MODIFIERS.add)
          expect(output).toContain(changedValueId.name)
        })
      })

      describe('with dummy change', () => {
        beforeAll(() => {
          const dummyChange = detailedChange('modify', objectType.elemID, undefined, undefined)
          output = formatChange(dummyChange)
        })
        it('should contain the dummy change ID as a header', () => {
          expect(output).toContain(Prompts.MODIFIERS.eq)
          expect(output).toContain(objectType.elemID.getFullName())
        })
      })
    })
    describe('with value', () => {
      describe('with instance value', () => {
        beforeAll(() => {
          const instanceChange = detailedChange('add', instance.elemID, undefined, instance)
          output = formatChange(instanceChange, true)
        })
        it('should have element id', () => {
          expect(output).toContain(instance.elemID.name)
        })
        it('should have nested values', () => {
          expect(output).toMatch(new RegExp(`${instance.elemID.name}.*office.*label: "bla"`, 's'))
        })
      })
      describe('with primitive type', () => {
        const dummyType = new PrimitiveType({
          elemID: new ElemID('salesforce', 'text'),
          primitive: PrimitiveTypes.STRING,
          annotations: { bla: 'foo' },
          annotationTypes: { bla: BuiltinTypes.STRING },
        })
        beforeAll(() => {
          const typeChange = detailedChange('add', dummyType.elemID, undefined, dummyType)
          output = formatChange(typeChange, true)
        })
        it('should have element id', () => {
          expect(output).toContain(dummyType.elemID.name)
        })
        it('should have type', () => {
          expect(output).toMatch(new RegExp(`${dummyType.elemID.name}.*TYPE: string`, 's'))
        })
        it('should have annotations', () => {
          expect(output).toMatch(new RegExp(`${dummyType.elemID.name}.*bla`, 's'))
        })
        it('should have annotation types', () => {
          expect(output).toMatch(new RegExp(`${dummyType.elemID.name}.*annotations.*bla`, 's'))
        })
      })
      describe('with object type', () => {
        beforeAll(() => {
          const objTypeChange = detailedChange('add', objectType.elemID, undefined, objectType)
          output = formatChange(objTypeChange, true)
        })
        it('should have element id', () => {
          expect(output).toContain(objectType.elemID.name)
        })
        it('should have annotations', () => {
          expect(output).toMatch(new RegExp(`${objectType.elemID.name}.*description: "Office type in salto"`, 's'))
        })
        it('should have fields', () => {
          expect(output).toMatch(new RegExp(`${objectType.elemID.name}.*fields.*name`, 's'))
          expect(output).toMatch(new RegExp(`${objectType.elemID.name}.*fields.*name.*TYPE: string`, 's'))
          expect(output).toMatch(new RegExp(`${objectType.elemID.name}.*fields.*location`, 's'))
          expect(output).toMatch(new RegExp(`${objectType.elemID.name}.*fields.*location.*TYPE: salto.address`, 's'))
          expect(output).toMatch(new RegExp(`${objectType.elemID.name}.*fields.*location.*label`, 's'))
        })
        it('should have annotation types', () => {
          expect(output).toMatch(new RegExp(`${objectType.elemID.name}.*annotations.*label.*TYPE: string`, 's'))
        })
      })
      describe('removal change', () => {
        beforeAll(() => {
          const instanceChange = detailedChange('remove', instance.elemID, instance, undefined)
          output = formatChange(instanceChange, true)
        })
        it('should have element id', () => {
          expect(output).toContain(instance.elemID.name)
        })
        it('should not have nested values', () => {
          expect(output).not.toContain('bla')
        })
      })
    })
  })
  describe('formatFetchChangeForApproval', () => {
    const change = detailedChange('modify', ['object', 'field', 'value'], 'old', 'new')
    describe('without conflict', () => {
      const changeWithoutConflict = { change, serviceChange: change }
      const output = formatFetchChangeForApproval(changeWithoutConflict, 0, 3)
      it('should contain change path', () => {
        expect(output).toMatch(/salesforce.*object.*value/s)
      })
      it('should contain change index and total changes, with index 1 based', () => {
        expect(output).toContain('Change 1 of 3')
      })
    })
    describe('with conflict', () => {
      const fetchChange: FetchChange = {
        change: detailedChange('modify', ['object', 'field', 'value'], 'local', 'new'),
        serviceChange: change,
        pendingChange: detailedChange('modify', ['object', 'field', 'value'], 'old', 'local'),
      }
      const output = formatFetchChangeForApproval(fetchChange, 2, 3)
      it('should contain change path', () => {
        expect(output).toMatch(/salesforce.*object.*value/s)
      })
      it('should contain change index and total changes, with index 1 based', () => {
        expect(output).toContain('Change 3 of 3')
      })
      it('should contain the local change', () => {
        expect(output).toMatch(/.*old.*=>.*local/)
      })
      it('should contain the service change', () => {
        expect(output).toMatch(/.*old.*=>.*new/)
      })
    })
  })
  describe('formatConfigChangeNeeded', () => {
    let formattedString: string
    const introMessage = 'intro'
    const formattedChange = 'test'

    beforeAll(() => {
      formattedString = formatConfigChangeNeeded(introMessage, formattedChange)
    })

    it('should print adapter name', () => {
      expect(formattedString).toContain(introMessage)
    })

    it('should print formatted changes', () => {
      expect(formattedString).toContain(formattedChange)
    })
  })

  describe('workspace error format with source fragments', () => {
    let formattedErrors: string
    beforeEach(() => {
      formattedErrors = formatWorkspaceError(workspaceErrorWithSourceFragments)
    })
    it('should print the start line', () => {
      expect(formattedErrors).toContain('2')
    })
    it('should print the error', () => {
      expect(formattedErrors).toContain('This is my error')
    })
    it('should print the first code fragment', () => {
      expect(formattedErrors).toContain('first code') // The formatted error is chalked.
    })
    it('should print the second code fragment', () => {
      expect(formattedErrors).toContain('{ This is my second code fragment }')
    })
  })
  describe('workspace error format without source fragments', () => {
    let formattedErrors: string
    beforeEach(() => {
      formattedErrors = formatWorkspaceError(workspaceErrorWithoutSourceFragments)
    })
    it('should print the error', () => {
      expect(formattedErrors).toContain('This is my error')
    })
  })
})
