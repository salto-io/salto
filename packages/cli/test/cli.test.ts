import * as mocks from './mocks'
import applyBuilder from '../src/commands/apply'

describe('cli', () => {
  let o: mocks.MockCliOutput

  jest.setTimeout(200)
  describe('when called with no arguments', () => {
    describe('when stderr is TTY with colors', () => {
      beforeEach(async () => {
        o = await mocks.cli()
      })

      it('outputs the salto logo', () => {
        expect(o.err).toContain('| () |')
      })

      it('outputs help to stderr', () => {
        expect(o.err).toMatch(/\bCommands\b/)
        expect(o.err).toMatch(/\bapply\b/)
      })

      it('exits with code 1', () => {
        expect(o.exitCode).toEqual(1)
      })
    })

    describe('when stderr is not TTY', () => {
      beforeEach(async () => {
        o = await mocks.cli({ err: { isTTY: false } })
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
  })

  describe('when stderr is TTY without colors', () => {
    beforeEach(async () => {
      o = await mocks.cli({ err: { hasColors: false } })
    })

    it('does not use colors', () => {
      expect(o.err).not.toMatch('\u001B')
    })
  })

  describe('when stderr is not TTY', () => {
    beforeEach(async () => {
      o = await mocks.cli({ err: { isTTY: false } })
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
      expect(o.out.trim()).toMatch(/\d+\.\d+\.\d+$/)
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
    let applyCommand: jest.Mock<Promise<void>>

    beforeEach(async () => {
      applyCommand = jest.fn<Promise<void>>()
      jest.spyOn(applyBuilder, 'build').mockResolvedValue({ execute: applyCommand })
      o = await mocks.cli({ args: 'apply --yes' })
    })

    it('calls the command handler', () => {
      expect(applyCommand).toHaveBeenCalled()
    })

    it('exits with code 0', () => {
      expect(o.exitCode).toEqual(0)
    })
  })

  describe('when called with "completion"', () => {
    beforeEach(async () => {
      o = await mocks.cli({ args: 'completion' })
    })

    it('outputs a completion script', () => {
      expect(o.out).toMatch(/begin-[^-]+-completions/)
    })

    it('exits with code 0', () => {
      expect(o.exitCode).toEqual(0)
    })
  })
})
