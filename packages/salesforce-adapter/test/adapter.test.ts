import SalesforceAdapter from '../src/adapter'
import SalesforceClient from '../src/client'

jest.mock('../src/client')

describe('Test SalesforceAdapter.discover', () => {
  // Utility function that mock single object
  function mockSingleSObject(
    name: string,
    fields: Record<string, any>[]
  ): SalesforceAdapter {
    SalesforceClient.prototype.listSObjects = jest
      .fn()
      .mockImplementationOnce(() => {
        return [{ name }]
      })
    SalesforceClient.prototype.listMetadataObjects = jest
      .fn()
      .mockImplementationOnce(() => {
        return []
      })
    SalesforceClient.prototype.discoverSObject = jest
      .fn()
      .mockImplementationOnce(() => {
        return fields
      })

    return new SalesforceAdapter({
      username: '',
      password: '',
      token: '',
      sandbox: false
    })
  }

  it('should discover sobject with primitive types, validate type, label, required and default annotations', async () => {
    const instance = mockSingleSObject('Lead', [
      {
        name: 'LastName',
        type: 'string',
        label: 'Last Name',
        nillable: false,
        defaultValue: 'BLABLA'
      },
      {
        name: 'FirstName',
        type: 'string',
        label: 'First Name',
        nillable: true
      },
      {
        name: 'IsDeleted',
        type: 'boolean',
        label: 'Is Deleted',
        defaultValue: false
      }
    ])
    const result = await instance.discover()

    expect(result.length).toBe(1)
    const lead = result.pop()

    expect(lead.last_name.type).toBe('string')
    expect(lead.last_name.label).toBe('Last Name')
    // Test Rquired true and false
    expect(lead.last_name.required).toBe(false)
    expect(lead.first_name.required).toBe(true)
    // Default string and boolean
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.last_name._default).toBe('BLABLA')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.is_deleted._default).toBe(false)
  })

  it('should discover sobject with picklist field', async () => {
    const instance = mockSingleSObject('Lead', [
      {
        name: 'PrimaryC',
        type: 'picklist',
        label: 'Primary',
        nillable: false,
        picklistValues: [
          { value: 'No', defaultValue: false },
          { value: 'Yes', defaultValue: true }
        ]
      }
    ])
    const result = await instance.discover()

    expect(result.length).toBe(1)
    const lead = result.pop()

    expect(lead.primary_c.type).toBe('picklist')
    expect((lead.primary_c.values as string[]).join(';')).toBe('No;Yes')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.primary_c._default).toBe('Yes')
  })

  it('should discover sobject with combobox field', async () => {
    const instance = mockSingleSObject('Lead', [
      {
        name: 'PrimaryC',
        type: 'combobox',
        label: 'Primary',
        nillable: false,
        picklistValues: [
          { value: 'No', defaultValue: false },
          { value: 'Yes', defaultValue: true }
        ]
      }
    ])
    const result = await instance.discover()

    expect(result.length).toBe(1)
    const lead = result.pop()

    expect(lead.primary_c.type).toBe('combobox')
    expect((lead.primary_c.values as string[]).join(';')).toBe('No;Yes')
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.primary_c._default.length).toBe(1)
    // eslint-disable-next-line no-underscore-dangle
    expect(lead.primary_c._default.pop()).toBe('Yes')
  })
})
