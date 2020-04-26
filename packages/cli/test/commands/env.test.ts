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
import * as core from '@salto-io/core'
import * as mocks from '../mocks'
import { command } from '../../src/commands/env'

jest.mock('@salto-io/core')
describe('env commands', () => {
  const mockLoadWorkspace = core.loadLocalWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(baseDir => mocks.mockLoadWorkspace(baseDir))
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

  describe('delete environment command', () => {
    it('should display the deleted environment', async () => {
      await command('.', 'delete', cliOutput, 'inactive').execute()
      expect(cliOutput.stdout.content.search('inactive')).toBeGreaterThan(0)
    })
  })

  describe('unknown environment command', () => {
    it('should throws exception upon unknown command', async () => {
      await expect(command('.', 'not-exist', cliOutput).execute()).rejects.toThrow()
    })
  })

  describe('rename environment command', () => {
    it('should fail if no arguments were provided', async () => {
      await expect(command('.', 'rename', cliOutput).execute()).rejects.toThrow()
    })

    it('should fail if only one argument was provided', async () => {
      await expect(command('.', 'rename', cliOutput, 'active').execute()).rejects.toThrow()
    })

    it('should fail if there is no such environment to rename', async () => {
      await expect(command('.', 'rename', cliOutput, 'not-exist', 'new-not-exist').execute())
        .rejects.toThrow()
    })

    it('should display renamed environment', async () => {
      await command('.', 'rename', cliOutput, 'inactive', 'new-inactive').execute()
      expect(cliOutput.stdout.content.search('inactive')).toBeGreaterThan(0)
      expect(cliOutput.stdout.content.search('new-inactive')).toBeGreaterThan(0)
    })
  })
})
