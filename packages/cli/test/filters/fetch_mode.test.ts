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
import { MockCliOutput, cli } from '../mocks'
import { fetchModeFilter } from '../../src/filters/fetch_mode'

describe('fetch mode filter', () => {
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
      },
      filters: [fetchModeFilter],
      build: buildFunc,
    })
  })

  const runCli = (args: string): Promise<MockCliOutput> =>
    cli({
      commandBuilders: [builder] as YargsCommandBuilder[],
      args,
    })

  describe('command builder', () => {
    describe('when no flag is provided', () => {
      beforeEach(async () => {
        await runCli('t')
      })
      it('mode should be default', () => {
        expect(buildFunc.mock.calls[0][0].args.mode).toEqual('default')
      })
    })

    describe('when the align flag is provided', () => {
      beforeEach(async () => {
        await runCli('t --align')
      })
      it('mode should be align', () => {
        expect(buildFunc.mock.calls[0][0].args.mode).toEqual('align')
      })
    })

    describe('when the override flag is provided', () => {
      beforeEach(async () => {
        await runCli('t --override')
      })
      it('mode should be override', () => {
        expect(buildFunc.mock.calls[0][0].args.mode).toEqual('override')
      })
    })

    describe('when the isolated flag is provided', () => {
      beforeEach(async () => {
        await runCli('t --isolated')
      })
      it('mode should be isolated', () => {
        expect(buildFunc.mock.calls[0][0].args.mode).toEqual('isolated')
      })
    })

    describe('when called with multiple flags', () => {
      beforeEach(async () => {
        out = await runCli('t --align --isolated')
      })

      it('should fail with environment not configured', async () => {
        expect(out.err).toMatch('Can only provide one fetch mode flag.')
      })
    })
  })
})
