import { ObjectType, ElemID } from 'adapter-api'
import SalesforceAdapter from '../../src/adapter'
import { FilterWith, FilterCreator } from '../../src/filter'
import { API_NAME } from '../../src/constants'
import mockAdapter from '../adapter'

describe('SalesforceAdapter filters', () => {
  const object = new ObjectType({
    elemID: new ElemID('bla', 'test'),
    annotations: { [API_NAME]: 'Bla__c' },
  })

  let adapter: SalesforceAdapter

  const createAdapter = (
    filterCreators: FilterCreator[]
  ): SalesforceAdapter => mockAdapter({ adapterParams: { filterCreators } }).adapter

  describe('when filter methods are implemented', () => {
    let filter: FilterWith<'onDiscover' | 'onAdd' | 'onUpdate' | 'onRemove'>

    beforeEach(() => {
      filter = {
        onDiscover: jest.fn().mockImplementationOnce(elements => elements),
        onAdd: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
        onUpdate: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
        onRemove: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
      }

      adapter = createAdapter([() => filter])
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
      expect(mock.calls[0][0].elemID.getFullName()).toEqual(object.elemID.getFullName())
    })

    it('should call inner aspects upon remove', async () => {
      await adapter.remove(object)
      const { mock } = filter.onRemove as jest.Mock<undefined>
      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0][0].elemID.getFullName()).toEqual(object.elemID.getFullName())
    })

    it('should call inner aspects upon update', async () => {
      await adapter.update(object, object, [])
      const { mock } = filter.onUpdate as jest.Mock<undefined>
      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0][0]).toEqual(object)
      expect(mock.calls[0][1].elemID.getFullName()).toEqual(object.elemID.getFullName())
    })
  })
})
