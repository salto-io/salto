import {
  Element, ObjectType, InstanceElement, PrimitiveType, ElemID, PrimitiveTypes, BuiltinTypes,
} from 'adapter-api'
import { WorkspaceError } from 'salto'
import { formatSearchResults, createPlanOutput, formatChange, formatDiscoverChangeForApproval, formatWorkspaceErrors } from '../src/formatter'
import { elements, plan, detailedChange } from './mocks'

describe('formatter', () => {
  describe('formatSearchResults', () => {
    const find = (name: string): Element =>
      elements().find(e => e.elemID.getFullName() === name) as Element

    it('should formatSearchResults for unknown element', async () => {
      expect(formatSearchResults(null)).toMatch('Unknown element type.')
    })

    it('should formatSearchResults when proper desc is provided', async () => {
      const output = formatSearchResults({
        key: 'salto_office',
        element: find('salto_office'),
        isGuess: false,
      })
      expect(output).toMatch('=== salto_office ===')
      expect(output).toMatch('Office Location')
      expect(output).toMatch('address')
    })

    it('should output proper value when proper desc is provided for list', async () => {
      const output = formatSearchResults({
        key: 'salto_employee.nicknames',
        element: (find('salto_employee') as ObjectType).fields.nicknames.type,
        isGuess: false,
      })
      expect(output).toMatch('=== string ===')
    })

    it('should output proper value when proper desc is provided for inner fields', async () => {
      const output = formatSearchResults({
        key: 'salto_office.location',
        element: (find('salto_office') as ObjectType).fields.location.type,
        isGuess: false,
      })
      expect(output).toMatch('=== salto_address ===')
    })

    it('should suggest proper value when proper desc is provided start path', async () => {
      const output = formatSearchResults({
        key: 'salto_office.location.city',
        element: ((find('salto_office') as ObjectType).fields.location.type as ObjectType)
          .fields.city.type,
        isGuess: true,
      })
      expect(output).toMatch('Could not find what you were looking for.')
      expect(output).toMatch('salto_office.location.city')
    })
  })

  describe('createPlanOutput', () => {
    const output = createPlanOutput(plan())
    it('should return type field addition', () => {
      expect(output).toMatch(/|[^\n]+salesforce_lead.*\+[^\n]+do_you_have_a_sales_team/s)
    })
    it('should return type field removal', () => {
      expect(output).toMatch(/|[^\n]+salesforce_lead.*-[^\n]+status/s)
    })
    it('should have titles for all level of nested modifications', () => {
      expect(output).toMatch(/|[^\n]+salesforce_lead.*|[^\n]+how_many_sales_people.*M[^\n]+label/s)
    })
  })

  describe('formatChange', () => {
    const allElements = elements()
    const instance = allElements[4] as InstanceElement
    const objectType = allElements[2] as ObjectType

    describe('with instance value', () => {
      const instanceChange = detailedChange('add', instance.elemID.nameParts, undefined, instance)
      const output = formatChange(instanceChange)
      it('should have element id', () => {
        expect(output).toMatch(/\+.*salesforce_employee_instance/)
      })
      it('should have nested values', () => {
        expect(output).toMatch(/salesforce_employee_instance.*office.*label: "bla"/s)
      })
    })
    describe('with primitive type', () => {
      const dummyType = new PrimitiveType({
        elemID: new ElemID('salesforce', 'text'),
        primitive: PrimitiveTypes.STRING,
        annotations: { bla: 'foo' },
        annotationTypes: { bla: BuiltinTypes.STRING },
      })
      const typeChange = detailedChange('remove', dummyType.elemID.nameParts, dummyType, undefined)
      const output = formatChange(typeChange)
      it('should have element id', () => {
        expect(output).toMatch(/-.*salesforce_text/)
      })
      it('should have type', () => {
        expect(output).toMatch(/-.*salesforce_text.*TYPE: string/s)
      })
      it('should have annotations', () => {
        expect(output).toMatch(/-.*salesforce_text.*bla:/s)
      })
      it('should have annotation types', () => {
        expect(output).toMatch(/-.*salesforce_text.*annotations.*bla/s)
      })
    })
    describe('with object type', () => {
      const objTypeChange = detailedChange('add', objectType.elemID.nameParts, undefined, objectType)
      const output = formatChange(objTypeChange)
      it('should have element id', () => {
        expect(output).toMatch(/\+.*salesforce_office/)
      })
      it('should have annotations', () => {
        expect(output).toMatch(/\+.*salesforce_office.*description: "Office type in salto"/s)
      })
      it('should have fields', () => {
        expect(output).toMatch(/\+.*salesforce_office.*fields.*name/s)
        expect(output).toMatch(/\+.*salesforce_office.*fields.*name.*TYPE: string/s)
        expect(output).toMatch(/\+.*salesforce_office.*fields.*location/s)
        expect(output).toMatch(/\+.*salesforce_office.*fields.*location.*TYPE: salto_address/s)
        expect(output).toMatch(/\+.*salesforce_office.*fields.*location.*label/s)
      })
      it('should have annotation types', () => {
        expect(output).toMatch(/\+.*salesforce_office.*annotations.*label.*TYPE: string/s)
      })
    })
  })
  describe('formatDiscoverChangeForApproval', () => {
    const change = detailedChange('add', ['adapter', 'object', 'field', 'value'], undefined, 'asd')
    const output = formatDiscoverChangeForApproval(change, 0, 3)
    it('should contain change path', () => {
      expect(output).toMatch(/adapter.*object.*field.*value/s)
    })
    it('should contain change index and total changes, with index 1 based', () => {
      expect(output).toContain('Change 1 of 3')
    })
  })

  describe('workspace error format', () => {
    const workspaceErrorWithSourceFragments: WorkspaceError = {
      sourceFragments: [{
        sourceRange: {
          start: {
            byte: 20,
            col: 10,
            line: 2,
          },
          end: {
            byte: 30,
            col: 10,
            line: 3,
          },
          filename: 'test.bp',
        },
        fragment: '{ This is my code fragment }',

      }],
      error: 'This is my error',
      severity: 'Error',
    }
    let formattedErrors: string
    beforeEach(() => {
      formattedErrors = formatWorkspaceErrors([workspaceErrorWithSourceFragments])
    })
    it('should print the start line', () => {
      expect(formattedErrors).toContain('2')
    })
    it('should print the start col', () => {
      expect(formattedErrors).toContain('10')
    })
    it('should print the error', () => {
      expect(formattedErrors).toContain('This is my error')
    })
    it('should print the code fragment', () => {
      expect(formattedErrors).toContain('{ This is my code fragment }')
    })
  })
})
