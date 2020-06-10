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
  public static readonly CANCEL_DEPLOY = 'Canceling deploy'
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

  public static readonly PREVIEW_STARTED = 'Calculating deployment plan'
  public static readonly PREVIEW_FINISHED = 'Calculated deployment plan!'
  public static readonly PREVIEW_FAILED = 'Deployment plan calculation failed'

  public static readonly EXPLAIN_PREVIEW_RESULT = `Resources and actions are indicated with the following symbols:

  ${Prompts.MODIFIERS.add} create
  ${Prompts.MODIFIERS.modify} change
  ${Prompts.MODIFIERS.remove} remove`

  public static readonly PLAN_STEPS_HEADER_DEPLOY = 'Salto will perform the following actions:'
  public static readonly PLAN_STEPS_HEADER_PREVIEW = 'Salto has calculated the following deployment plan:'
  public static readonly PLAN_CHANGE_ERRS_HEADER = 'Encountered the following validations and will ignore their execution:'
  public static readonly PREVIEW_DISCLAIMER = `Note: Salto cannot guarantee that exactly these actions will be performed if "salto deploy" is run.
Be sure to go over the preview output when invoking the deploy command.`

  public static readonly EMPTY_PLAN = 'Nothing to do.'

  public static readonly DESCRIBE_NEAR_MATCH =
    'Could not find what you were looking for.'

  public static readonly DID_YOU_MEAN = 'Did you mean'
  public static readonly DESCRIBE_NOT_FOUND = 'Unknown element type.'


  public static initFailed(msg: string): string {
    return `Could not initiate workspace: ${msg}\n`
  }

  private static readonly SERVICE_ADD_HELP = 'Use `salto services add <service-name>` to add services to the environment'

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


  public static readonly CANCELED = 'Canceling...'
  public static readonly CREDENTIALS_HEADER = (serviceName: string): string => `Please enter your ${serviceName} credentials:`
  public static readonly SERVICE_HOW_ADD = (serviceName: string): string => `Use \`salto services add ${serviceName}\` to add the service to the environment`
  public static readonly SERVICE_ADDED = (serviceName: string): string => `${serviceName} was added to the environment`
  public static readonly SERVICES_LOGIN_UPDATED = 'Login information successfully updated!'
  public static readonly SERVICES_LOGIN_OVERRIDE = '** This will override the current login information **'
  public static readonly SERVICE_LOGIN_FAILED = (serviceName: string, errorMessage: string): string => `Could not login to ${serviceName}: ${errorMessage}`
  public static readonly SERVICE_LOGIN_FAILED_TRY_AGAIN = (serviceName: string): string => `To try again run: \`salto services login ${serviceName}\``
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

  public static readonly ISOLATED_MODE_FOR_NEW_ENV_RECOMMENDATION = 'The current fetch command is running for the first time for this environment.'
    + ' It is recommended to perform first fetch of an environment in isolated mode.'

  public static readonly NEW_SERVICES_ISOLATED_RECOMMENDATION = (
    servicesNames: string,
  ): string => `The current fetch command is running for the first time for ${servicesNames}.`
     + ' It is recommended to perform first fetch of a service in isolated mode, without fetching other services.'


  public static readonly ONLY_NEW_SERVICES_ISOLATED_RECOMMENDATION = (
    newServicesNames: string,
    oldServicesNames: string
  ): string => `The current fetch command is running for the first time for ${newServicesNames} in isolated mode.`
    + ` This will also fetch ${oldServicesNames} in strict mode and may result in unwanted changes to `
    + ' other environments.\n'
    + `It is recommended to run this fetch as an isolated fetch only for ${newServicesNames}`

  public static readonly APPROVE_ISOLATED_RECOMMENDATION = (
    newServicesNames: string
  ): string => `Would you like to switch to isolated mode and fetch ${newServicesNames}? (Answer No to continue without switching)`

  public static readonly STATE_ONLY_UPDATE_START = (
    numOfChanges: number
  ): string => `Applying ${numOfChanges} changes to the state. Workspace will not be updated.`

  public static readonly STATE_NO_CHANGES = 'No changes found, state is up to date.'
  public static readonly STATE_ONLY_UPDATE_END = 'Applied changes.'
  public static readonly STATE_ONLY_UPDATE_FAILED = (
    numOfChanges: number
  ): string => `Failed to apply ${numOfChanges} changes to state.`
}
