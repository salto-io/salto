import { ElementsDataSource } from 'src/workspace/elements_data_source'

const mockDataSource = (): ElementsDataSource => ({
  list: jest.fn().mockImplementation(() => Promise.resolve([])),
  get: jest.fn().mockImplementation(() => Promise.resolve()),
  getAll: jest.fn().mockImplementation(() => Promise.resolve([])),
  set: jest.fn().mockImplementation(() => Promise.resolve()),
  remove: jest.fn().mockImplementation(() => Promise.resolve()),
})

export default mockDataSource
