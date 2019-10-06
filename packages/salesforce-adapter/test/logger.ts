import { Logger } from '../src/client/client'

export type MockLogger = Logger & {
  [logLevel in keyof Logger]: jest.Mock
}

const mockLogger: () => MockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
})

export default mockLogger
