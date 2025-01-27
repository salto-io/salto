/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import * as pino from '../src/pino'
import * as env from '../src/env'
import * as logger from '../src/logger'
import * as config from '../src/config'

const INDEX_PATH = '../index'

describe('index', () => {
  const mockConfig = { ...config.DEFAULT_CONFIG }
  let mergeConfigs: jest.SpyInstance
  let pinoLoggerRepo: jest.SpyInstance
  let loggerRepo: jest.SpyInstance

  beforeEach(() => {
    mergeConfigs = jest.spyOn(config, 'mergeConfigs')
    pinoLoggerRepo = jest.spyOn(pino, 'loggerRepo')
    loggerRepo = jest.spyOn(logger, 'loggerRepo')

    jest.spyOn(env, 'config').mockImplementation(() => mockConfig)

    delete require.cache[require.resolve(INDEX_PATH)]
    // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-require-imports
    require(INDEX_PATH)
  })

  it('calls mergeConfig correctly', () => {
    expect(mergeConfigs).toHaveBeenCalledWith(mockConfig)
  })

  it('calls pino.loggerRepo correctly', () => {
    expect(pinoLoggerRepo).toHaveBeenCalled()
    expect(pinoLoggerRepo.mock.calls[0][0]).toMatchObject({
      env: process.env,
      consoleStream: process.stdout,
    })
  })

  it('calls repo.loggerRepo correctly', () => {
    expect(loggerRepo).toHaveBeenCalled()
    expect(loggerRepo.mock.calls[0][1]).toEqual(mockConfig)
  })

  test('compareLogLevels', () => {
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
    const { compareLogLevels } = require('..')
    expect(compareLogLevels('info', 'debug')).toBeLessThan(0)
  })
})
