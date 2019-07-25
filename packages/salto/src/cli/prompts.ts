import chalk from 'chalk'

export default class Prompts {
  public static readonly PLANNEDFORAPPLY = ''
  public static readonly STARTAPPLY = 'Salto-cli will start the apply step'
  public static readonly EXPLAINAPPLY =
    "You know what this is all about don't you?!"

  public static readonly SHOULDEXECUTREPLAN = 'Do you want to perform these actions?'

  public static readonly STARTAPPLYEXEC = 'Starting the apply phase'
  public static readonly CANCELAPPLY = 'Canceling apply'
  public static readonly STARTPLAN =
    'Refreshing Salto state in-memory prior to plan...'

  public static readonly EXPLAINPLAN = `The refreshed state will be used to calculate this plan,
but will not be persisted to local or remote state storage`
  public static readonly PLANNEDFORPLAN = ''
  public static readonly MODIFIERS = {
    modify: chalk.yellow('M'),
    add: chalk.green('+'),
    remove: chalk.red('-'),
    eq: ' ',
  }

  public static readonly STARTACTION = {
    modify: 'changing',
    add: 'creating',
    remove: 'removing',
    eq: '',
  }

  public static readonly ENDACTION = {
    modify: 'Change',
    add: 'Creation',
    remove: 'Removal',
    eq: '',
  }

  public static readonly EXPLAINPLANRESULT = `An execution plan has been generated and is shown below.
Resources and actions are indicated with the following symbols:

  ${Prompts.MODIFIERS.add} create
  ${Prompts.MODIFIERS.modify} change
  ${Prompts.MODIFIERS.remove} remove

Salto will perform the following actions:`

  public static readonly PLANDISCLAIMER = `Note: You did not choose the apply option to execute the plan, so Salto cannot guarantee that 
exactly these actions will be performed if "Salto apply" is run. Be sure to go over the plan 
output when invoking the apply command.
`
  public static readonly EMPTY_PLAN = 'Nothing to do.'

  public static readonly DESCRIBE_NEAR_MATCH =
    'Could not find what you were looking for.'

  public static readonly DID_YOU_MEAN = 'Did you mean'
  public static readonly DESCRIBE_NOT_FOUND = 'Unknown element type.'
}
