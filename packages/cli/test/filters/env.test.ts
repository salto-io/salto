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
import { createCommandBuilder, YargsCommandBuilder } from '../../src/command_builder'
import { CliExitCode } from '../../src/types'
import { MockCliOutput, mockLoadConfig, cli } from '../mocks'
import { environmentFilter } from '../../src/filters/env'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) => mockLoadConfig(workspaceDir)),
}))

describe('environment filter', () => {
  let out: MockCliOutput
  let buildFunc: jest.Mock
  let builder: YargsCommandBuilder

  beforeEach(async () => {
    buildFunc = jest.fn(() =>
      Promise.resolve({ execute: () => Promise.resolve(CliExitCode.Success) }))

    builder = createCommandBuilder({
      options: {
        command: 'testCommand',
        aliases: ['t'],
        description: 'tests the command parser',
        keyed: {
          'test-opt': {
            boolean: true,
            demandOption: true,
          },
        },
      },
      filters: [environmentFilter],
      build: buildFunc,
    })
  })

  const runCli = (args: string): Promise<MockCliOutput> =>
    cli({
      commandBuilders: [builder] as YargsCommandBuilder[],
      args,
    })

  describe('yargs configuration', () => {
    it('does not override the original options', async () => {
      out = await runCli('t .') // existing option 'test-opt' not specified
      expect(out.err).toMatch(/\bMissing required argument: test-opt\b/)
    })

    it('Shows the help option', async () => {
      expect(out.err).toMatch(/--help\b/)
    })
  })

  describe('command builder', () => {
    describe('when environment option is not used', () => {
      beforeEach(async () => {
        await runCli('t --test-opt')
      })
      it('environment var should not be in options', () => {
        expect(buildFunc.mock.calls[0][0]).toEqual(
          expect.objectContaining({
            args: {
              $0: 'salto',
              _: ['t'],
              'test-opt': true,
              testOpt: true,
            },
          })
        )
      })
    })

    describe('when called with a environment that exists', () => {
      const environment = 'active'
      beforeEach(async () => {
        await runCli(`t --test-opt --env ${environment}`)
      })

      it('services should be inputted services', () => {
        expect(buildFunc.mock.calls[0][0].args).toEqual(
          {
            $0: 'salto',
            _: ['t'],
            e: environment,
            env: environment,
            'test-opt': true,
            testOpt: true,
          },
        )
      })
    })

    describe('when called with a environment that is not configured', () => {
      const invalidEnv = 'abcdefg'
      beforeEach(async () => {
        out = await runCli(`t --test-opt -e ${invalidEnv}`)
      })

      it('should fail with environment not configured', async () => {
        expect(out.err).toMatch(`Error: Environment ${invalidEnv} isn't configured. Use salto env create.`)
      })
    })
  })
})
