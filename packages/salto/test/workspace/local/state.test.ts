import { ObjectType, ElemID, isObjectType } from 'adapter-api'
import { getAllElements } from '../../common/elements'
import { expectTypesToMatch } from '../../common/helpers'
import LocalState from '../../../src/workspace/local/state'
import { serialize } from '../../../src/serializer/elements'
import { replaceContents } from '../../../src/file'

jest.mock('../../../src/file', () => ({
  replaceContents: jest.fn().mockImplementation(() => Promise.resolve()),
  readTextFile: jest.fn().mockImplementation((filename: string) => {
    if (filename === 'error') {
      return Promise.resolve('blabl{,.')
    }
    if (filename === 'full') {
      return Promise.resolve('[{"elemID":{"adapter":"salesforce","nameParts":["_config"]},"type":{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","nameParts":[]},"fields":{},"isSettings":false,"className":"ObjectType"},"value":{"token":"token","sandbox":false,"username":"test@test","password":"pass"},"className":"InstanceElement"},{"annotationTypes":{},"annotations":{"lead_convert_settings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"salesforce","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"salesforce","nameParts":["test"]},"name":"name","type":{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"className":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"salesforce","nameParts":["test","name"]},"className":"Field"}},"isSettings":false,"className":"ObjectType"},{"annotationTypes":{},"annotations":{"metadata_type":"Settings"},"elemID":{"adapter":"salesforce","nameParts":["settings"]},"fields":{},"isSettings":true,"className":"ObjectType"}]')
    }
    return Promise.resolve('[]')
  }),
}))

describe('local state', () => {
  let state: LocalState
  const mockElement = getAllElements().find(isObjectType) as ObjectType

  beforeEach(() => {
    state = new LocalState('empty')
  })
  it('should return an empty array if there is no saved state', async () => {
    const result = await state.getAll()
    expect(result.length).toBe(0)
  })

  it('should set state successfully, retrieve it and get the same result', async () => {
    await state.set([mockElement])
    // Test
    const retrievedState = await state.getAll()
    expect(retrievedState.length).toBe(1)
    const retrievedStateObjectType = retrievedState[0] as ObjectType
    expectTypesToMatch(retrievedStateObjectType, mockElement)
  })

  it('should read valid state file', async () => {
    state = new LocalState('full')
    const elements = await state.getAll()
    expect(elements).toHaveLength(2)
  })

  it('should throw an error if the state bp is not valid', async () => {
    state = new LocalState('error')
    await expect(state.getAll()).rejects.toThrow()
  })

  it('should update state', async () => {
    await state.set([mockElement])
    const clone = mockElement.clone()
    const newField = Object.values(mockElement.fields)[0]
    newField.name = 'new_field'
    clone.fields.newfield = newField
    state.set([clone])

    const fromState = await state.get(mockElement.elemID) as ObjectType
    expect(fromState.fields.newfield).toBeDefined()
  })

  it('should add to state', async () => {
    await state.set([mockElement])
    const newElem = new ObjectType({ elemID: new ElemID('mock_adapter', 'new') })
    state.set([newElem])

    const fromState = await state.getAll()
    expect(fromState.length).toBe(2)
    expect(fromState[1].elemID.name).toBe('new')
  })

  it('should remove from state', async () => {
    await state.set([mockElement])
    let fromState = await state.getAll()
    expect(fromState.length).toBe(1)

    await state.remove(mockElement.elemID)
    fromState = await state.getAll()
    expect(fromState.length).toBe(0)
  })

  it('should write file on flush', async () => {
    await state.set([mockElement])
    await state.flush()
    expect(replaceContents).toHaveBeenCalledWith('empty', serialize([mockElement]))
  })

  it('shouldnt write file if state was not loaded on flush', async () => {
    jest.resetAllMocks()
    await state.flush()
    expect(replaceContents).not.toHaveBeenCalled()
  })
})
