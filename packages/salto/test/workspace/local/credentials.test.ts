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

  const setNewMock = jest.fn().mockResolvedValueOnce(true)
  bpStoreMockLoad.mockImplementation(name => {
    if (name === 'set-new') {
      return { set: setNewMock }
    }
    if (name === 'get-exists') {
      return {
        get: jest.fn().mockResolvedValueOnce(
          { filename: `${adapter}.bp`, buffer: dump([creds]) }
        ),
      }
    }
    return { get: jest.fn().mockResolvedValueOnce(undefined) }
  })

  it('should set new credentials', async () => {
    await localCredentials('set-new').set(adapter, creds)
    expect(setNewMock).toHaveBeenCalledWith({ filename: `${adapter}.bp`, buffer: dump([creds]) })
  })

  it('should get credentials if exists', async () => {
    const fromCredsStore = await localCredentials('get-exists').get(adapter)
    expect(fromCredsStore?.value).toEqual(creds.value)
  })

  it('shouldnt fail if credentials not exists', async () => {
    const fromCredsStore = await localCredentials('').get(adapter)
    expect(fromCredsStore).toBeUndefined()
  })
})
