
/*
*                      Copyright 2020 Salto Labs Ltd.
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

import * as conf from '../src/app_config'
import * as file from '../src/file'

jest.mock('../src/file')
const mockMkdirp = file.mkdirp as jest.Mock
const mockReplaceContents = file.replaceContents as jest.Mock
const mockExists = file.exists as jest.Mock
const mockReadFile = file.readFile as unknown as jest.Mock

let keepEnv: NodeJS.ProcessEnv = {}
describe('app config', () => {
  beforeAll(() => { keepEnv = process.env })
  afterEach(() => {
    [
      'SALTO_TELEMETRY_URL',
      'SALTO_TELEMETRY_DISABLE',
      'SALTO_TELEMETRY_TOKEN',
      'SALTO_HOME',
    ].forEach(e => delete process.env[e])
  })
  afterAll(() => { process.env = keepEnv })

  it('should load config from disk', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/exists/home'
    process.env.SALTO_TELEMETRY_URL = 'localhost'
    const bpFileContent = `
    salto {
      installationID = "1234"
      telemetry = {
        enabled = true
      }
    }`
    mockReadFile.mockResolvedValue(Buffer.from(bpFileContent, 'utf-8'))
    mockExists.mockResolvedValue(true)
    const appConfig = await conf.configFromDisk()
    expect(conf.getSaltoHome()).toEqual('/exists/home')
    expect(appConfig.installationID).toEqual('1234')
    expect(appConfig.telemetry.url).toEqual('localhost')
    expect(appConfig.telemetry.enabled).toBeTruthy()
    expect(mockMkdirp).not.toHaveBeenCalled()
    expect(mockReplaceContents).not.toHaveBeenCalled()
  })

  it('should disable telemetry if telemetry config is disabled', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/home/u'
    const bpFileContent = `
    salto {
      installationID = "9876"
      telemetry = {
        enabled = false
      }
    }`
    mockReadFile.mockResolvedValue(Buffer.from(bpFileContent, 'utf-8'))
    mockExists.mockResolvedValue(false)
    const appConfig = await conf.configFromDisk()
    expect(appConfig.telemetry.enabled).toBeFalsy()
  })

  it('should create the config if not existing', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/home/u'
    const bpFileContent = `
    salto {
      installationID = "9876"
      telemetry = {
        enabled = false
      }
    }`
    mockReadFile.mockResolvedValue(Buffer.from(bpFileContent, 'utf-8'))
    mockExists.mockResolvedValue(false)
    const appConfig = await conf.configFromDisk()
    expect(conf.getSaltoHome()).toEqual('/home/u')
    expect(appConfig.installationID).toEqual('9876')
    expect(mockMkdirp).toHaveBeenCalled()
    expect(mockReplaceContents).toHaveBeenCalled()
  })

  it('should override config.bp with env variable', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/exists/home'
    process.env.SALTO_TELEMETRY_DISABLE = '1'
    process.env.SALTO_TELEMETRY_TOKEN = 'token'
    process.env.SALTO_TELEMETRY_URL = 'localhost'
    const bpFileContent = `
    salto {
      installationID = "1234"
      telemetry = {
        enabled = true
      }
    }`
    mockReadFile.mockResolvedValue(Buffer.from(bpFileContent, 'utf-8'))
    mockExists.mockResolvedValue(true)
    const appConfig = await conf.configFromDisk()
    expect(appConfig.installationID).toEqual('1234')
    expect(appConfig.telemetry.url).toEqual('localhost')
    expect(appConfig.telemetry.token).toEqual('token')
    expect(appConfig.telemetry.enabled).toBeFalsy()
  })

  it('should not throw an error if installationID is missing', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/home/no_installation_id'
    const bpFileContent = `
    salto {
      telemetry = {
        enabled = true
      }
    }`
    mockReadFile.mockResolvedValue(Buffer.from(bpFileContent, 'utf-8'))
    mockExists.mockResolvedValue(true)
    const appConfig = await conf.configFromDisk()
    expect(appConfig.installationID).toBeUndefined()
  })

  it('should disable telemetry if enabled and url is empty', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/exists/home'
    process.env.SALTO_TELEMETRY_URL = ''
    const bpFileContent = `
    salto {
      installationID = "1234"
      telemetry = {
        enabled = true
      }
    }`
    mockReadFile.mockResolvedValue(Buffer.from(bpFileContent, 'utf-8'))
    mockExists.mockResolvedValue(true)
    const appConfig = await conf.configFromDisk()
    expect(appConfig.telemetry.url).toEqual('')
    expect(appConfig.telemetry.enabled).toBeFalsy()
  })

  it('should fail when config is invalid', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/invalid/home'
    const bpFileContent = `
    salto {
      installationID: "1234"
      telemetry = {
        enabled = true
      }
    }`
    mockReadFile.mockResolvedValue(Buffer.from(bpFileContent, 'utf-8'))
    mockExists.mockResolvedValue(true)
    await expect(conf.configFromDisk()).rejects.toThrow()
  })
})
