import { ElemID, ObjectType, Field, BuiltinTypes, InstanceElement } from 'adapter-api'
import { DirectoryStore } from '../../src/workspace/dir_store'
import { dumpElements } from '../../src/parser/dump'
import { adapterCredentials } from '../../src/workspace/credentials'

jest.mock('../../../src/workspace/local/dir_store')
describe('credentials', () => {
  const adapter = 'mockadapter'
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
  const dumpedCredentials = { filename: `${adapter}.bp`, buffer: dumpElements([creds]) }
  const mockedDirStore = {
    get: mockGet,
    set: mockSet,
    flush: mockFlush,
  } as unknown as DirectoryStore

  it('should set new credentials', async () => {
    mockSet.mockResolvedValueOnce(true)
    mockFlush.mockResolvedValue(true)
    await adapterCredentials(mockedDirStore).set(adapter, creds)
    expect(mockSet).toHaveBeenCalledWith(dumpedCredentials)
    expect(mockFlush).toHaveBeenCalledTimes(1)
  })

  it('should get credentials if exists', async () => {
    mockGet.mockResolvedValueOnce(dumpedCredentials)
    const fromCredsStore = await adapterCredentials(mockedDirStore).get(adapter)
    expect(fromCredsStore?.value).toEqual(creds.value)
  })

  it('shouldnt fail if credentials not exists', async () => {
    mockGet.mockResolvedValueOnce(undefined)
    const fromCredsStore = await adapterCredentials(mockedDirStore).get(adapter)
    expect(fromCredsStore).toBeUndefined()
  })
})
