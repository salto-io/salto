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
import { Workspace } from '@salto-io/workspace'
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import { command } from '../../src/commands/env'
import { CliExitCode } from '../../src/types'

jest.mock('@salto-io/core')
describe('env commands', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }

  beforeEach(async () => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    jest.spyOn(core, 'loadLocalWorkspace').mockImplementation(
      baseDir => Promise.resolve(mocks.mockLoadWorkspace(baseDir))
    )
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
      expect(await command('.', 'not-exist', cliOutput).execute()).toBe(CliExitCode.UserInputError)
      expect(cliOutput.stderr.content.length).toBeGreaterThan(0)
    })
  })

  describe('rename environment command', () => {
    it('should fail if no arguments were provided', async () => {
      await expect(await command('.', 'rename', cliOutput).execute())
        .toBe(CliExitCode.UserInputError)
    })

    it('should fail if only one argument was provided', async () => {
      await expect(await command('.', 'rename', cliOutput, 'active').execute())
        .toBe(CliExitCode.UserInputError)
    })

    it('should display renamed environment', async () => {
      await command('.', 'rename', cliOutput, 'inactive', 'new-inactive').execute()
      expect(cliOutput.stdout.content.search('inactive')).toBeGreaterThan(0)
      expect(cliOutput.stdout.content.search('new-inactive')).toBeGreaterThan(0)
    })
  })

  describe('create multiple environments', () => {
    let lastWorkspace: Workspace
    beforeEach(() => {
      jest.spyOn(core, 'loadLocalWorkspace').mockImplementation(baseDir => {
        lastWorkspace = mocks.mockLoadWorkspace(baseDir, ['me1'])
        return Promise.resolve(lastWorkspace)
      })
      jest.spyOn(callbacks, 'cliApproveIsolateBeforeMultiEnv').mockImplementation(
        () => Promise.resolve(false)
      )
      jest.spyOn(core, 'envFolderExists').mockImplementation(() => Promise.resolve(false))
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should prompt on 2nd environment creation, and do nothing if false', async () => {
      await command('.', 'create', cliOutput, 'me2').execute()
      expect(cliOutput.stdout.content.search('me2')).toBeGreaterThan(0)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledTimes(1)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledWith('me1')
      expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
    })

    it('should prompt on 2nd environment creation, and isolate if true', async () => {
      jest.spyOn(callbacks, 'cliApproveIsolateBeforeMultiEnv').mockImplementationOnce(
        () => Promise.resolve(true)
      )

      await command('.', 'create', cliOutput, 'me2').execute()
      expect(cliOutput.stdout.content.search('me2')).toBeGreaterThan(0)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledTimes(1)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledWith('me1')
      expect(lastWorkspace.demoteAll).toHaveBeenCalled()
    })

    it('should not prompt if force=true and acceptSuggestions=false, and do nothing', async () => {
      await command('.', 'create', cliOutput, 'me2', undefined, true).execute()
      expect(cliOutput.stdout.content.search('me2')).toBeGreaterThan(0)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
      expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
    })

    it('should isolate without prompting if acceptSuggestions=true', async () => {
      await command('.', 'create', cliOutput, 'me2', undefined, undefined, true).execute()
      expect(cliOutput.stdout.content.search('me2')).toBeGreaterThan(0)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
      expect(lastWorkspace.demoteAll).toHaveBeenCalled()
    })
    it('should isolate without prompting if acceptSuggestions=true and force=true', async () => {
      await command('.', 'create', cliOutput, 'me2', undefined, true, true).execute()
      expect(cliOutput.stdout.content.search('me2')).toBeGreaterThan(0)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
      expect(lastWorkspace.demoteAll).toHaveBeenCalled()
    })

    it('should not prompt on 2nd environment creation if workspace is empty', async () => {
      jest.spyOn(core, 'loadLocalWorkspace').mockImplementationOnce(baseDir => {
        lastWorkspace = mocks.mockLoadWorkspace(baseDir, ['me1'], true)
        return Promise.resolve(lastWorkspace)
      })

      await command('.', 'create', cliOutput, 'me2').execute()
      expect(cliOutput.stdout.content.search('me2')).toBeGreaterThan(0)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
      expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
    })

    it('should not prompt on 2nd environment creation if env1 folder exists', async () => {
      jest.spyOn(core, 'envFolderExists').mockImplementationOnce(() => Promise.resolve(true))

      await command('.', 'create', cliOutput, 'me2').execute()
      expect(cliOutput.stdout.content.search('me2')).toBeGreaterThan(0)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
      expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
    })

    it('should not prompt on 3rd environment creation', async () => {
      jest.spyOn(core, 'loadLocalWorkspace').mockImplementationOnce(baseDir => {
        lastWorkspace = mocks.mockLoadWorkspace(baseDir, ['me1', 'me2'], true)
        return Promise.resolve(lastWorkspace)
      })

      await command('.', 'create', cliOutput, 'me3').execute()
      expect(cliOutput.stdout.content.search('me3')).toBeGreaterThan(0)
      expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
      expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
    })
  })
})
