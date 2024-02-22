/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as pino from '../src/internal/pino'
import * as env from '../src/internal/env'
import * as logger from '../src/internal/logger'
import * as config from '../src/internal/config'

const INDEX_PATH = '../src/index'

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
    // eslint-disable-next-line import/no-dynamic-require, global-require
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
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const { compareLogLevels } = require('../src')
    expect(compareLogLevels('info', 'debug')).toBeLessThan(0)
  })
})
