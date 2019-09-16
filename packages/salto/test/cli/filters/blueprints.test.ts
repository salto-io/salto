import { createCommandBuilder, YargsCommandBuilder } from '../../../src/cli/builder'
import * as blueprintsImpl from '../../../src/core/blueprint'
import * as bf from '../../../src/cli/filters/blueprints'
import * as mocks from '../mocks'

describe('blueprint filter', () => {
  jest.setTimeout(200)

  let out: mocks.MockCliOutput
  const buildFunc = jest.fn(() => Promise.resolve({ execute: () => Promise.resolve() }))

  const builder = createCommandBuilder({
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

    filters: [bf.requiredFilter],

    build: buildFunc,
  })

  const runCli = (args: string): Promise<mocks.MockCliOutput> =>
    mocks.cli({
      builders: [builder] as YargsCommandBuilder[],
      args,
    })

  const testBlueprintArray: blueprintsImpl.Blueprint[] = []
  let blueprintsLoader: jest.MockInstance<unknown>

  beforeEach(() => {
    blueprintsLoader = jest.spyOn(blueprintsImpl, 'loadBlueprints').mockImplementation(() => Promise.resolve(testBlueprintArray))
  })

  describe('yargs configuration', () => {
    it('does not override the original options', async () => {
      out = await runCli('t -b .') // existing option 'test-opt' not specified
      expect(out.err).toMatch(/\bMissing required argument: test-opt\b/)
    })

    describe('when neither one of "blueprint" and "blueprints-dir" is specified', () => {
      beforeEach(async () => {
        out = await runCli('t --test-opt')
      })

      it('Prints an error message to stderr', async () => {
        expect(out.err).toMatch(/\bMust specify at least one of: blueprint, blueprints-dir\b/)
      })

      it('Shows the help option', async () => {
        expect(out.err).toMatch(/--help\b/)
      })
    })
  })

  describe('command builder', () => {
    describe('when only the "blueprint" option is specified', () => {
      beforeEach(async () => {
        await runCli('t --test-opt -b ./myPath/myBlueprints')
      })

      it('loads the blueprints from the specified paths', () => {
        expect(blueprintsLoader).toHaveBeenCalledWith(['./myPath/myBlueprints'], undefined)
      })

      it('reads the blueprints and adds it to the builder input', () => {
        expect(buildFunc.mock.calls[0][0]).toEqual(
          expect.objectContaining({ blueprints: testBlueprintArray }),
        )
      })
    })

    describe('when only the "blueprints-dir" option is specified', () => {
      beforeEach(async () => {
        await runCli('t --test-opt -d ./myPath/myBlueprints')
      })

      it('loads the blueprints from the specified paths', () => {
        expect(blueprintsLoader).toHaveBeenCalledWith([], './myPath/myBlueprints')
      })

      it('reads the blueprints and adds it to the builder input', () => {
        expect(buildFunc.mock.calls[0][0]).toEqual(
          expect.objectContaining({ blueprints: testBlueprintArray }),
        )
      })
    })

    describe('when both the "blueprint" and "blueprints-dir" options are specified', () => {
      beforeEach(async () => {
        await runCli('t --test-opt -b ./myPath/myFile.bp -d ./myPath/myBlueprints')
      })

      it('loads the blueprints from the specified paths', () => {
        expect(blueprintsLoader).toHaveBeenCalledWith(['./myPath/myFile.bp'], './myPath/myBlueprints')
      })

      it('reads the blueprints and adds it to the builder input', () => {
        expect(buildFunc.mock.calls[0][0]).toEqual(
          expect.objectContaining({ blueprints: testBlueprintArray }),
        )
      })
    })
  })
})
