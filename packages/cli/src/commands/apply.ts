import * as sourceMapSupport from 'source-map-support'
import { apply, PlanItem, Workspace, loadConfig } from 'salto'
import { createCommandBuilder } from '../command_builder'
import {
  CliCommand, CliOutput, ParsedCliInput, WriteStream,
} from '../types'
import {
  formatItemStart, formatItemInProgress, formatItemDone, formatMetrics,
} from '../formatter'
import { shouldApply, getConfigFromUser } from '../callbacks'
import MetricsCollector from '../metrics-collector'


const CURRENT_ACTION_POLL_INTERVAL = 5000

export class ApplyCommand implements CliCommand {
  readonly stdout: WriteStream
  readonly stderr: WriteStream
  private currentAction: PlanItem | undefined
  private currentActionStartTime: Date | undefined
  private currentActionPollerID: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly workspaceDir: string,
    readonly force: boolean,
    { stdout, stderr }: CliOutput
  ) {
    this.stdout = stdout
    this.stderr = stderr
  }

  endCurrentAction(): void {
    if (this.currentActionPollerID && this.currentAction && this.currentActionStartTime) {
      clearInterval(this.currentActionPollerID)
      this.stdout.write(formatItemDone(this.currentAction, this.currentActionStartTime))
    }
    this.currentAction = undefined
  }

  pollCurrentAction(): void {
    if (this.currentActionStartTime && this.currentAction) {
      this.stdout.write(
        formatItemInProgress(this.currentAction, this.currentActionStartTime)
      )
    }
  }

  updateCurrentAction(action: PlanItem): void {
    this.endCurrentAction()
    this.currentAction = action
    this.currentActionStartTime = new Date()
    this.stdout.write(formatItemStart(action))
    this.currentActionPollerID = setInterval(this.pollCurrentAction, CURRENT_ACTION_POLL_INTERVAL)
  }

  async execute(): Promise<void> {
    const config = await loadConfig(this.workspaceDir)
    try {
      const workspace: Workspace = await Workspace.load(config)
      const metrics = new MetricsCollector()
      const result = await apply(workspace,
        getConfigFromUser,
        shouldApply({ stdout: this.stdout, stderr: this.stderr }),
        (action: PlanItem) => this.updateCurrentAction(action), this.force,
        metrics)
      this.endCurrentAction()
      if (result.sucesses) {
        this.stdout.write(formatMetrics(metrics.getAll()))
      }
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
  'workspace-dir': string
   yes: boolean
}
type ApplyParsedCliInput = ParsedCliInput<ApplyArgs>

const applyBuilder = createCommandBuilder({
  options: {
    command: 'apply',
    aliases: ['a'],
    description: 'Applies changes to the target services',
    keyed: {
      yes: {
        describe: 'Do not ask for approval before applying',
        boolean: true,
      },
      'workspace-dir': {
        alias: 'w',
        describe: 'Path to the workspace directory',
        default: '.',
        string: true,
        requiresArg: true,
      },
    },
  },

  async build(input: ApplyParsedCliInput, output: CliOutput): Promise<CliCommand> {
    return new ApplyCommand(input.args['workspace-dir'], input.args.yes, output)
  },
})

export default applyBuilder
