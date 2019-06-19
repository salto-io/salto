import SalesforceAdapter from '../src/adapter'

// This is turned off by default as it has SFDC rate limit implications
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('Test Discover E2E', () => {
  it('should discover sobject e2e with real account', async () => {
    // set long timeout as we communicate with salesforce API
    jest.setTimeout(300000)
    const adapter = new SalesforceAdapter({
      username: 'vanila@salto.io',
      password: '!A123456',
      token: 'rwVvOsh7HjF8Zki9ZmyQdeth',
      sandbox: false
    })
    const result = await adapter.discover()
    expect(result.length).toBe(577)

    // Check few field types on lead object
    const lead = result
      .filter(val => {
        return val.object === 'lead'
      })
      .pop()

    // Test few possible types
    expect(lead.last_name.type).toBe('string')
    expect(lead.description.type).toBe('textarea')
    expect(lead.salutation.type).toBe('picklist')

    // Test label
    expect(lead.last_name.label).toBe('Last Name')

    // Test true and false required
    expect(lead.description.required).toBe(true)
    expect(lead.created_date.required).toBe(false)

    // Test picklist restricted_pick_list prop
    expect(lead.primary_c.restricted_pick_list).toBe(false)
    expect(lead.clean_status.restricted_pick_list).toBe(true)

    // Test picklist values
    // const vals: string[] = lead.salutation.values
    expect((lead.salutation.values as string[]).join(';')).toBe(
      'Mr.;Ms.;Mrs.;Dr.;Prof.'
    )

    // Test _default
    // TODO: add test to primitive with _default and combobox _default (no real example for lead)
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.status._default).toBe('Open - Not Contacted')
  })
})
