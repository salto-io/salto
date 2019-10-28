import { Logger, LogLevel, LOG_LEVELS, logger as createLogger } from 'adapter-api'

type HasMockLogMethods = {
  [logLevel in LogLevel]: jest.Mock
}

export type MockLogger = Logger & HasMockLogMethods & {
  log: jest.Mock
}

const mockLogger = (): MockLogger => {
  const logger = createLogger(module)
  const mockedMethods: (LogLevel | 'log')[] = [...LOG_LEVELS, 'log']
  const mocks = mockedMethods.map(m => {
    const mock = jest.fn()
    logger[m] = mock
    return mock
  })
  beforeEach(() => {
    mocks.forEach(m => m.mockClear())
  })
  return logger as MockLogger
}

export default mockLogger
