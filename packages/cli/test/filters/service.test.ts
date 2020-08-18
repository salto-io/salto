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
import { MockCliOutput, cli, mockLoadWorkspace } from '../mocks'
import { servicesFilter, serviceCmdFilter } from '../../src/filters/service'


jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  loadLocalWorkspace: jest.fn().mockImplementation(() => mockLoadWorkspace('name')),
}))
describe('services filter', () => {
  let out: MockCliOutput
  let buildFunc: jest.Mock
  let builder: YargsCommandBuilder

  describe('verify services filter', () => {
    beforeEach(async () => {
      buildFunc = jest.fn(() =>
        Promise.resolve({ execute: () => Promise.resolve(CliExitCode.Success) })) as jest.Mock
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

        filters: [servicesFilter],

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
      describe('when services option is not used', () => {
        beforeEach(async () => {
          await runCli('t --test-opt')
        })

        it('services should be workspace services', () => {
          expect(buildFunc.mock.calls[0][0]).toEqual(
            expect.objectContaining({
              args: {
                $0: 'salto',
                _: ['t'],
                services: ['salesforce', 'hubspot'],
                'test-opt': true,
                testOpt: true,
              },
            })
          )
        })
      })

      describe('when called with a service that exists', () => {
        beforeEach(async () => {
          await runCli('t --test-opt -s salesforce')
        })

        it('services should be inputted services', () => {
          expect(buildFunc.mock.calls[0][0]).toEqual(
            expect.objectContaining({
              args:
              {
                $0: 'salto',
                _: ['t'],
                s: ['salesforce'],
                services: ['salesforce'],
                'test-opt': true,
                testOpt: true,
              },
            })
          )
        })
      })

      describe('when called with a service that is not configured', () => {
        beforeEach(async () => {
          out = await runCli('t --test-opt -s abcdefg')
        })

        it('should fail with services not configured error', async () => {
          expect(out.err).toMatch('Not all services (abcdefg) are set up for this workspace')
        })
      })
    })
  })
  describe('verify service cmd filter', () => {
    beforeEach(async () => {
      buildFunc = jest.fn(() =>
        Promise.resolve({ execute: () => Promise.resolve(CliExitCode.Success) })) as jest.Mock
      builder = createCommandBuilder({
        options: {
          command: 'service <command> [name]',
          description: 'tests the command parser',
        },
        filters: [serviceCmdFilter],
        build: buildFunc,
      })
    })

    const runCli = (args: string): Promise<MockCliOutput> =>
      cli({
        commandBuilders: [builder] as YargsCommandBuilder[],
        args,
      })
    describe('should fail when commands called incorrectly', () => {
      it('fail with add', async () => {
        out = await runCli('service add')
        expect(out.err).toMatch('Error: Missing required argument: name\n\nExample usage: \'salto service add salesforce\'')
      })
      it('fail with login', async () => {
        out = await runCli('service login')
        expect(out.err).toMatch('Error: Missing required argument: name\n\nExample usage: \'salto service login salesforce\'')
      })
      describe('Should succeed', () => {
        it('succeed with add', async () => {
          out = await runCli('service add sales force')
          expect(out.err).toMatch('')
        })
      })
    })
  })
})
