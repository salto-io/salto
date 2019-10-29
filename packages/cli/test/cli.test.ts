import { logger } from '@salto/logging'
import * as mocks from './mocks'
import applyBuilder from '../src/commands/apply'
import { CliExitCode } from '../src/types'

describe('cli', () => {
  let o: mocks.MockCliOutput

  jest.setTimeout(200)
  const noArgsTests = (args: string | string[]): void => {
    describe('when stderr is TTY with colors', () => {
      beforeEach(async () => {
        o = await mocks.cli({ args })
      })

      it('outputs the salto logo', () => {
        expect(o.err).toContain('| () |')
      })

      it('outputs help to stderr', () => {
        expect(o.err).toMatch(/\bCommands\b/)
        expect(o.err).toMatch(/\bapply\b/)
      })

      it('exits with code 1 (user input error)', () => {
        expect(o.exitCode).toEqual(CliExitCode.UserInputError)
      })
    })

    describe('when stderr is not TTY', () => {
      beforeEach(async () => {
        o = await mocks.cli({ args, err: { isTTY: false } })
      })

      it('does not output the salto logo', () => {
        expect(o.err).not.toContain('|\\   ____\\|\\')
      })

      it('outputs help to stderr', () => {
        expect(o.err).toMatch(/\bCommands\b/)
        expect(o.err).toMatch(/\bapply\b/)
      })

      it('exits with code 1', () => {
        expect(o.exitCode).toEqual(1)
      })
    })

    describe('when stderr is TTY without colors', () => {
      beforeEach(async () => {
        o = await mocks.cli({ args, err: { hasColors: false } })
      })

      it('does not use colors', () => {
        expect(o.err).not.toMatch('\u001B')
      })
    })
  }

  describe('when called with no arguments', () => {
    noArgsTests('')
  })

  describe('when called with only --verbose', () => {
    noArgsTests('--verbose')
  })

  describe('when called with --help', () => {
    beforeEach(async () => {
      o = await mocks.cli({ args: '--help' })
    })

    it('outputs help to stdout', () => {
      expect(o.out).toMatch(/apply/)
      expect(o.out).toMatch('help')
    })

    it('exits with code 0', () => {
      expect(o.exitCode).toEqual(0)
    })
  })

  describe('when called with --version', () => {
    beforeEach(async () => {
      o = await mocks.cli({ args: '--version' })
    })

    it('outputs the version to stdout', () => {
      expect(o.out).toMatch(/version \d+\.\d+\.\d+/)
    })

    it('exits with code 0', () => {
      expect(o.exitCode).toEqual(0)
    })
  })

  describe('when called with an invalid command', () => {
    beforeEach(async () => {
      o = await mocks.cli({ args: 'nosuchcommand' })
    })

    it('outputs an error message to stderr', () => {
      expect(o.err).toMatch(/Unknown argument: nosuchcommand/)
      expect(o.err).toMatch(/--help/)
    })

    it('exits with code 1', () => {
      expect(o.exitCode).toEqual(1)
    })
  })

  describe('when called with a valid command argument', () => {
    let applyCommand: jest.Mock<Promise<CliExitCode>>

    beforeEach(async () => {
      applyCommand = jest.fn<Promise<CliExitCode>>().mockImplementation(() => CliExitCode.Success)
      jest.spyOn(applyBuilder, 'build').mockResolvedValue({ execute: applyCommand })
      o = await mocks.cli({ args: 'apply --yes' })
    })

    it('calls the command handler', () => {
      expect(applyCommand).toHaveBeenCalled()
    })

    it('exits with code 0 (success)', () => {
      expect(o.exitCode).toEqual(CliExitCode.Success)
    })
  })

  describe('when command execution fails ', () => {
    let applyCommand: jest.Mock<Promise<CliExitCode>>

    beforeEach(async () => {
      applyCommand = jest.fn<Promise<CliExitCode>>().mockImplementation(() => CliExitCode.AppError)
      jest.spyOn(applyBuilder, 'build').mockResolvedValue({ execute: applyCommand })
      o = await mocks.cli({ args: 'apply --yes' })
    })

    it('calls the command handler', () => {
      expect(applyCommand).toHaveBeenCalled()
    })

    it('exits with code 2 (app error)', () => {
      expect(o.exitCode).toEqual(CliExitCode.AppError)
    })
  })

  describe('when command execution throws error ', () => {
    let applyCommand: jest.Mock<Promise<CliExitCode>>

    beforeEach(async () => {
      applyCommand = jest.fn<Promise<CliExitCode>>().mockImplementation(() => { throw new Error('blabla') })
      jest.spyOn(applyBuilder, 'build').mockResolvedValue({ execute: applyCommand })
      o = await mocks.cli({ args: 'apply --yes' })
    })

    it('calls the command handler', () => {
      expect(applyCommand).toHaveBeenCalled()
    })

    it('exits with code 2 (app error)', () => {
      expect(o.exitCode).toEqual(CliExitCode.AppError)
    })
  })


  describe('when called with --verbose', () => {
    let configure: jest.SpyInstance

    beforeEach(async () => {
      configure = jest.spyOn(logger, 'configure')
      await mocks.cli({ args: 'apply --yes --verbose' })
    })

    it('configures the logging to level info', () => {
      expect(configure).toHaveBeenCalledWith({ minLevel: 'info' })
    })
  })

  describe('when called with "completion"', () => {
    beforeEach(async () => {
      o = await mocks.cli({ args: 'completion' })
    })

    it('outputs a completion script', () => {
      expect(o.out).toMatch(/begin-[^-]+-completions/)
    })

    it('exits with code 0 (success)', () => {
      expect(o.exitCode).toEqual(CliExitCode.Success)
    })
  })
})
