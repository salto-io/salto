import Connection, { Metadata, Soap } from '../src/client/jsforce'

const mockJsforce: () => Connection = () => ({
  login: () => Promise.resolve(),
  metadata: {
    describe: jest.fn().mockImplementation(() => Promise.resolve({ metadataObjects: [] })),
    describeValueType: jest.fn().mockImplementation(() => Promise.resolve([])),
    read: jest.fn().mockImplementation(() => Promise.resolve([])),
    list: jest.fn().mockImplementation(() => Promise.resolve([])),
    upsert: jest.fn().mockImplementation(() => Promise.resolve([])),
    delete: jest.fn().mockImplementation(() => Promise.resolve([])),
    update: jest.fn().mockImplementation(() => Promise.resolve([])),
    retrieve: jest.fn().mockImplementation(() => ({ complete: async () => ({ zipFile: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' }) })), // encoded empty zipFile
    deploy: jest.fn().mockImplementation(() => Promise.resolve({})),
  } as Metadata,
  soap: {
    describeSObjects: jest.fn().mockImplementation(() => Promise.resolve([])),
  } as Soap,
  bulk: {
    load: jest.fn().mockImplementation(() => Promise.resolve()),
  },

  describeGlobal: jest.fn().mockImplementation(async () => Promise.resolve({ sobjects: [] })),
  query: jest.fn().mockImplementation(() => Promise.resolve()),
  queryMore: jest.fn().mockImplementation(() => Promise.resolve()),
  destroy: jest.fn().mockImplementation(() => Promise.resolve()),
  limits: jest.fn().mockImplementation(() => Promise.resolve({
    DailyApiRequests: { Remaining: 10000 },
  })),
})

export default mockJsforce
