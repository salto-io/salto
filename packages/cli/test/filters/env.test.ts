import { createCommandBuilder, YargsCommandBuilder } from '../../src/command_builder'
import { CliExitCode } from '../../src/types'
import { envsCmdFilter } from '../../src/filters/env'
import { MockCliOutput, cli } from '../mocks'

describe('test env command filter', () => {
  let builder: YargsCommandBuilder
  let buildFunc: jest.Mock

  const runCli = (args: string): Promise<MockCliOutput> => (
    cli({ commandBuilders: [builder] as YargsCommandBuilder[], args })
  )

  beforeEach(async () => {
    buildFunc = jest.fn(() =>
      Promise.resolve({ execute: () => Promise.resolve(CliExitCode.Success) })) as jest.Mock

    builder = createCommandBuilder({
      options: {
        command: 'env [command] [name]',
        description: 'tests the env command filter',
      },
      filters: [envsCmdFilter],
      build: buildFunc,
    })
  })

  it('should forward the command when command is undefined', async () => {
    await runCli('env')
    expect(buildFunc.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        args: {
          $0: 'salto',
          _: ['env'],
        },
        stdin: {},
      })
    )
  })

  it('should fail on an unknown command', async () => {
    const output = await runCli('env unknown')
    expect(output.err.search('Choices: "create", "set", "list"')).toBeGreaterThan(0)
  })

  describe('set env', () => {
    it('should pass the name paramter to the set command', async () => {
      await runCli('env set name')
      expect(buildFunc.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          args: {
            $0: 'salto',
            _: ['env'],
            command: 'set',
            name: 'name',
          },
          stdin: {},
        })
      )
    })
    it('should fail when the name paramter is not provided to the set command', async () => {
      const output = await runCli('env set')
      expect(output.err.search('Missing required')).toBeGreaterThan(0)
    })
  })

  describe('create env', () => {
    it('should pass the name paramter to the create command', async () => {
      await runCli('env create name')
      expect(buildFunc.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          args: {
            $0: 'salto',
            _: ['env'],
            command: 'create',
            name: 'name',
          },
          stdin: {},
        })
      )
    })
    it('should fail when the name paramter is not provided to the create command', async () => {
      const output = await runCli('env create')
      expect(output.err.search('Missing required')).toBeGreaterThan(0)
    })
  })

  describe('list envs', () => {
    it('should invoke the list command then no name is provided', async () => {
      await runCli('env list')
      expect(buildFunc.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          args: {
            $0: 'salto',
            _: ['env'],
            command: 'list',
          },
          stdin: {},
        })
      )
    })
    it('should fail when name is provided to the list command', async () => {
      const output = await runCli('env list what')
      expect(output.err.search('Unknown argument')).toBeGreaterThan(0)
    })
  })
})
