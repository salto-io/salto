import _ from 'lodash'
import { YargsCommandBuilder, allBuilders } from '../../src/cli/builder'
import realCli from '../../src/cli/cli'

export interface MockWriteStreamOpts { isTTY?: boolean; hasColors?: boolean }

export class MockWriteStream {
  constructor({ isTTY = true, hasColors = true }: MockWriteStreamOpts = {}) {
    this.isTTY = isTTY
    this.colors = hasColors
  }

  content = ''
  colors: boolean
  isTTY: boolean

  write(s: string): void { this.content += s }
  hasColors(): boolean { return this.colors }
}

export interface MockCliOutput {
  err: string
  out: string
  exitCode: number
}

export const cli = async ({
  builders = allBuilders,
  args = [],
  out = {},
  err = {},
}: {
  builders?: YargsCommandBuilder[]
  args?: string[] | string
  out?: MockWriteStreamOpts
  err?: MockWriteStreamOpts
} = {}): Promise<MockCliOutput> => {
  const input = {
    args: _.isArray(args) ? args : args.split(' '),
    stdin: {},
  }

  const output = {
    stderr: new MockWriteStream(err),
    stdout: new MockWriteStream(out),
  }

  const exitCode = await realCli(input, output, builders)

  return { err: output.stderr.content, out: output.stdout.content, exitCode }
}
