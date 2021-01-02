/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { createAction, setAction, currentAction, listAction, deleteAction, renameAction } from '../../src/commands/env'
import { CliExitCode, CliTelemetry } from '../../src/types'

jest.mock('@salto-io/core')
describe('env command group', () => {
  let output: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const config = { shouldCalcTotalSize: true }
  let cliTelemetry: CliTelemetry

  beforeEach(async () => {
    output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    jest.spyOn(core, 'loadLocalWorkspace').mockImplementation(
      baseDir => Promise.resolve(mocks.mockLoadWorkspace(baseDir))
    )
  })

  describe('create command', () => {
    it('should create a new environment', async () => {
      await createAction({
        input: {
          envName: 'new-env',
        },
        output,
        config,
        cliTelemetry,
      })
      expect(output.stdout.content.search('new-env')).toBeGreaterThan(0)
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
        await createAction({
          input: {
            envName: 'me2',
          },
          output,
          config,
          cliTelemetry,
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledTimes(1)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledWith('me1')
        expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should prompt on 2nd environment creation, and isolate if true', async () => {
        jest.spyOn(callbacks, 'cliApproveIsolateBeforeMultiEnv').mockImplementationOnce(
          () => Promise.resolve(true)
        )

        await createAction({
          input: {
            envName: 'me2',
          },
          output,
          config,
          cliTelemetry,
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledTimes(1)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledWith('me1')
        expect(lastWorkspace.demoteAll).toHaveBeenCalled()
      })

      it('should not prompt if force=true and acceptSuggestions=false, and do nothing', async () => {
        await createAction({
          input: {
            envName: 'me2',
            force: true,
            yesAll: false,
          },
          output,
          config,
          cliTelemetry,
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should isolate without prompting if acceptSuggestions=true', async () => {
        await createAction({
          input: {
            envName: 'me2',
            yesAll: true,
          },
          output,
          config,
          cliTelemetry,
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(lastWorkspace.demoteAll).toHaveBeenCalled()
      })
      it('should isolate without prompting if acceptSuggestions=true and force=true', async () => {
        await createAction({
          input: {
            envName: 'me2',
            force: true,
            yesAll: true,
          },
          output,
          config,
          cliTelemetry,
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(lastWorkspace.demoteAll).toHaveBeenCalled()
      })

      it('should not prompt on 2nd environment creation if workspace is empty', async () => {
        jest.spyOn(core, 'loadLocalWorkspace').mockImplementationOnce(baseDir => {
          lastWorkspace = mocks.mockLoadWorkspace(baseDir, ['me1'], true)
          return Promise.resolve(lastWorkspace)
        })

        await createAction({
          input: {
            envName: 'me2',
          },
          output,
          config,
          cliTelemetry,
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should not prompt on 2nd environment creation if env1 folder exists', async () => {
        jest.spyOn(core, 'envFolderExists').mockImplementationOnce(() => Promise.resolve(true))

        await createAction({
          input: {
            envName: 'me2',
          },
          output,
          config,
          cliTelemetry,
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should not prompt on 3rd environment creation', async () => {
        jest.spyOn(core, 'loadLocalWorkspace').mockImplementationOnce(baseDir => {
          lastWorkspace = mocks.mockLoadWorkspace(baseDir, ['me1', 'me2'], true)
          return Promise.resolve(lastWorkspace)
        })

        await createAction({
          input: {
            envName: 'me3',
          },
          output,
          config,
          cliTelemetry,
        })
        expect(output.stdout.content.search('me3')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(lastWorkspace.demoteAll).not.toHaveBeenCalled()
      })
    })
  })

  describe('set command', () => {
    it('should set an environment', async () => {
      await setAction({
        input: {
          envName: 'active',
        },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stdout.content.search('active')).toBeGreaterThan(0)
    })
  })

  describe('current command', () => {
    it('should display the current environment', async () => {
      await currentAction({
        input: {},
        output,
        cliTelemetry,
        config,
      })
      expect(output.stdout.content.search('active')).toBeGreaterThan(0)
    })
  })

  describe('list command', () => {
    it('should list all environments', async () => {
      await listAction({
        input: {},
        output,
        cliTelemetry,
        config,
      })
      expect(output.stdout.content.search('active')).toBeGreaterThan(0)
      expect(output.stdout.content.search('inactive')).toBeGreaterThan(0)
    })
  })

  describe('delete command', () => {
    it('should display the deleted environment', async () => {
      await deleteAction({
        input: {
          envName: 'inactive',
        },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stdout.content.search('inactive')).toBeGreaterThan(0)
    })
  })

  describe('rename command', () => {
    it('should display renamed environment', async () => {
      const result = await renameAction({
        input: {
          oldName: 'inactive',
          newName: 'new-inactive',
        },
        output,
        cliTelemetry,
        config,
      })
      expect(result).toBe(CliExitCode.Success)
      expect(output.stdout.content.search('inactive')).toBeGreaterThan(0)
      expect(output.stdout.content.search('new-inactive')).toBeGreaterThan(0)
    })
  })
})
