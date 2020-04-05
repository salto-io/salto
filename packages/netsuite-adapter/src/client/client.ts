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
import { NodeCli } from '@oracle/suitecloud-sdk'
import { decorators } from '@salto-io/lowerdash'

const {
  AuthenticationService, CLIConfigurationService, CommandActionExecutor, CommandInstanceFactory,
  CommandOptionsValidator, CommandOutputHandler, CommandsMetadataService,
} = NodeCli

export type Credentials = {
}

export type NetsuiteClientOpts = {
  credentials: Credentials
}

// todo
const rootCLIPath = `${__dirname}/../../../../../node_modules/@oracle/suitecloud-sdk/packages/node-cli/src`
// todo
const baseExecutionPath = '/tmp'

export default class NetsuiteClient {
  private projectName?: string
  private isLoggedIn = false

  constructor({ credentials }: NetsuiteClientOpts) { // todo
    // eslint-disable-next-line no-console
    console.log(credentials)
  }

  static validateCredentials(_credentials: Credentials): Promise<void> { // todo
    return Promise.resolve()
  }

  private static initCommandActionExecutor(executionPath: string): NodeCli.CommandActionExecutor {
    const commandsMetadataService = new CommandsMetadataService(rootCLIPath)
    commandsMetadataService.initializeCommandsMetadata()
    return new CommandActionExecutor({
      executionPath,
      commandOutputHandler: new CommandOutputHandler(),
      commandOptionsValidator: new CommandOptionsValidator(),
      cliConfigurationService: new CLIConfigurationService(),
      commandInstanceFactory: new CommandInstanceFactory(),
      authenticationService: new AuthenticationService(executionPath),
      commandsMetadataService,
    })
  }

  private async ensureHasProject(): Promise<void> {
    if (!this.projectName) {
      this.projectName = await NetsuiteClient.createProject()
    }
  }

  private static requiresProject = decorators.wrapMethodWith(
    async function withProject(
      this: NetsuiteClient,
      originalMethod: decorators.OriginalCall
    ): Promise<unknown> {
      await this.ensureHasProject()
      return originalMethod.call()
    }
  )

  private async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      await this.setupAccount()
      this.isLoggedIn = true
    }
  }

  private static requiresLogin = decorators.wrapMethodWith(
    async function withLogin(
      this: NetsuiteClient,
      originalMethod: decorators.OriginalCall
    ): Promise<unknown> {
      await this.ensureLoggedIn()
      return originalMethod.call()
    }
  )

  private static async createProject(): Promise<string> {
    const projectName = `TempProject${String(Date.now()).substring(8)}`
    await NetsuiteClient.initCommandActionExecutor(baseExecutionPath).executeAction({
      commandName: 'project:create',
      runInInteractiveMode: false,
      arguments: {
        projectname: projectName,
        type: 'ACCOUNTCUSTOMIZATION',
        parentdirectory: rootCLIPath,
      },
    })
    return projectName
  }

  @NetsuiteClient.requiresProject
  private async setupAccount(): Promise<void> {
    // todo implement after https://github.com/oracle/netsuite-suitecloud-sdk/issues/81
    // eslint-disable-next-line no-console
    console.log(this)
  }

  @NetsuiteClient.requiresLogin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async listCustomizationObjects(): Promise<any[]> {
    // todo import objects & read the folder content
    // eslint-disable-next-line no-console
    console.log(this)
    return []
  }
}
