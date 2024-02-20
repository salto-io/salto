/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import os from 'os'
import _ from 'lodash'

export const deployOrValidate = ({
  checkOnly,
  capitalize,
  noun,
}: {
  checkOnly: boolean
  capitalize: boolean
  noun: boolean
}): string => {
  if (checkOnly) {
    const validate = noun ? 'validation' : 'validate'
    return capitalize ? _.capitalize(validate) : validate
  }
  const deploy = noun ? 'deployment' : 'deploy'
  return capitalize ? _.capitalize(deploy) : deploy
}

export default class Prompts {
  public static readonly SHOULD_EXECUTE_PLAN = 'Do you want to perform these actions?'
  public static readonly SHOULD_EXECUTE_DEPLOY_PLAN = (checkOnly: boolean): string =>
    `Do you want to ${deployOrValidate({ checkOnly, capitalize: false, noun: false })}?`

  public static readonly CANCEL_DEPLOY_ACTION = 'Cancelled: Due to an erroneous dependency -'
  public static readonly START_DEPLOY_EXEC = (checkOnly: boolean): string =>
    `Starting the ${deployOrValidate({ checkOnly, capitalize: false, noun: true })} plan`

  public static readonly FULL_DEPLOY_SUMMARY = (numChanges: number, numErrors: number): string =>
    `Deployment partially succeeded with ${numChanges} applied change(s) and ${numErrors} error(s).`

  public static readonly CHANGES_DEPLOY_SUMMARY = (numChanges: number, checkOnly: boolean): string =>
    `${deployOrValidate({ checkOnly, capitalize: true, noun: true })} succeeded - ${numChanges} applied change(s).`

  public static readonly ERRORS_DEPLOY_SUMMARY = (numErrors: number, checkOnly: boolean): string =>
    `${deployOrValidate({ checkOnly, capitalize: true, noun: true })} failed with ${numErrors} error(s).`

  public static readonly CANCEL_DEPLOY = (checkOnly: boolean): string =>
    `Cancelling ${deployOrValidate({ checkOnly, capitalize: false, noun: true })}`

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
  public static readonly PLAN_CHANGE_ERRS_HEADER =
    'Please review the following messages; changes with errors will not be deployed.'

  public static readonly DEPLOY_PRE_ACTION_HEADER = 'Before continuing to deploy, please perform the following actions:'
  public static readonly DEPLOY_POST_ACTION_HEADER =
    'Some actions may be required following the completion of this deployment, please perform the following actions:'

  public static readonly EMPTY_PLAN = 'Nothing to do.'

  public static readonly DESCRIBE_NEAR_MATCH = 'Could not find what you were looking for.'

  public static readonly DID_YOU_MEAN = 'Did you mean'
  public static readonly DESCRIBE_NOT_FOUND = 'Unknown element type.'

  public static initFailed(msg: string): string {
    return `Could not initiate workspace: ${msg}\n`
  }

  private static readonly ACCOUNT_ADD_HELP = 'Use `salto account add <service-name>` to add accounts to the environment'

  public static initCompleted(): string {
    return `Initiated empty workspace
${Prompts.ACCOUNT_ADD_HELP}
`
  }

  public static readonly FETCH_HEADER = 'Fetching and applying changes from the account(s)'
  public static readonly FETCH_SUB_HEADER = `This might take a few minutes. You can go grab your favorite beverage.
The steps are: I. Fetching configs, II. Calculating difference and III. Applying the changes`
  public static readonly FETCH_GET_CHANGES_START = (adapters: string[]): string =>
    `Fetching the latest configs from: ${adapters}`

  public static readonly FETCH_GET_CHANGES_FINISH = (adapters: string[]): string =>
    `Finished fetching the latest configs from: ${adapters}`

  public static readonly FETCH_GET_CHANGES_FAIL = 'Fetching failed'
  public static readonly FETCH_CALC_DIFF_START = 'Calculating the difference between local and remote'
  public static readonly FETCH_CALC_DIFF_FINISH = 'Finished calculating the difference between local and remote'
  public static readonly FETCH_CALC_DIFF_FAIL = 'Calculating diff failed!'
  public static readonly FETCH_SUCCESS_FINISHED = 'Done! Your workspace is now updated with the latest changes.'
  public static readonly FETCH_UPDATE_WORKSPACE_FAIL = 'Failed to apply changes to your local workspace'
  public static readonly FETCH_CHANGE_HEADER = (changeIdx: number, totalChanges: number): string =>
    `Change ${changeIdx} of ${totalChanges}:`

  public static readonly FETCH_SHOULD_APPROVE_CHANGE = 'Would you like to update your workspace with this change?'
  public static readonly FETCH_CHANGE_REJECTED = 'The change will not be applied to your workspace'
  public static readonly FETCH_NO_CHANGES = 'No changes found, workspace is up to date'
  public static readonly FETCH_CONFLICTING_CHANGE =
    'This change conflicts with the following pending change from your workspace:'

  public static readonly FETCH_MERGE_ERRORS = 'These errors occurred as part of the fetch:'
  public static readonly FETCH_WARNINGS = 'The fetch concluded with the following warnings:'
  public static readonly FETCH_CHANGES_APPLIED = (appliedChanges: number): string =>
    `${appliedChanges} changes were applied to the local workspace`

  public static readonly APPLYING_CHANGES = 'Applying changes'

  public static readonly LOADING_WORKSPACE = 'Loading workspace...'
  public static readonly FINISHED_LOADING = 'Finished loading workspace'
  public static readonly FINISHED_LOADING_FOR_ENV = `${Prompts.FINISHED_LOADING} for environment`

  public static readonly WORKSPACE_LOAD_FAILED = (numErrors: number): string =>
    `Workspace has ${numErrors === 1 ? 'an error' : `${numErrors} errors`}.`

  public static readonly WORKSPACE_LOAD_ABORT = (numErrors: number): string =>
    `${Prompts.WORKSPACE_LOAD_FAILED(numErrors)} Aborting!`

  public static readonly SHOULD_CONTINUE = (numWarning: number): string =>
    `Workspace has ${numWarning === 1 ? 'a warning' : `${numWarning} warnings`} - do you want to continue?`

  public static readonly SHOULD_ABORT = (numErrors: number): string =>
    `Workspace has ${numErrors === 1 ? 'an error' : `${numErrors} errors`} - do you want to abort?`

  public static readonly CONFIG_CHANGE_NEEDED = (introMessage: string, formattedChanges: string): string =>
    `\nThe fetch operation encountered the following issues which require configuration changes:\n\n${introMessage}\n\n${formattedChanges}\n\n`

  public static readonly SHOULD_UPDATE_CONFIG =
    'Would you like to apply this configuration change (answering no will cancel the fetch operation)?'

  public static readonly SHOULD_CANCEL_WITH_OLD_STATE =
    "It is highly recommended to fetch more frequently so Salto's deployment plan can take into account the latest state - do you want to cancel?"

  public static readonly SHOULD_CANCEL_WITH_NONEXISTENT_STATE =
    'It is highly recommended to run salto fetch before deploying, to ensure the deploy plan takes into account the current state - do you want to cancel?'

  public static readonly NONEXISTENT_STATE = (accountName: string): string =>
    `Currently, the state of the ${accountName} account is unknown to Salto.`

  public static readonly STATE_RECENCY = (accountName: string, date: Date): string =>
    `The last time you fetched the state of the ${accountName} account was ${moment
      .duration(Date.now() - date.getTime())
      .humanize()} ago.`

  public static readonly FETCH_SHOULD_ALIGN_FETCH_MODE = (fetchMode: string): string =>
    "It is recommended to fetch in 'align' mode when fetching an environment for the first time and the fetched accounts already have elements in other environments." +
    ` Do you want to change the fetch mode from '${fetchMode}' to 'align'?`

  public static readonly FETCH_CHANGING_FETCH_MODE_TO_ALIGN = "Changing fetch mode to 'align'"
  public static readonly FETCH_NOT_CHANGING_FETCH_MODE = 'Ok, not changing fetch mode'

  public static readonly CANCELED = 'Canceling...'
  public static readonly CREDENTIALS_HEADER = (accountName: string): string =>
    `Please enter your ${accountName} credentials:`

  public static readonly GO_TO_BROWSER = (url: string): string =>
    `Please follow the steps for authenticating in your browser. If a new tab has not opened automatically, please go to ${url}`

  public static readonly ACCOUNT_HOW_ADD = (serviceName: string): string =>
    `Use \`salto account add ${serviceName}\` to add the service to the environment`

  public static readonly ACCOUNT_ADDED = (accountName: string): string => `${accountName} was added to the environment`
  public static readonly ACCOUNTS_LOGIN_UPDATED = 'Login information successfully updated!'
  public static readonly ACCOUNTS_LOGIN_OVERRIDE = '** This will override the current login information **'
  public static readonly ACCOUNT_LOGIN_FAILED = (accountName: string, errorMessage: string): string =>
    `Could not login to ${accountName}: ${errorMessage}`

  public static readonly ACCOUNT_LOGIN_FAILED_TRY_AGAIN = (accountName: string): string =>
    `To try again run: \`salto account login ${accountName}\``

  public static readonly ACCOUNT_ADD_FAILED_TRY_AGAIN = (serviceName: string): string =>
    `To try again run: \`salto account add ${serviceName}\``

  public static readonly ACCOUNT_CONFIGURED = (accountName: string): string =>
    `${accountName} is configured in this environment`

  public static readonly ACCOUNT_NOT_CONFIGURED = (accountName: string): string =>
    `${accountName} is not configured in this environment`

  public static readonly CONFIGURED_ACCOUNTS_TITLE = 'The configured accounts are:'
  public static readonly ADDITIONAL_SUPPORTED_SERVICES_TITLE = 'Additional supported services are:'
  public static readonly NO_CONFIGURED_ACCOUNTS = 'There are not configured accounts in this environment'
  public static readonly NO_ADDITIONAL_CONFIGURED_ACCOUNTS =
    'There are no additional configurable accounts for this environment'

  public static readonly ACCOUNT_ALREADY_ADDED = (accountName: string): string =>
    `${accountName} was already added to this environment`

  public static readonly SERVICE_NAME_NOT_VALID = (serviceName: string, supportedServiceAdapters: string[]): string =>
    `${serviceName} is not a valid service name, available service names are:\n${supportedServiceAdapters.join('\n')}`

  public static readonly WORKING_ON_ENV = 'The active environment is'
  public static readonly NO_CURRENT_ENV = 'No active environment is currently set'
  public static readonly SET_ENV = 'Active environment is set to'
  public static readonly DELETED_ENV = (envName: string): string => `Deleted environment - ${envName}`
  public static readonly CREATED_ENV = (envName: string): string =>
    `Created environment - ${envName}.
${Prompts.ACCOUNT_ADD_HELP}`

  public static readonly RENAME_ENV = (currentEnvName: string, newEnvName: string): string =>
    `Renamed environment - ${currentEnvName} -> ${newEnvName}`

  public static readonly ISOLATE_FIRST_ENV_RECOMMENDATION = (existingEnv: string): string =>
    'This operation will turn this workspace to a multi environment one by adding a second environment.' +
    ` It is recommended to move all environment '${existingEnv}' configuration to the environment-specific folder.`

  public static readonly DONE_ISOLATING_FIRST_ENV = (existingEnv: string): string =>
    `Done moving environment '${existingEnv}' configuration to the environment-specific folder.`

  public static readonly APPROVE_ISOLATE_BEFORE_MULTIENV_RECOMMENDATION = (existingEnv: string): string =>
    `Move all environment '${existingEnv}' configuration to the environment-specific folder?` +
    ' (Answering No will keep the configuration in the common folder)'

  public static readonly STATE_ONLY_UPDATE_START = (numOfChanges: number): string =>
    `Applying ${numOfChanges} changes to the state. Workspace will not be updated.`

  public static readonly STATE_NO_CHANGES = 'No changes found, state is up to date.'
  public static readonly STATE_ONLY_UPDATE_END = 'Applied changes.'
  public static readonly STATE_ONLY_UPDATE_FAILED = (numOfChanges: number): string =>
    `Failed to apply ${numOfChanges} changes to state.`

  public static readonly RESTORE_CALC_DIFF_START = 'Calculating the difference between state and NaCL files.'
  public static readonly RESTORE_CALC_DIFF_RESULT_HEADER =
    'The following changes can restore the local workspace to its last known state:'

  public static readonly RESTORE_CALC_DIFF_FINISH = 'Finished calculating the difference between state and NaCL files.'
  public static readonly RESTORE_CALC_DIFF_FAIL = 'Calculating diff failed!'
  public static readonly RESTORE_UPDATE_WORKSPACE_SUCCESS = 'Applied changes'
  public static readonly STATIC_RESOURCES_NOT_SUPPORTED = `The state version of some of the static resources is not available.
  Therefore, the following files will not be restored:`
  public static readonly RESTORE_SUCCESS_FINISHED = 'Done! Your NaCL files are now updated with the latest changes.'
  public static readonly RESTORE_UPDATE_WORKSPACE_FAIL = 'Failed to apply changes to your NaCL files.'
  public static readonly SHOULD_EXECUTE_RESTORE = 'Do you want to restore?'
  public static readonly REORGANIZE_DIR_STRUCTURE_WITH_ELEMENT_SELECTORS =
    'Reorganize dir structure flag with element selectors is not supported'

  public static readonly INVALID_FILTERS = (invalidFilters: string): string =>
    `Failed to created element ID filters for: ${invalidFilters}. Invalid Regex provided.`

  public static readonly NON_TOP_LEVEL_SELECTORS = (invalidSelectors: string): string =>
    `Expected top level selectors, received: ${invalidSelectors}.`

  public static readonly MISSING_ELEMENT_SELECTORS = 'No element selectors specified'

  public static readonly DIFF_CALC_DIFF_START = (toEnv: string, fromEnv: string): string =>
    `Calculating the difference between ${toEnv} and ${fromEnv}.`

  public static readonly DIFF_CALC_DIFF_RESULT_HEADER = (toEnv: string, fromEnv: string): string =>
    `The following changes are needed to bring ${toEnv} up to date with ${fromEnv}:`

  public static readonly DIFF_CALC_DIFF_FINISH = (toEnv: string, fromEnv: string): string =>
    `Finished calculating the difference between ${toEnv} and ${fromEnv}.`

  public static readonly DIFF_CALC_DIFF_FAIL = 'Calculating diff failed!'

  public static readonly ELEMENT_CLONE_USAGE =
    'Usage: salto element clone [elm-selector, ...] --from-env <env> --to-envs [env1, ...]'

  public static readonly ELEMENT_MOVE_USAGE = 'Usage: salto element move [elm-selector, ...] --to [common|envs]'
  public static readonly MISSING_CLONE_ARG = 'Missing required environment argument'
  public static readonly MISSING_MOVE_ARG = "Missing 'to' argument"
  public static readonly INVALID_MOVE_ARG = (invalidTo: string): string =>
    `Unknown direction for move command ${invalidTo}, choices: [common|envs]`

  public static readonly SOURCE_ENV_REQUIRED = 'The source envrionment cannot be empty'
  public static readonly TARGET_ENVS_REQUIRED = 'The target environments cannot be empty'
  public static readonly INVALID_ENV_TARGET_CURRENT = 'The current environment cannot be a target environment'
  public static readonly UNKNOWN_TARGET_ENVS = (unknownEnvs: string[]): string =>
    unknownEnvs.length === 1
      ? `Unknown target environment: ${unknownEnvs[0]}`
      : `Unknown target environments: ${unknownEnvs?.join(' ')}`

  private static readonly LIST_IDS = (ids: readonly string[]): string =>
    [...ids]
      .sort()
      .map(id => `  - ${id}`)
      .join(os.EOL)

  public static readonly MOVE_MESSAGE = (to: string, ids: readonly string[]): string =>
    ids.length !== 0
      ? `The following configuration elements will be moved to ${to}:
${Prompts.LIST_IDS(ids)}


`
      : ''

  public static readonly MOVE_START = (to: string): string => `Moving the specified elements to ${to}.
`

  public static readonly LIST_MESSAGE = (
    ids: readonly string[],
  ): string => `The following configuration elements were found:
${Prompts.LIST_IDS(ids)}


`

  private static readonly SHOULD_RUN_ELEMENTS_OPERATION = (operation: string): string =>
    `Would you like to complete the ${operation} operation?`

  public static readonly SHOULD_MOVE_QUESTION = (to: string): string =>
    Prompts.SHOULD_RUN_ELEMENTS_OPERATION(`move to ${to}`)

  public static readonly NO_ELEMENTS_MESSAGE = `Did not find any configuration elements that match your criteria.
Nothing to do.
`

  public static readonly MOVE_FAILED = (error: string): string => `Failed to move the specified elements: ${error}`

  public static readonly LIST_FAILED = (error: string): string =>
    `Failed to list elements for the given selector(s): ${error}`

  public static readonly LIST_UNRESOLVED_FAILED = (error: string): string =>
    `Failed to list unresolved references: ${error}`

  public static readonly CLONE_TO_ENV_START = (
    targetEnvs: string[] = [],
  ): string => `Cloning the specified elements to ${targetEnvs.length > 0 ? targetEnvs.join(', ') : 'all environments'}.
`

  public static readonly CLONE_MESSAGE = (ids: readonly string[]): string =>
    ids.length !== 0
      ? `The following configuration elements will be cloned:
${Prompts.LIST_IDS(ids)}


`
      : ''

  public static readonly ELEMENTS_DELETION_MESSAGE = (envName: string, ids: readonly string[]): string =>
    ids.length !== 0
      ? `The following configuration elements will be deleted from ${envName}:
${Prompts.LIST_IDS(ids)}


`
      : ''

  public static readonly SHOULD_CLONE_QUESTION = Prompts.SHOULD_RUN_ELEMENTS_OPERATION('clone')

  public static readonly LIST_UNRESOLVED_START = (env: string): string => `Looking for unresolved references in ${env}`
  public static readonly LIST_UNRESOLVED_NONE = (env: string): string =>
    `All references in ${env} were resolved successfully!`

  public static readonly LIST_UNRESOLVED_FOUND = (env: string): string =>
    `The following unresolved references can be copied from ${env}:`

  public static readonly LIST_UNRESOLVED_MISSING = (): string =>
    'The following unresolved references could not be found:'

  public static readonly RENAME_ELEMENT = (
    source: string,
    target: string,
  ): string => `The following element was renamed:
  ${source} -> ${target}`

  public static readonly RENAME_ELEMENT_REFERENCES = (
    source: string,
    elementsAffected: number,
  ): string => `Renamed all references of ${source}:
  ${elementsAffected} elements affected`

  public static readonly CLONE_TO_ENV_FAILED = (error: string): string =>
    `Failed to clone the specified elements to the target environments: ${error}`

  public static readonly CLONE_TARGET_ENV_ERROR =
    "Please specify the target environment(s) by passing exactly one of '--to-envs' and '--to-all-envs' parameters"

  public static readonly UNKNOWN_STATE_SALTO_VERSION =
    'Can not determine the Salto version that was when the state of the accounts was last fetched. It is highly recommended to run the fetch command before proceeding - do you want to cancel?'

  public static readonly OLD_STATE_SALTO_VERSION = (stateSaltoVersion: string): string =>
    `The state of the accounts was last fetched using Salto's version ${stateSaltoVersion}. It is highly recommended to run the fetch command again before proceeding - do you want to cancel?`

  public static readonly NEW_STATE_SALTO_VERSION = (stateSaltoVersion: string): string =>
    `The state of the accounts was last fetched using Salto's version ${stateSaltoVersion} which is newer than the current installed Salto version. It is highly recommended to upgrade the current Salto version - do you want to cancel?`

  public static readonly CLEAN_WORKSPACE_SUMMARY = (parts: string[]): string =>
    `Going to clean the following workspace components and restore them to their initial state: ${parts.join(
      ', ',
    )}.\nThis operation cannot be undone, please make sure your data is backed up before proceeding.`

  public static readonly CLEAN_STARTED = 'Starting to clean the workspace.'
  public static readonly CLEAN_FINISHED = 'Finished cleaning the workspace.'
  public static readonly CLEAN_FAILED = (err: string): string =>
    `Error encountered while cleaning the workspace: ${err}.`

  public static readonly NO_MATCHES_FOUND_FOR_ELEMENT = (elementId: string): string =>
    `Did not find any matches for element ${elementId}`

  public static readonly GO_TO_SERVICE_NOT_SUPPORTED_FOR_ELEMENT = (elementId: string): string =>
    `Go to service is not supported for element ${elementId}`

  public static readonly FETCH_PROGRESSING_MESSAGES = (adapterName: string, progressMessage: string): string =>
    `- ${adapterName} adapter: ${progressMessage}`

  public static readonly VALIDATION_PARAMETERS = 'Validation parameters: '

  public static readonly QUICK_DEPLOY_PARAMETERS = (requestId: string, hash: string): string =>
    `requestId = ${requestId}, hash = ${hash}\n`

  public static readonly DEPLOYMENT_URLS = (checkOnly: boolean, deploymentUrls: string[]): string =>
    `You can see your ${deployOrValidate({ checkOnly, capitalize: false, noun: true })} here:\n${deploymentUrls.join('\n')}`
}
