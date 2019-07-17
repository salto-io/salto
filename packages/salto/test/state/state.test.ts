import * as fs from 'async-file'
import path from 'path'
import {
  PrimitiveType,
  Field,
  PrimitiveTypes,
  ObjectType,
  ElemID,
} from 'adapter-api'
import _ from 'lodash'
import * as constants from '../constants'
import State from '../../src/state/state'

describe('Test state mechanism', () => {
  const stateErrorFile = 'stateerror.bp'
  const stateFullPath = path.join(__dirname, '../../src/state/.salto/latest_state.bp')
  const blueprintsDirectory = path.join(__dirname, '../../../test', 'blueprints')
  const stringType = new PrimitiveType({
    elemID: new ElemID(constants.SALESFORCE, 'string'),
    primitive: PrimitiveTypes.STRING,
  })

  beforeAll(async () => {
    await fs.unlink(stateFullPath)
  })

  it('should save state successfully, retrieve it, save it again and get the same result', async () => {
    // Setup
    const mockElemID = new ElemID(constants.SALESFORCE, 'test_state')
    const element = new ObjectType({
      elemID: mockElemID,
      fields: {
        address: new Field(
          mockElemID,
          'address',
          stringType,
          {
            [constants.API_NAME]: 'Address__c',
            [constants.FIELD_LEVEL_SECURITY]: {
              admin: { editable: true, readable: true },
            },
          },
        ),
        banana: new Field(
          mockElemID,
          'banana',
          stringType,
          {
            [constants.API_NAME]: 'Banana__c',
            [constants.FIELD_LEVEL_SECURITY]: {
              standard: { editable: true, readable: true },
            },
          },
        ),
      },
      annotationsValues: {
        required: false,
        _default: 'test',
        label: 'test label',
        [constants.API_NAME]: 'TestState__c',
      },
    })

    await State.saveState([element])

    // Test
    const retrievedState = await State.getLastState()
    expect(retrievedState.length).toBe(1)

    await State.saveState(retrievedState)
    const retreivedAgainState = await State.getLastState()

    expect(_.isEqual(retrievedState, retreivedAgainState)).toBeTruthy()

    // Clean-up
    await fs.unlink(stateFullPath)
  })

  it('should return an empty array if there is no saved state', async () => {
    const result = await State.getLastState()
    expect(result.length).toBe(0)
  })

  it('should throw an error if the state bp is not valid', async () => {
    // Setup
    const buffer = await fs.readFile(path.join(blueprintsDirectory, stateErrorFile), 'utf8')
    await fs.createDirectory(path.dirname(stateFullPath))
    await fs.writeFile(stateFullPath, buffer)

    // Test
    await expect(State.getLastState()).rejects.toThrow()

    // Clean-up
    await fs.unlink(stateFullPath)
  })
})
