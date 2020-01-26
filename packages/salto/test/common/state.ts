import State from '../../src/workspace/state'

const mockState = (): State => ({
  list: jest.fn().mockImplementation(() => Promise.resolve([])),
  get: jest.fn().mockImplementation(() => Promise.resolve()),
  getAll: jest.fn().mockImplementation(() => Promise.resolve([])),
  set: jest.fn().mockImplementation(() => Promise.resolve()),
  remove: jest.fn().mockImplementation(() => Promise.resolve()),
  flush: jest.fn().mockImplementation(() => Promise.resolve()),
})

export default mockState
