import * as sourceMapSupport from 'source-map-support'
import { apply, PlanItem, Workspace } from 'salto'
import { createCommandBuilder } from '../builder'
import {
  CliCommand, CliOutput, ParsedCliInput, WriteStream,
} from '../types'
import {
  createActionStartOutput, createActionInProgressOutput, createItemDoneOutput,
} from '../formatter'
import { shouldApply, getConfigFromUser } from '../callbacks'


const CURRENT_ACTION_POLL_INTERVAL = 5000

export class ApplyCommand implements CliCommand {
  readonly stdout: WriteStream
  readonly stderr: WriteStream
  private currentAction: PlanItem | undefined
  private currentActionStartTime: Date | undefined
  private currentActionPollerID: ReturnType<typeof setTimeout> | undefined

  constructor(
    readonly blueprintsDir: string,
    readonly blueprintFiles: string[] = [],
    readonly force: boolean,
    { stdout, stderr }: CliOutput
  ) {
    this.stdout = stdout
    this.stderr = stderr
    this.blueprintsDir = blueprintsDir
  }

  endCurrentAction(): void {
    if (this.currentActionPollerID && this.currentAction && this.currentActionStartTime) {
      clearInterval(this.currentActionPollerID)
      this.stdout.write(createItemDoneOutput(this.currentAction, this.currentActionStartTime))
    }
    this.currentAction = undefined
  }

  pollCurrentAction(): void {
    if (this.currentActionStartTime && this.currentAction) {
      this.stdout.write(
        createActionInProgressOutput(this.currentAction, this.currentActionStartTime)
      )
    }
  }

  updateCurrentAction(action: PlanItem): void {
    this.endCurrentAction()
    this.currentAction = action
    this.currentActionStartTime = new Date()
    this.stdout.write(createActionStartOutput(action))
    this.currentActionPollerID = setInterval(this.pollCurrentAction, CURRENT_ACTION_POLL_INTERVAL)
  }

  async execute(): Promise<void> {
    try {
      const workspace: Workspace = await Workspace.load(this.blueprintsDir, this.blueprintFiles)
      await apply(workspace,
        getConfigFromUser,
        shouldApply({ stdout: this.stdout, stderr: this.stderr }),
        (action: PlanItem) => this.updateCurrentAction(action), this.force)
      this.endCurrentAction()
    } catch (e) {
      this.endCurrentAction()
      const errorSource = sourceMapSupport.getErrorSource(e)
      if (errorSource) {
        this.stderr.write(errorSource)
      }
      this.stderr.write(e.stack || e)
    }
  }
}

type ApplyArgs = {
  blueprint: string[]
  'blueprints-dir': string
   yes: boolean
}
type ApplyParsedCliInput = ParsedCliInput<ApplyArgs>

const builder = createCommandBuilder({
  options: {
    command: 'apply',
    aliases: ['a'],
    description: 'Applies changes to the target services',
    keyed: {
      yes: {
        describe: 'Do not ask for approval before applying',
        boolean: true,
      },
      'blueprints-dir': {
        alias: 'd',
        describe: 'Path to directory containing blueprint (.bp) files',
        demandOption: false,
        string: true,
        requiresArg: true,
      },
      blueprint: {
        alias: 'b',
        describe: 'Path to input blueprint file. This option can be specified multiple times',
        demandOption: false,
        array: true,
        requiresArg: true,
      },
    },
  },

  async build(input: ApplyParsedCliInput, output: CliOutput): Promise<CliCommand> {
    return new ApplyCommand(input.args['blueprints-dir'], input.args.blueprint, input.args.yes, output)
  },
})

export default builder
