import { ObjectType, ElemID } from 'adapter-api'
import SalesforceClient from '../../src/client/client'
import { AspectsManager, Aspect } from '../../src/aspects/aspects'

jest.mock('../../src/client/client')

describe('Test AspectsManager', () => {
  let aspect: Aspect
  let manager: AspectsManager
  const object = new ObjectType({ elemID: new ElemID('bla', 'test') })
  beforeEach(() => {
    aspect = {
      discover: jest.fn().mockImplementationOnce(elements => elements),
      add: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
      update: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
      remove: jest.fn().mockImplementationOnce(() => ([{ success: true }])),
    }
    manager = new AspectsManager(new SalesforceClient('', '', false))
    manager.aspects = [aspect]
  })

  it('should call inner aspects upon discover', async () => {
    await manager.discover([object])
    const { mock } = aspect.discover as jest.Mock<undefined>
    expect(mock.calls.length).toBe(1)
    expect(mock.calls[0][1]).toEqual([object])
  })
  it('should call inner aspects upon add', async () => {
    await manager.add(object)
    const { mock } = aspect.add as jest.Mock<undefined>
    expect(mock.calls.length).toBe(1)
    expect(mock.calls[0][1]).toEqual(object)
  })
  it('should call inner aspects upon remove', async () => {
    await manager.remove(object)
    const { mock } = aspect.remove as jest.Mock<undefined>
    expect(mock.calls.length).toBe(1)
    expect(mock.calls[0][1]).toEqual(object)
  })
  it('should call inner aspects upon update', async () => {
    await manager.update(object, object)
    const { mock } = aspect.update as jest.Mock<undefined>
    expect(mock.calls.length).toBe(1)
    expect(mock.calls[0][1]).toEqual(object)
    expect(mock.calls[0][2]).toEqual(object)
  })
})
