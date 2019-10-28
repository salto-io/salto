import * as common from '../src/internal/common'
import * as winston from '../src/internal/winston'
import * as env from '../src/internal/env'
import * as repo from '../src/internal/repo'

const INDEX_PATH = '../src/index'

describe('index', () => {
  const mockConfig = { ...common.DEFAULT_CONFIG }
  let mergeConfigs: jest.SpyInstance
  let winstonLoggerRepo: jest.SpyInstance
  let loggerRepo: jest.SpyInstance

  beforeEach(() => {
    mergeConfigs = jest.spyOn(common, 'mergeConfigs')
    winstonLoggerRepo = jest.spyOn(winston, 'loggerRepo')
    loggerRepo = jest.spyOn(repo, 'loggerRepo')

    jest.spyOn(env, 'config').mockImplementation(() => mockConfig)

    delete require.cache[require.resolve(INDEX_PATH)]
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
