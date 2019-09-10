import * as sourceMapSupport from 'source-map-support'
import { apply } from '../../core/commands'
import { PlanItem } from '../../core/plan'
import { createCommandBuilder } from '../builder'
import {
  CliCommand, CliOutput, ParsedCliInput, WriteStream,
} from '../types'
import { Blueprint } from '../../core/blueprint'
import * as bf from '../filters/blueprints'
import {
  createActionStartOutput, createActionInProgressOutput, createItemDoneOutput,
} from '../formatter'
import { getConfigFromUser, shouldApply } from '../callbacks'

const CURRENT_ACTION_POLL_INTERVAL = 5000

export class ApplyCommand implements CliCommand {
  readonly stdout: WriteStream
  readonly stderr: WriteStream
  private currentAction: PlanItem | undefined
  private currentActionStartTime: Date | undefined
  private currentActionPollerID: ReturnType<typeof setTimeout> | undefined
  constructor(readonly blueprints: Blueprint[], readonly force: boolean,
    { stdout, stderr }: CliOutput) {
    this.stdout = stdout
    this.stderr = stderr
  }

  endCurrentAction(): void {
    if (this.currentActionPollerID && this.currentAction && this.currentActionStartTime) {
      clearInterval(this.currentActionPollerID)
      this.stdout.write(createItemDoneOutput(this.currentAction, this.currentActionStartTime))
    }
    this.currentAction = undefined
  }

  pollCurentAction(): void {
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
    this.currentActionPollerID = setInterval(this.pollCurentAction, CURRENT_ACTION_POLL_INTERVAL)
  }

  async execute(): Promise<void> {
    try {
      await apply(this.blueprints, getConfigFromUser,
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

type ApplyArgs = bf.Args & { yes: boolean }
type ApplyParsedCliInput = ParsedCliInput<ApplyArgs> & bf.BlueprintsParsedCliInput

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
    },
  },

  filters: [bf.requiredFilter],

  async build(input: ApplyParsedCliInput, output: CliOutput): Promise<CliCommand> {
    return new ApplyCommand(input.blueprints, input.args.yes, output)
  },
})

export default builder
