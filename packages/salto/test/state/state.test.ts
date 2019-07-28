import * as fs from 'async-file'
import path from 'path'
import os from 'os'
import {
  PrimitiveType,
  Field,
  PrimitiveTypes,
  ObjectType,
  ElemID,
} from 'adapter-api'
import _ from 'lodash'
import * as TestHelpers from '../common/helpers'
import State from '../../src/state/state'

describe('Test state mechanism', () => {
  const stateErrorFile = 'stateerror.bp'
  const statePath = path.join(os.homedir(), '.salto/test_state.bp')
  const blueprintsDirectory = path.join(__dirname, '../../../test', 'blueprints')
  const state = new State(statePath)
  beforeAll(async () => {
    try {
      await fs.unlink(statePath)
      // This remark is to prevent from failing if the state doesn't exist yet
      /* eslint-disable no-empty */
    } catch {}
  })

  afterEach(async () => {
    try {
      await fs.unlink(statePath)
      // This remark is to prevent from failing if the state doesn't exist yet
      /* eslint-disable no-empty */
    } catch {}
  })

  it('should save state successfully, retrieve it, save it again and get the same result', async () => {
    // Setup
    const mySaas = 'mySaas'
    const stringType = new PrimitiveType({
      elemID: new ElemID(mySaas, 'string'),
      primitive: PrimitiveTypes.STRING,
    })
    const mockElemID = new ElemID(mySaas, 'test_state')
    const element = new ObjectType({
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
      annotationsValues: {
        required: false,
        _default: 'test',
        label: 'test label',
        myField: 'TestState',
      },
    })

    await state.saveState([element])

    // Test
    const retrievedState = await state.getLastState()
    expect(retrievedState.length).toBe(1)
    const retrievedStateObjectType = retrievedState[0] as ObjectType
    TestHelpers.expectTypesToMatch(retrievedStateObjectType, element)

    await state.saveState(retrievedState)
    const retreivedAgainState = await state.getLastState()

    expect(_.isEqual(retrievedState, retreivedAgainState)).toBeTruthy()
  })

  it('should return an empty array if there is no saved state', async () => {
    const result = await state.getLastState()
    expect(result.length).toBe(0)
  })

  it('should throw an error if the state bp is not valid', async () => {
    // Setup
    const buffer = await fs.readFile(path.join(blueprintsDirectory, stateErrorFile), 'utf8')
    await fs.createDirectory(path.dirname(statePath))
    await fs.writeFile(statePath, buffer)

    // Test
    await expect(state.getLastState()).rejects.toThrow()
  })
})
