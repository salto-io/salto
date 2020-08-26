/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import chalk from 'chalk'
import moment from 'moment'

export default class Prompts {
  public static readonly SHOULD_EXECUTE_PLAN = 'Do you want to perform these actions?'

  public static readonly CANCEL_DEPLOY_ACTION = 'Cancelled: Due to an erroneous dependency -'
  public static readonly START_DEPLOY_EXEC = 'Starting the deployment plan'
  public static readonly FULL_DEPLOY_SUMMARY = (numChanges: number, numErrors: number): string => `Deployment partially succeeded with ${numChanges} applied change(s) and ${numErrors} error(s).`
  public static readonly CHANGES_DEPLOY_SUMMARY = (numChanges: number): string => `Deployment succeeded - ${numChanges} applied change(s).`
  public static readonly ERRORS_DEPLOY_SUMMARY = (numErrors: number): string => `Deployment failed with ${numErrors} error(s).`
  public static readonly CANCEL_DEPLOY = 'Cancelling deploy'
  public static readonly MODIFIERS = {
    modify: chalk.yellow('M'),
    add: chalk.green('+'),
    remove: chalk.red('-'),
    eq: '|',
  }

  public static readonly START_ACTION = {
    modify: 'Changing',
    add: 'Creating',
    remove: 'Removing',
    eq: '',
  }

  public static readonly END_ACTION = {
    modify: 'Change',
    add: 'Creation',
    remove: 'Removal',
    eq: '',
  }

  public static readonly EXPLAIN_PREVIEW_RESULT = `Resources and actions are indicated with the following symbols:

  ${Prompts.MODIFIERS.add} create
  ${Prompts.MODIFIERS.modify} change
  ${Prompts.MODIFIERS.remove} remove`

  public static readonly PLAN_STEPS_HEADER_DEPLOY = 'Salto will perform the following actions:'
  public static readonly PLAN_STEPS_HEADER_PREVIEW = 'Salto has calculated the following deployment plan:'
  public static readonly PLAN_CHANGE_ERRS_HEADER = 'Encountered the following validations and will ignore their execution:'

  public static readonly EMPTY_PLAN = 'Nothing to do.'

  public static readonly DESCRIBE_NEAR_MATCH =
    'Could not find what you were looking for.'

  public static readonly DID_YOU_MEAN = 'Did you mean'
  public static readonly DESCRIBE_NOT_FOUND = 'Unknown element type.'

  public static initFailed(msg: string): string {
    return `Could not initiate workspace: ${msg}\n`
  }

  private static readonly SERVICE_ADD_HELP = 'Use `salto service add <service-name>` to add services to the environment'

  public static initCompleted(name: string, baseDir: string): string {
    return `Initiated empty workspace ${name} at ${baseDir}

${Prompts.SERVICE_ADD_HELP}
`
  }

  public static readonly FETCH_HEADER = 'Fetching and applying changes from the service(s)'
  public static readonly FETCH_SUB_HEADER = `This might take a few minutes. You can go grab your favorite beverage.
The steps are: I. Fetching configs, II. Calculating difference and III. Applying the changes`
  public static readonly FETCH_GET_CHANGES_START = (adapters: string[]): string => `Fetching the latest configs from: ${adapters}`
  public static readonly FETCH_GET_CHANGES_FINISH = (adapters: string[]): string => `Finished fetching the latest configs from: ${adapters}`
  public static readonly FETCH_GET_CHANGES_FAIL = 'Fetching failed'
  public static readonly FETCH_CALC_DIFF_START = 'Calculating the difference between local and remote'
  public static readonly FETCH_CALC_DIFF_FINISH = 'Finished calculating the difference between local and remote'
  public static readonly FETCH_CALC_DIFF_FAIL = 'Calculating diff failed!'
  public static readonly FETCH_UPDATE_WORKSPACE_SUCCESS = 'Applied changes'
  public static readonly FETCH_SUCCESS_FINISHED = 'Done! Your workspace is now updated with the latest changes.'
  public static readonly FETCH_UPDATE_WORKSPACE_FAIL = 'Failed to apply changes to your local workspace'
  public static readonly FETCH_CHANGE_HEADER = (changeIdx: number, totalChanges: number): string => `Change ${changeIdx} of ${totalChanges}:`
  public static readonly FETCH_SHOULD_APPROVE_CHANGE = 'Would you like to update your workspace with this change?'
  public static readonly FETCH_CHANGE_REJECTED = 'The change will not be applied to your workspace'
  public static readonly FETCH_NO_CHANGES = 'No changes found, workspace is up to date'
  public static readonly FETCH_NOTHING_TO_UPDATE = 'No changes chosen, Leaving workspace unchanged'
  public static readonly FETCH_CHANGES_TO_APPLY = (numChanges: number): string => `Applying ${numChanges} changes to the local workspace`
  public static readonly FETCH_CONFLICTING_CHANGE = 'This change conflicts with the following pending change from your workspace:'
  public static readonly FETCH_MERGE_ERRORS = 'These errors occurred as part of the fetch:'
  public static readonly FETCH_FATAL_MERGE_ERROR_PREFIX = 'Error occurred during fetch, cause:\n'

  public static readonly LOADING_WORKSPACE = 'Loading workspace...'
  public static readonly FINISHED_LOADING = 'Finished loading workspace'
  public static readonly FINISHED_LOADING_FOR_ENV = `${Prompts.FINISHED_LOADING} for environment`


  public static readonly WORKSPACE_LOAD_FAILED = (numErrors: number): string =>
    `Workspace has ${numErrors === 1 ? 'an error' : `${numErrors} errors`}.`

  public static readonly WORKSPACE_LOAD_ABORT = (numErrors: number): string =>
    `${Prompts.WORKSPACE_LOAD_FAILED(numErrors)} Aborting!`

  public static readonly SHOULD_CONTINUE = (numWarning: number): string =>
    `Workspace has ${numWarning === 1 ? 'a warning' : `${numWarning} warnings`
    } - do you want to continue?`

  public static readonly SHOULD_ABORT = (numErrors: number): string =>
    `Workspace has ${numErrors === 1 ? 'an error' : `${numErrors} errors`
    } - do you want to abort?`

  public static readonly CONFIG_CHANGE_NEEDED = (introMessage: string, formattedChanges: string):
  string => `\n${introMessage}\n\n${formattedChanges}\n\n`

  public static readonly SHOULD_UPDATE_CONFIG = 'Would you like to apply this configuration change (answering no will cancel the fetch operation)?'
  public static readonly SHOULD_CANCEL_WITH_OLD_STATE = 'It is highly recommended to fetch more frequently so Salto\'s deployment plan can take into account the latest state - do you want to cancel?'
  public static readonly SHOULD_CANCEL_WITH_NONEXISTENT_STATE = 'It is highly recommended to run salto fetch before deploying, to ensure the deploy plan takes into account the current state - do you want to cancel?'

  public static readonly NONEXISTENT_STATE = (
    serviceName: string
  ): string => `Currently, the state of the ${serviceName} service is unknown to Salto.`

  public static readonly STATE_RECENCY = (serviceName: string, date: Date): string =>
    `The last time you fetched the state of the ${serviceName} service was ${moment.duration(
      Date.now() - date.getTime()
    ).humanize()} ago.`

  public static readonly FETCH_SHOULD_ALIGN_FETCH_MODE = (
    fetchMode: string
  ): string => 'It is recommended to fetch in \'align\' mode when fetching an environemnt for the first time and the fetched services already have elements in other environments.'
   + ` Do you want to change the fetch mode from '${fetchMode}' to 'align'?`

  public static readonly FETCH_CHANGING_FETCH_MODE_TO_ALIGN = 'Changing fetch mode to \'align\''
  public static readonly FETCH_NOT_CHANGING_FETCH_MODE = 'Ok, not changing fetch mode'

  public static readonly CANCELED = 'Canceling...'
  public static readonly CREDENTIALS_HEADER = (serviceName: string): string => `Please enter your ${serviceName} credentials:`
  public static readonly SERVICE_HOW_ADD = (serviceName: string): string => `Use \`salto service add ${serviceName}\` to add the service to the environment`
  public static readonly SERVICE_ADDED = (serviceName: string): string => `${serviceName} was added to the environment`
  public static readonly SERVICES_LOGIN_UPDATED = 'Login information successfully updated!'
  public static readonly SERVICES_LOGIN_OVERRIDE = '** This will override the current login information **'
  public static readonly SERVICE_LOGIN_FAILED = (serviceName: string, errorMessage: string): string => `Could not login to ${serviceName}: ${errorMessage}`
  public static readonly SERVICE_LOGIN_FAILED_TRY_AGAIN = (serviceName: string): string => `To try again run: \`salto service add ${serviceName}\``
  public static readonly SERVICE_CONFIGURED = (serviceName: string): string => `${serviceName} is configured in this environment`
  public static readonly SERVICE_NOT_CONFIGURED = (serviceName: string): string => `${serviceName} is not configured in this environment`
  public static readonly CONFIGURED_SERVICES_TITLE = 'The configured services are:'
  public static readonly NO_CONFIGURED_SERVICES = 'There are not configured services in this environment'
  public static readonly SERVICE_ALREADY_ADDED = (serviceName: string): string => `${serviceName} was already added to this environment`
  public static readonly WORKING_ON_ENV = 'The active environment is'
  public static readonly NO_CURRENT_ENV = 'No active environment is currently set'
  public static readonly SET_ENV = 'Active environment is set to'
  public static readonly DELETED_ENV = (envName: string): string => `Deleted environment - ${envName}`
  public static readonly CREATED_ENV = (envName: string): string =>
    `Created environment - ${envName}.
${Prompts.SERVICE_ADD_HELP}`

  public static readonly RENAME_ENV = (currentEnvName: string, newEnvName: string): string =>
    `Renamed environment - ${currentEnvName} -> ${newEnvName}`

  public static readonly ISOLATE_FIRST_ENV_RECOMMENDATION = (
    existingEnv: string
  ): string => 'This action will add a second environment to the workspace.'
    + ` It is recommended to move environment ${existingEnv} out of the common configuration before proceeding.`

  public static readonly DONE_ISOLATING_FIRST_ENV = (
    existingEnv: string
  ): string => `Done moving environment ${existingEnv} out of the common configuration.`

  public static readonly APPROVE_ISOLATE_BEFORE_MULTIENV_RECOMMENDATION = (
    existingEnv: string
  ): string => `Would you like to isolate the configuration for ${existingEnv} before adding the new environment?`
    + ' (Answer No to continue without changes)'

  public static readonly STATE_ONLY_UPDATE_START = (
    numOfChanges: number
  ): string => `Applying ${numOfChanges} changes to the state. Workspace will not be updated.`

  public static readonly STATE_NO_CHANGES = 'No changes found, state is up to date.'
  public static readonly STATE_ONLY_UPDATE_END = 'Applied changes.'
  public static readonly STATE_ONLY_UPDATE_FAILED = (
    numOfChanges: number
  ): string => `Failed to apply ${numOfChanges} changes to state.`

  public static readonly RESTORE_CALC_DIFF_START = 'Calculating the difference between state and NaCL files.'
  public static readonly RESTORE_CALC_DIFF_RESULT_HEADER = 'The following changes can restore the local workspace to its last known state:'
  public static readonly RESTORE_CALC_DIFF_FINISH = 'Finished calculating the difference between state and NaCL files.'
  public static readonly RESTORE_CALC_DIFF_FAIL = 'Calculating diff failed!'
  public static readonly RESTORE_UPDATE_WORKSPACE_SUCCESS = 'Applied changes'
  public static readonly RESTORE_SUCCESS_FINISHED = 'Done! Your NaCL files are now updated with the latest changes.'
  public static readonly RESTORE_UPDATE_WORKSPACE_FAIL = 'Failed to apply changes to your NaCL files.'
  public static readonly INVALID_FILTERS = (
    invalidFilters: string
  ): string => `Failed to created element ID filters for: ${invalidFilters}. Invalid Regex provided.`

  public static readonly DIFF_CALC_DIFF_START = (
    toEnv: string,
    fromEnv: string
  ): string => `Calculating the difference between ${toEnv} and ${fromEnv}.`

  public static readonly DIFF_CALC_DIFF_RESULT_HEADER = (
    toEnv: string,
    fromEnv: string
  ): string => `The following changes are needed to bring ${toEnv} up to date with ${fromEnv}:`

  public static readonly DIFF_CALC_DIFF_FINISH = (
    toEnv: string,
    fromEnv: string
  ): string => `Finished calculating the difference between ${toEnv} and ${fromEnv}.`

  public static readonly DIFF_CALC_DIFF_FAIL = 'Calculating diff failed!'

  public static readonly INVALID_IDS = (
    invalidIds: string
  ): string => `Failed to created element ID filters for: ${invalidIds}. Invalid Element IDs provided.`

  public static readonly INVALID_ELEMENT_COMMAND = (
    command: string,
  ): string => `Unknown element command: ${command}`

  public static readonly ELEMENT_COPY_USAGE = 'Usage: salto element copy [elm-selector, ...] --from-env <env> --to-envs [env1, ...]'
  public static readonly ELEMENT_MOVE_USAGE = 'Usage: salto element move [elm-selector, ...] --to [common|envs]'
  public static readonly MISSING_COPY_ARG = 'Missing required environment argument'
  public static readonly MISSING_MOVE_ARG = 'Missing \'to\' argument'
  public static readonly INVALID_MOVE_ARG = (
    invalidTo: string,
  ): string => `Unknown direction for move command ${invalidTo}, choices: [common|envs]`

  public static readonly SOURCE_ENV_REQUIRED = 'The source envrionment cannot be empty'
  public static readonly TARGET_ENVS_REQUIRED = 'The target environments cannot be empty'
  public static readonly INVALID_ENV_TARGET_CURRENT = 'The current environment cannot be a target environment'
  public static readonly UNKNOWN_TARGET_ENVS = (
    unknownEnvs: string[]
  ): string => (unknownEnvs.length === 1
    ? `Unknown target environment: ${unknownEnvs[0]}`
    : `Unknown target environments: ${unknownEnvs?.join(' ')}`)

  public static readonly MOVE_START = (
    from: string,
    to: string,
  ): string => `Moving the selected elements from ${from} to ${to}.`

  public static readonly MOVE_FINISHED = 'Done moving elements.'
  public static readonly MOVE_FAILED = (
    error: string
  ): string => `Failed to move the selected elements: ${error}`

  public static readonly COPY_TO_ENV_START = (
    targetEnvs: string[] = []
  ): string => `Copying the selected elements to ${
    targetEnvs.length > 0 ? targetEnvs.join(', ') : 'all environments'
  }.`

  public static readonly COPY_TO_ENV_FINISHED = 'Done copying elements.'
  public static readonly COPY_TO_ENV_FAILED = (
    error: string
  ): string => `Failed to copy the selected elements to the target environments: ${error}`
}
