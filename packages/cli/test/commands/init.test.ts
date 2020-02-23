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
import { Config, AppConfig } from '@salto-io/core'
import * as mocks from '../mocks'
import { command } from '../../src/commands/init'

jest.mock('@salto-io/core', () => ({
  init: jest.fn().mockImplementation(
    (_conf: AppConfig, _defaultEnvName: string, workspaceName: string): { config: Config } => {
      if (workspaceName === 'error') throw new Error('failed')
      return {
        config: {
          name: workspaceName,
          localStorage: '',
          baseDir: '',
          uid: '',
          envs: {
            default: {
              baseDir: '',
              config: {
                stateLocation: '',
                credentialsLocation: 'credentials',
                services: ['salesforce'],
              },
            },
          },
          currentEnv: 'default',
        },
      }
    }
  ),
}))

const config: AppConfig = { installationID: '1234' }

describe('describe command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }

  beforeEach(async () => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
  })

  it('should invoke api\'s init', async () => {
    await command('test', config, cliOutput, mocks.createMockEnvNameGetter()).execute()
    expect(cliOutput.stdout.content.search('test')).toBeGreaterThan(0)
  })

  it('should print errors', async () => {
    await command('error', config, cliOutput, mocks.createMockEnvNameGetter()).execute()
    expect(cliOutput.stderr.content.search('failed')).toBeGreaterThan(0)
  })
})
