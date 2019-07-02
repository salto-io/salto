import chalk from 'chalk'
import { PlanActionType } from 'adapter-api'

export default class Prompts {
  public static readonly PLANNEDFORAPPLY = ''
  public static readonly STARTAPPLY = 'Salto-cli will start the apply step'
  public static readonly EXPLAINAPPLY =
    "You know what this is all about don't you?!"

  public static readonly SHOULDEXECUTREPLAN = 'Do you to perform these actions?'

  public static readonly STARTAPPLYEXEC = 'Starting the apply phase'
  public static readonly CANCELAPPLY = 'Canceling apply'
  public static readonly STARTPLAN =
    'Refreshing Salto state in-memory prior to plan...'

  public static readonly EXPLAINPLAN = `The refreshed state will be used to calculate this plan,
but will not be persisted to local or remote state storage`
  public static readonly PLANNEDFORPLAN = ''
  public static readonly MODIFIERS = {
    [PlanActionType.MODIFY]: chalk.yellow('M'),
    [PlanActionType.ADD]: chalk.green('+'),
    [PlanActionType.REMOVE]: chalk.red('-'),
  }

  public static readonly STARTACTION = {
    [PlanActionType.MODIFY]: 'changing',
    [PlanActionType.ADD]: 'creating',
    [PlanActionType.REMOVE]: 'removing',
  }

  public static readonly ENDACTION = {
    [PlanActionType.MODIFY]: 'Change',
    [PlanActionType.ADD]: 'Creation',
    [PlanActionType.REMOVE]: 'Removal',
  }

  public static readonly EXPLAINPLANRESULT = `An execution plan has been generated and is show below.
Resources and actions are indicated with the following symbols:

  ${Prompts.MODIFIERS[PlanActionType.ADD]} create
  ${Prompts.MODIFIERS[PlanActionType.MODIFY]} change
  ${Prompts.MODIFIERS[PlanActionType.REMOVE]} remove

Salto will perform the following action:`

  public static readonly PLANDISCLAIMER = `Note: You did not choose the apply option to execute the plan, so Salto can't guarantee that 
exactly these actions will be performed if "Salto apply" is run. Be sure to go over the plan 
output when invoking the apply command.
`

  public static readonly DESCRIBE_NEAR_MATCH =
    'Could not find what you were looking for.'

  public static readonly DID_YOU_MEAN = 'Did you mean'
  public static readonly DESCRIBE_NOT_FOUND = 'Unknown element type.'
}
