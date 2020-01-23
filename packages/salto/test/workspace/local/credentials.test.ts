import { ElemID, ObjectType, Field, BuiltinTypes, InstanceElement } from 'adapter-api'
import { dump } from '../../../src/parser/dump'
import { localCredentials } from '../../../src/workspace/local/credentials'
import * as bpStore from '../../../src/workspace/local/blueprints_store'

jest.mock('../../../src/workspace/local/blueprints_store')
describe('localCredentials', () => {
  const adapter = 'mockadapter'
  const bpStoreMockLoad = bpStore.localBlueprintsStore as jest.Mock
  const configID = new ElemID(adapter)
  const configType = new ObjectType({
    elemID: configID,
    fields: {
      username: new Field(configID, 'username', BuiltinTypes.STRING),
      password: new Field(configID, 'password', BuiltinTypes.STRING),
    },
  })
  const creds = new InstanceElement(ElemID.CONFIG_NAME, configType, {
    username: 'test@test',
    password: 'test',
  })

  const mockSet = jest.fn()
  const mockGet = jest.fn()
  const mockFlush = jest.fn()
  const dumpedCredentials = { filename: `${adapter}.bp`, buffer: dump([creds]) }

  beforeEach(() => {
    bpStoreMockLoad.mockReturnValue({ get: mockGet, set: mockSet, flush: mockFlush })
  })

  it('should set new credentials', async () => {
    mockSet.mockResolvedValueOnce(true)
    mockFlush.mockResolvedValue(true)
    await localCredentials('').set(adapter, creds)
    expect(mockSet).toHaveBeenCalledWith(dumpedCredentials)
    expect(mockFlush).toHaveBeenCalledTimes(1)
  })

  it('should get credentials if exists', async () => {
    mockGet.mockResolvedValueOnce(dumpedCredentials)
    const fromCredsStore = await localCredentials('').get(adapter)
    expect(fromCredsStore?.value).toEqual(creds.value)
  })

  it('shouldnt fail if credentials not exists', async () => {
    mockGet.mockResolvedValueOnce(undefined)
    const fromCredsStore = await localCredentials('').get(adapter)
    expect(fromCredsStore).toBeUndefined()
  })
})
