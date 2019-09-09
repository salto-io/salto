import Connection, { Metadata, Soap } from '../src/client/connection'

const mockConnection: () => Connection = () => ({
  login: () => Promise.resolve(),
  metadata: {
    describe: jest.fn(),
    describeValueType: jest.fn(),
    read: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    deploy: jest.fn(),
  } as Metadata,
  soap: {
    describeSObjects: jest.fn(),
  } as Soap,

  describeGlobal: jest.fn().mockImplementation(async () => ({ sobjects: [] })),
  query: jest.fn(),
  queryMore: jest.fn(),
})

export default mockConnection
