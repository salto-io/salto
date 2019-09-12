import { Element, ObjectType } from 'adapter-api'
import { formatSearchResults, createPlanOutput } from '../../src/cli/formatter'
import * as coreMock from '../core/mocks/core'

describe('formmatter', () => {
  describe('formatSearchResults', () => {
    let elements: Element[]
    beforeAll(async () => {
      elements = await coreMock.getAllElements()
    })

    const find = (name: string): Element =>
      elements.find(e => e.elemID.getFullName() === name) as Element

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
    it('should pp suggest proper value when proper desc is provided start path', async () => {
      const plan = await coreMock.plan([])
      const output = createPlanOutput(plan)

      // Validate we printed all fields changes
      expect(output.search('salesforce_account_status')).toBeGreaterThan(0)
      expect(output.search('salesforce_account_name')).toBeGreaterThan(0)
      expect(output.search('salesforce_lead_do_you_have_a_sales_team')).toBeGreaterThan(0)
      expect(output.search('salesforce_lead_status')).toBeGreaterThan(0)
    })
  })
})
