import * as winston from '../src/internal/winston'
import * as env from '../src/internal/env'
import * as logger from '../src/internal/logger'
import * as config from '../src/internal/config'

const INDEX_PATH = '../src/index'

describe('index', () => {
  const mockConfig = { ...config.DEFAULT_CONFIG }
  let mergeConfigs: jest.SpyInstance
  let winstonLoggerRepo: jest.SpyInstance
  let loggerRepo: jest.SpyInstance

  beforeEach(() => {
    mergeConfigs = jest.spyOn(config, 'mergeConfigs')
    winstonLoggerRepo = jest.spyOn(winston, 'loggerRepo')
    loggerRepo = jest.spyOn(logger, 'loggerRepo')

    jest.spyOn(env, 'config').mockImplementation(() => mockConfig)

    delete require.cache[require.resolve(INDEX_PATH)]
    // eslint-disable-next-line import/no-dynamic-require, global-require
    require(INDEX_PATH)
  })

  it('calls mergeConfig correctly', () => {
    expect(mergeConfigs).toHaveBeenCalledWith(mockConfig)
  })

  it('calls winston.loggerRepo correctly', () => {
    expect(winstonLoggerRepo).toHaveBeenCalled()
    expect(winstonLoggerRepo.mock.calls[0][0]).toMatchObject({
      env: process.env,
      consoleStream: process.stdout,
    })
  })

  it('calls repo.loggerRepo correctly', () => {
    expect(loggerRepo).toHaveBeenCalled()
    expect(loggerRepo.mock.calls[0][1]).toEqual(mockConfig)
  })
})
