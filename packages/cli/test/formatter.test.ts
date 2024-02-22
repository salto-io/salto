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
  ObjectType,
  InstanceElement,
  ElemID,
  ChangeError,
  SaltoError,
  PrimitiveType,
  PrimitiveTypes,
  BuiltinTypes,
  StaticFile,
  ListType,
} from '@salto-io/adapter-api'
import { EOL } from 'os'
import { DeployError, FetchChange } from '@salto-io/core'
import { errors as wsErrors } from '@salto-io/workspace'
import chalk from 'chalk'
import {
  formatExecutionPlan,
  formatChange,
  formatFetchChangeForApproval,
  formatWorkspaceError,
  formatChangeErrors,
  formatConfigChangeNeeded,
  formatShouldChangeFetchModeToAlign,
  deployErrorsOutput,
} from '../src/formatter'
import { elements, preview, detailedChange } from './mocks'
import Prompts from '../src/prompts'

describe('formatter', () => {
  const workspaceErrorWithSourceLocations: wsErrors.WorkspaceError<SaltoError> = {
    sourceLocations: [
      {
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
      },
      {
        sourceRange: {
          start: { byte: 100, col: 10, line: 10 },
          end: { byte: 150, col: 10, line: 15 },
          filename: 'test.nacl',
        },
      },
    ],
    message: 'This is my error',
    severity: 'Error',
  }
  const workspaceErrorWithoutSourceFragments: wsErrors.WorkspaceError<SaltoError> = {
    message: 'This is my error',
    sourceLocations: [],
    severity: 'Error',
  }
  const workspaceErrorWithPreDeployAction: ChangeError = {
    elemID: new ElemID('salesforce', 'TestType'),
    message: 'This is my error',
    detailedMessage: 'This is my detailed message',
    severity: 'Info',
    deployActions: {
      preAction: {
        title: 'This is my title',
        subActions: ['first subtext', 'second subtext'],
      },
    },
  }
  const workspaceErrorWithInfoSeverity: ChangeError = {
    elemID: new ElemID('salesforce', 'TestType'),
    message: 'my Info message',
    detailedMessage: '',
    severity: 'Info',
  }
  const workspaceDeployProblems: DeployError[] = [
    {
      elemID: new ElemID('salesforce', 'TestType1'),
      message: 'my error message 1',
      severity: 'Error',
      groupId: 'test group',
    },
    {
      elemID: new ElemID('salesforce', 'TestType2'),
      message: 'my error message 2',
      severity: 'Error',
      groupId: 'test group',
    },
    {
      elemID: new ElemID('salesforce', 'TestType3'),
      message: 'my warning message',
      severity: 'Warning',
      groupId: 'test group',
    },
    {
      elemID: new ElemID('salesforce', 'TestType4'),
      message: 'my info message',
      severity: 'Info',
      groupId: 'test group',
    },
  ]

  describe('createPlanOutput', () => {
    const plan = preview()
    const changeErrors = [...plan.changeErrors, workspaceErrorWithPreDeployAction, workspaceErrorWithInfoSeverity]
    let output: string
    beforeAll(async () => {
      output = await formatExecutionPlan(
        plan,
        changeErrors.map(ce => ({
          ...ce,
          sourceLocations: workspaceErrorWithSourceLocations.sourceLocations,
        })),
      )
    })

    it('should return type field addition', () => {
      expect(output).toMatch(/|[^\n]+salesforce.lead.*\+[^\n]+do_you_have_a_sales_team/s)
    })
    it('should return type field removal', () => {
      expect(output).toMatch(/|[^\n]+salesforce.lead.*-[^\n]+status/s)
    })
    it('should have titles for all level of nested modifications', () => {
      expect(output).toMatch(/|[^\n]+salesforce.lead.*|[^\n]+how_many_sales_people.*M[^\n]+label/s)
    })
    it('should return the number of impacted types and instances', () => {
      expect(output).toMatch(`${chalk.bold('Impacts:')} 7 types and 1 instance.`)
    })
    it('should return pre deploy action suggestions', () => {
      expect(output).toMatch(`${chalk.bold(Prompts.DEPLOY_PRE_ACTION_HEADER)}`)
      expect(output).toMatch(`${chalk.bold('This is my title')}`)
      expect(output).toMatch(/description.*first subtext.*second subtext.*someURL/s)
    })
    it('should not print pre deploy actions when there are none', async () => {
      const outputWithNoDeployActions = await formatExecutionPlan(
        plan,
        [workspaceErrorWithInfoSeverity].map(ce => ({
          ...ce,
          sourceLocations: workspaceErrorWithSourceLocations.sourceLocations,
        })),
      )
      expect(outputWithNoDeployActions).not.toMatch(`${chalk.bold(Prompts.DEPLOY_PRE_ACTION_HEADER)}`)
    })
  })

  describe('formatPlanValidations', () => {
    const groupedChangeErrors: ReadonlyArray<wsErrors.WorkspaceError<ChangeError>> = [
      {
        elemID: new ElemID('salesforce', 'test1'),
        severity: 'Error',
        message: 'Message key for test',
        detailedMessage: 'Validation message 1',
        sourceLocations: workspaceErrorWithSourceLocations.sourceLocations,
      },
      {
        elemID: new ElemID('salesforce', 'test2'),
        severity: 'Error',
        message: 'Message key for test',
        detailedMessage: 'Validation message 2',
        sourceLocations: workspaceErrorWithSourceLocations.sourceLocations,
      },
    ]
    it('should be empty when there are no validations', async () => {
      const output = formatChangeErrors([])
      expect(output).toEqual('')
    })
    it('should have single validation', () => {
      const changeErrors: ReadonlyArray<wsErrors.WorkspaceError<ChangeError>> = [
        {
          elemID: new ElemID('salesforce', 'test'),
          severity: 'Error',
          message: 'Message key for test',
          detailedMessage: 'Validation message',
          sourceLocations: workspaceErrorWithSourceLocations.sourceLocations,
        },
      ]
      const output = formatChangeErrors(changeErrors)
      expect(output).toContain('Error')
      expect(output).toMatch(new RegExp(`.*${changeErrors[0].detailedMessage}`, 's'))
      expect(output).toMatch(
        new RegExp(`.*${workspaceErrorWithSourceLocations.sourceLocations[0].sourceRange.filename}`, 's'),
      )
    })
    it('should have grouped validations', () => {
      const output = formatChangeErrors(groupedChangeErrors)
      let expectedMessage = `    ${groupedChangeErrors[0].severity}: ${chalk.bold(groupedChangeErrors[0].message)} in the following elements:`
      expectedMessage += `${EOL}      ${groupedChangeErrors[0].elemID.getFullName()}${EOL}      ${groupedChangeErrors[1].elemID.getFullName()}`
      expect(output).toMatch(expectedMessage)
    })
    it('should display detailed message in detailed mode for grouped validations', () => {
      const output = formatChangeErrors(groupedChangeErrors, true)
      let expectedMessage = `    ${groupedChangeErrors[0].severity}: ${chalk.bold(groupedChangeErrors[0].message)} in the following elements:`
      expectedMessage += `${EOL}      ${groupedChangeErrors[0].elemID.getFullName()}${EOL}        ${chalk.dim(groupedChangeErrors[0].detailedMessage)}`
      expectedMessage += `${EOL}      ${groupedChangeErrors[1].elemID.getFullName()}${EOL}        ${chalk.dim(groupedChangeErrors[1].detailedMessage)}`
      expect(output).toMatch(expectedMessage)
    })
    it('should contain EOL between title and content', () => {
      const changeErrors: ReadonlyArray<wsErrors.WorkspaceError<ChangeError>> = [
        {
          elemID: new ElemID('salesforce', 'test'),
          severity: 'Error',
          message: 'Message key for test',
          detailedMessage: 'Validation message',
          sourceLocations: [],
        },
      ]
      const output = formatChangeErrors(changeErrors)
      expect(output).toMatch(new RegExp(`${EOL} *Error`)) // "Error" is not proceeded by EOL with indentation
    })
    it('should not contain double EOL in change error with several locations', () => {
      const changeErrorWithLocations: ReadonlyArray<wsErrors.WorkspaceError<ChangeError>> = [
        {
          sourceLocations: [
            {
              sourceRange: {
                start: { byte: 20, col: 10, line: 5 },
                end: { byte: 30, col: 10, line: 3 },
                filename: 'test.nacl',
              },
            },
            {
              sourceRange: {
                start: { byte: 100, col: 10, line: 15 },
                end: { byte: 150, col: 10, line: 15 },
                filename: 'test.nacl',
              },
            },
            {
              sourceRange: {
                start: { byte: 100, col: 10, line: 25 },
                end: { byte: 150, col: 10, line: 15 },
                filename: 'test2.nacl',
              },
            },
          ],
          message: 'Operation not supported',
          detailedMessage: 'Salto does not support "remove" of zendesk...',
          severity: 'Error',
          elemID: new ElemID('salesforce', 'test'),
        },
      ]
      const output = formatChangeErrors(changeErrorWithLocations)
      expect(output).not.toMatch(new RegExp(`${EOL} *${EOL}`)) // does not contain two EOL with only indent between them
    })
    it('should contain space between title and content', () => {
      const changeErrors: ReadonlyArray<wsErrors.WorkspaceError<ChangeError>> = [
        {
          elemID: new ElemID('salesforce', 'test'),
          severity: 'Error',
          message: 'Message key for test',
          detailedMessage: 'Validation message',
          sourceLocations: [],
        },
      ]
      const output = formatChangeErrors(changeErrors)
      expect(output).toContain(' Error')
    })
    it('should order validations from most to least occurrences', () => {
      const differentValidationKey: wsErrors.WorkspaceError<ChangeError> = {
        elemID: new ElemID('salesforce', 'test3'),
        severity: 'Error',
        message: 'Different message key',
        detailedMessage: 'Validation message 3',
        sourceLocations: workspaceErrorWithSourceLocations.sourceLocations,
      }
      const changeErrors: ReadonlyArray<wsErrors.WorkspaceError<ChangeError>> = [
        {
          elemID: new ElemID('salesforce', 'test'),
          severity: 'Error',
          message: 'Message key for test',
          detailedMessage: 'Validation message',
          sourceLocations: workspaceErrorWithSourceLocations.sourceLocations,
        },
        {
          elemID: new ElemID('salesforce', 'test2'),
          severity: 'Error',
          message: 'Message key for test',
          detailedMessage: 'Validation message 2',
          sourceLocations: workspaceErrorWithSourceLocations.sourceLocations,
        },
        differentValidationKey,
      ]
      const output = formatChangeErrors(changeErrors)
      expect(output).toContain('Error')
      expect(output).toMatch(
        new RegExp(`.*${changeErrors[0].message}.*${EOL}.*${differentValidationKey.detailedMessage}`, 's'),
      )
    })
  })

  describe('formatChange', () => {
    const allElements = elements()
    const instance = allElements[4] as InstanceElement
    const objectType = allElements[2] as ObjectType
    let output: string

    describe('without value', () => {
      describe('with top level element', () => {
        beforeAll(async () => {
          const instanceChange = detailedChange('add', instance.elemID, undefined, instance)
          output = await formatChange(instanceChange)
        })
        it('should have element id', () => {
          expect(output).toContain(Prompts.MODIFIERS.add)
          expect(output).toContain(instance.elemID.name)
        })
      })

      describe('with nested element', () => {
        const changedField = objectType.fields.name
        beforeAll(async () => {
          const fieldChange = detailedChange('add', changedField.elemID, undefined, changedField)
          output = await formatChange(fieldChange)
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
        beforeAll(async () => {
          const valueChange = detailedChange('add', changedValueId, undefined, 'bla')
          output = await formatChange(valueChange)
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
        beforeAll(async () => {
          const dummyChange = detailedChange('modify', objectType.elemID, undefined, undefined)
          output = await formatChange(dummyChange)
        })
        it('should contain the dummy change ID as a header', () => {
          expect(output).toContain(Prompts.MODIFIERS.eq)
          expect(output).toContain(objectType.elemID.getFullName())
        })
      })
    })
    describe('with value', () => {
      describe('with instance value', () => {
        beforeAll(async () => {
          const instanceChange = detailedChange('add', instance.elemID, undefined, instance)
          output = await formatChange(instanceChange, true)
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
          annotationRefsOrTypes: { bla: BuiltinTypes.STRING },
        })
        beforeAll(async () => {
          const typeChange = detailedChange('add', dummyType.elemID, undefined, dummyType)
          output = await formatChange(typeChange, true)
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
        beforeAll(async () => {
          const objTypeChange = detailedChange('add', objectType.elemID, undefined, objectType)
          output = await formatChange(objTypeChange, true)
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
      describe('with static file value', () => {
        it('should not print the buffer', async () => {
          const staticFileBefore = new StaticFile({
            content: Buffer.from('FAFAFAFAFAFAFAFAFAFA'),
            filepath: 'road/to/nowhere',
            hash: 'asdasdasdasd',
          })
          const staticFileAfter = new StaticFile({
            content: Buffer.from('far better'),
            filepath: 'road/to/nowhere',
            hash: 'asdasdasdasd',
          })
          const fileChange = detailedChange(
            'modify',
            instance.elemID.createNestedID('content'),
            staticFileBefore,
            staticFileAfter,
          )
          output = await formatChange(fileChange, true)
          expect(output).toMatch('content')
          expect(output).not.toMatch('Buffer')
        })
      })
      describe('removal change', () => {
        beforeAll(async () => {
          const instanceChange = detailedChange('remove', instance.elemID, instance, undefined)
          output = await formatChange(instanceChange, true)
        })
        it('should have element id', () => {
          expect(output).toContain(instance.elemID.name)
        })
        it('should not have nested values', () => {
          expect(output).not.toContain('bla')
        })
      })
      describe('with array of objects', () => {
        const formatedObjectsExpectedResults = `[
          {
            name: "sal"
            nicknames: ["o","s","s"]
          },
          {
            name: "to"
            nicknames: ["s","a","a","s"]
            office: 
                {
                  label: "a"
                  name: "b"
                }
          }]`
        beforeAll(async () => {
          const saltoEmployee = allElements[3] as ObjectType
          const objectFormatTesting = new ObjectType({
            elemID: new ElemID('salto', 'test1'),
            fields: {
              country: { refType: new ListType(saltoEmployee) },
            },
          })
          const instanceAfter = new InstanceElement('myinstance', objectFormatTesting, {
            country: [
              {
                name: 'sal',
                nicknames: ['o', 's', 's'],
              },
              {
                name: 'to',
                nicknames: ['s', 'a', 'a', 's'],
                office: {
                  label: 'a',
                  name: 'b',
                },
              },
            ],
          })
          const instanceChange = detailedChange('add', instanceAfter.elemID, undefined, instanceAfter)
          output = await formatChange(instanceChange, true)
        })
        it('should match expected value', () => {
          expect(output).toContain(formatedObjectsExpectedResults)
        })
      })
    })
  })
  describe('formatFetchChangeForApproval', () => {
    const change = detailedChange('modify', ['object', 'field', 'value'], 'old', 'new')
    describe('without conflict', () => {
      const changeWithoutConflict = { change, serviceChanges: [change] }
      let output: string
      beforeAll(async () => {
        output = await formatFetchChangeForApproval(changeWithoutConflict, 0, 3)
      })
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
        serviceChanges: [change],
        pendingChanges: [detailedChange('modify', ['object', 'field', 'value'], 'old', 'local')],
      }
      let output: string
      beforeAll(async () => {
        output = await formatFetchChangeForApproval(fetchChange, 2, 3)
      })
      it('should contain change path', () => {
        expect(output).toMatch(/salesforce.*object.*value/s)
      })
      it('should contain change index and total changes, with index 1 based', () => {
        expect(output).toContain('Change 3 of 3')
      })
      it('should contain the local change', () => {
        expect(output).toMatch(/.*old.*=>.*local/)
      })
      it('should contain the account change', () => {
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

  describe('formatShouldChangeFetchModeToAlign', () => {
    let formattedString: string
    const fetchMode = 'override'
    beforeAll(() => {
      formattedString = formatShouldChangeFetchModeToAlign(fetchMode)
    })

    it('should contain the fetch modes', () => {
      expect(formattedString).toContain(fetchMode)
      expect(formattedString).toContain('align')
    })
  })
  describe('workspace error format with source fragments', () => {
    let formattedErrors: string
    beforeEach(() => {
      formattedErrors = formatWorkspaceError(workspaceErrorWithSourceLocations)
    })
    it('should print the start line', () => {
      expect(formattedErrors).toContain('2')
    })
    it('should print the error', () => {
      expect(formattedErrors).toContain('This is my error')
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

  describe('deployErrorsOutput', () => {
    let formattedErrors: string
    beforeEach(() => {
      formattedErrors = deployErrorsOutput(workspaceDeployProblems)
    })
    it('should have both error messages', () => {
      expect(formattedErrors).toContain('my error message 1')
      expect(formattedErrors).toContain('my error message 2')
      expect(formattedErrors).toContain('my warning message')
      expect(formattedErrors).toContain('my info message')
    })
    it('should contain element ID for salto element errors', () => {
      expect(formattedErrors).toContain('salesforce.TestType1')
      expect(formattedErrors).toContain('salesforce.TestType2')
      expect(formattedErrors).toContain('salesforce.TestType3')
      expect(formattedErrors).toContain('salesforce.TestType4')
    })
  })
})
