import { promises as fsp } from 'fs'
import path from 'path'
import os from 'os'
import { promisify } from 'util'
import {
  PrimitiveType,
  Field,
  PrimitiveTypes,
  ObjectType,
  ElemID,
} from 'adapter-api'
import _ from 'lodash'
import rimRafLib from 'rimraf'
import mkdirpLib from 'mkdirp'
import * as TestHelpers from '../common/helpers'
import State from '../../src/state/state'

const rimRaf = promisify(rimRafLib)
const mkdirp = promisify(mkdirpLib)

describe('Test state mechanism', () => {
  const stateErrorFile = 'stateerror.bp'
  const statePath = path.join(os.homedir(), '.salto/test_state.bp')
  const blueprintsDirectory = path.join(__dirname, '../../../test', 'blueprints')
  let state: State
  // Setup
  const mockServiceName = 'mySaas'
  const stringType = new PrimitiveType({
    elemID: new ElemID(mockServiceName, 'string'),
    primitive: PrimitiveTypes.STRING,
  })
  const mockElemID = new ElemID(mockServiceName, 'test_state')
  const mockElement = new ObjectType({
    elemID: mockElemID,
    fields: {
      address: new Field(
        mockElemID,
        'address',
        stringType,
        {
          myField: 'MyAddress',
        },
      ),
      banana: new Field(
        mockElemID,
        'banana',
        stringType,
        {
          myField: 'MyBanana',
        },
      ),
    },
    annotations: {
      required: false,
      _default: 'test',
      label: 'test label',
      myField: 'TestState',
    },
  })
  beforeAll(async () => {
    await rimRaf(statePath)
  })

  beforeEach(() => { state = new State(statePath) })

  afterEach(async () => {
    await rimRaf(statePath)
  })

  it('should override state successfully, retrieve it, override it again and get the same result', async () => {
    state.override([mockElement])

    // Test
    const retrievedState = await state.get()
    expect(retrievedState.length).toBe(1)
    const retrievedStateObjectType = retrievedState[0] as ObjectType
    TestHelpers.expectTypesToMatch(retrievedStateObjectType, mockElement)

    state.override(retrievedState)
    const retreivedAgainState = await state.get()

    expect(_.isEqual(retrievedState, retreivedAgainState)).toBeTruthy()
  })

  it('should return an empty array if there is no saved state', async () => {
    const result = await state.get()
    expect(result.length).toBe(0)
  })

  it('should throw an error if the state bp is not valid', async () => {
    // Setup
    const buffer = await fsp.readFile(
      path.join(blueprintsDirectory, stateErrorFile),
      { encoding: 'utf8' },
    )
    await mkdirp(path.dirname(statePath))
    await fsp.writeFile(statePath, buffer)

    // Test
    await expect(state.get()).rejects.toThrow()
  })

  it('should get same state from different instance', async () => {
    state.override([mockElement])
    await state.flush()

    const newInstance = new State(statePath)
    const fromState = await newInstance.get()
    expect(fromState.length).toBe(1)
  })

  it('should update state', async () => {
    state.override([mockElement])
    const clone = mockElement.clone()
    const newField = Object.values(mockElement.fields)[0]
    newField.name = 'new_field'
    clone.fields.newfield = newField
    state.update([clone])

    const fromState = await state.get() as ObjectType []
    expect(fromState.length).toBe(1)
    expect(fromState[0].fields.newfield).toBeDefined()
  })

  it('should add to state', async () => {
    state.override([mockElement])
    const clone = mockElement.clone()
    clone.elemID.nameParts = ['new']
    state.update([clone])

    const fromState = await state.get()
    expect(fromState.length).toBe(2)
    expect(fromState[1].elemID.name).toBe('new')
  })

  it('should remove from state', async () => {
    state.override([mockElement])
    let fromState = await state.get()
    expect(fromState.length).toBe(1)

    state.remove([mockElement])
    fromState = await state.get()
    expect(fromState.length).toBe(0)
  })
})
