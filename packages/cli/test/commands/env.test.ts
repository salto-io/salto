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
import * as mocks from '../mocks'
import { command } from '../../src/commands/env'
import * as workspace from '../../src/workspace/workspace'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  setCurrentEnv: jest.fn().mockImplementation(),
  addEnvToConfig: jest.fn().mockImplementation(),
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) =>
    mocks.mockLoadConfig(workspaceDir)),
}))

jest.mock('../../src/workspace/workspace')
describe('env commands', () => {
  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(baseDir => ({ workspace: mocks.mockLoadWorkspace(baseDir) }))
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }

  beforeEach(async () => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
  })

  describe('create environment command', () => {
    it('should create a new environment', async () => {
      await command('.', 'create', cliOutput, 'new-env').execute()
      expect(cliOutput.stdout.content.search('new-env')).toBeGreaterThan(0)
    })
  })

  describe('set environment command', () => {
    it('should set an environment', async () => {
      await command('.', 'set', cliOutput, 'active').execute()
      expect(cliOutput.stdout.content.search('active')).toBeGreaterThan(0)
    })
  })

  describe('current environment command', () => {
    it('should display the current environment', async () => {
      await command('.', 'current', cliOutput).execute()
      expect(cliOutput.stdout.content.search('active')).toBeGreaterThan(0)
    })
  })

  describe('list environment command', () => {
    it('should list all environments', async () => {
      await command('.', 'list', cliOutput).execute()
      expect(cliOutput.stdout.content.search('active')).toBeGreaterThan(0)
      expect(cliOutput.stdout.content.search('inactive')).toBeGreaterThan(0)
    })
  })
})
