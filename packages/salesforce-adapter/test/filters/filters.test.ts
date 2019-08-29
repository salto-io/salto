import { ObjectType, ElemID, InstanceElement } from 'adapter-api'
import SalesforceAdapter from '../../src/adapter'
// import Connection from '../../src/client/connection'
import { API_NAME } from '../../src/constants'
import Filter from '../../src/filters/filter'
import SalesforceClient from '../../src/client/client'

jest.mock('../../src/client/client')

describe('SalesforceAdapter filters', () => {
  let filter: Filter
  let adapter: SalesforceAdapter

  const object = new ObjectType({
    elemID: new ElemID('bla', 'test'),
    annotationsValues: { [API_NAME]: 'Bla__c' },
  })

  beforeEach(() => {
    filter = {
      onDiscover: jest.fn().mockImplementationOnce(elements => elements),
      onAdd: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
      onUpdate: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
      onRemove: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
    }

    SalesforceClient.prototype.listMetadataTypes = jest.fn().mockImplementationOnce(async () => [])
    SalesforceClient.prototype.listMetadataObjects = jest.fn().mockImplementationOnce(
      async () => []
    )
    SalesforceClient.prototype.listSObjects = jest.fn().mockImplementationOnce(async () => [])
    SalesforceClient.prototype.describeSObjects = jest.fn().mockImplementationOnce(async () => [])

    adapter = new SalesforceAdapter({ filters: [filter] })
    adapter.init(new InstanceElement(
      new ElemID('salesforce'),
      adapter.getConfigType(),
      {
        username: '', password: '', token: '', sandbox: false,
      },
    ))
  })

  it('should call inner aspects upon discover', async () => {
    await adapter.discover()
    const { mock } = filter.onDiscover as jest.Mock<undefined>
    expect(mock.calls.length).toBe(1)
  })

  it('should call inner aspects upon add', async () => {
    await adapter.add(object)
    const { mock } = filter.onAdd as jest.Mock<undefined>
    expect(mock.calls.length).toBe(1)
    expect(mock.calls[0][1].elemID.getFullName()).toEqual(object.elemID.getFullName())
  })

  it('should call inner aspects upon remove', async () => {
    await adapter.remove(object)
    const { mock } = filter.onRemove as jest.Mock<undefined>
    expect(mock.calls.length).toBe(1)
    expect(mock.calls[0][1].elemID.getFullName()).toEqual(object.elemID.getFullName())
  })

  it('should call inner aspects upon update', async () => {
    await adapter.update(object, object)
    const { mock } = filter.onUpdate as jest.Mock<undefined>
    expect(mock.calls.length).toBe(1)
    expect(mock.calls[0][1]).toEqual(object)
    expect(mock.calls[0][2].elemID.getFullName()).toEqual(object.elemID.getFullName())
  })
})
