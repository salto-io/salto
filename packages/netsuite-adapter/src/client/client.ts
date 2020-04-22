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
import { decorators, hash } from '@salto-io/lowerdash'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import xmlConverter, { Element as XmlElement } from 'xml-js'
import path from 'path'
import os from 'os'
import { readDir, readFile, writeFile } from './file'

const log = logger(module)

const {
  AuthenticationService, CLIConfigurationService, CommandActionExecutor, CommandInstanceFactory,
  CommandOptionsValidator, CommandOutputHandler, CommandsMetadataService, SDKOperationResultUtils,
} = NodeCli

export type Credentials = {
  accountId: string
  tokenId: string
  tokenSecret: string
}

export type NetsuiteClientOpts = {
  credentials: Credentials
}

export const COMMANDS = {
  CREATE_PROJECT: 'project:create',
  SETUP_ACCOUNT: 'account:setup',
  IMPORT_OBJECTS: 'object:import',
  DEPLOY_PROJECT: 'project:deploy',
  ADD_PROJECT_DEPENDENCIES: 'project:adddependencies',
}

const OBJECTS_DIR = 'Objects'
const SRC_DIR = 'src'

const rootCLIPath = path.normalize(path.join(__dirname, ...Array(5).fill('..'), 'node_modules',
  '@oracle', 'suitecloud-sdk', 'packages', 'node-cli', 'src'))
const baseExecutionPath = os.tmpdir()

export const convertToSingleXmlElement = (xmlContent: string): XmlElement => {
  const topLevelXmlElements = xmlConverter.xml2js(xmlContent)
  return topLevelXmlElements.elements[0]
}

export const convertToXmlString = (xmlElement: XmlElement): string =>
  xmlConverter.js2xml(xmlElement, { spaces: 2, fullTagEmptyElement: true })

export default class NetsuiteClient {
  private projectName?: string
  private projectCommandActionExecutor?: NodeCli.CommandActionExecutor
  private isAccountSetUp = false
  private readonly credentials: Credentials
  private readonly authId: string

  constructor({ credentials }: NetsuiteClientOpts) {
    this.credentials = credentials
    this.authId = hash.toMD5(this.credentials.tokenId)
  }

  static async validateCredentials(credentials: Credentials): Promise<void> {
    const netsuiteClient = new NetsuiteClient({ credentials })
    await netsuiteClient.setupAccount()
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

  private async ensureAccountIsSetUp(): Promise<void> {
    if (!this.isAccountSetUp) {
      await this.setupAccount()
      this.isAccountSetUp = true
    }
  }

  private static requiresSetupAccount = decorators.wrapMethodWith(
    async function withSetupAccount(
      this: NetsuiteClient,
      originalMethod: decorators.OriginalCall
    ): Promise<unknown> {
      await this.ensureAccountIsSetUp()
      return originalMethod.call()
    }
  )

  private static logDecorator = decorators.wrapMethodWith(
    async (
      { call, name }: decorators.OriginalCall,
    ): Promise<unknown> => {
      const desc = `client.${name}`
      try {
        return await log.time(call, desc)
      } catch (e) {
        log.error('failed to run Netsuite client command on: %o', e)
        throw e
      }
    }
  )

  private static async createProject(): Promise<string> {
    const projectName = `TempProject${String(Date.now()).substring(8)}`
    const operationResult = await NetsuiteClient.initCommandActionExecutor(baseExecutionPath)
      .executeAction({
        commandName: COMMANDS.CREATE_PROJECT,
        runInInteractiveMode: false,
        arguments: {
          projectname: projectName,
          type: 'ACCOUNTCUSTOMIZATION',
          parentdirectory: rootCLIPath,
        },
      })
    NetsuiteClient.verifySuccessfulOperation(operationResult)
    return projectName
  }

  private static verifySuccessfulOperation(operationResult: NodeCli.OperationResult): void {
    if (SDKOperationResultUtils.hasErrors(operationResult)) {
      throw Error(SDKOperationResultUtils.getErrorMessagesString(operationResult))
    }
  }

  private async executeProjectAction(commandName: string, commandArguments: Values): Promise<void> {
    if (!this.projectName) {
      this.projectName = await NetsuiteClient.createProject()
    }

    if (!this.projectCommandActionExecutor) {
      this.projectCommandActionExecutor = NetsuiteClient
        .initCommandActionExecutor(`${this.getProjectPath()}`)
    }

    const operationResult = await this.projectCommandActionExecutor.executeAction({
      commandName,
      runInInteractiveMode: false,
      arguments: commandArguments,
    })

    NetsuiteClient.verifySuccessfulOperation(operationResult)
  }

  protected async setupAccount(): Promise<void> {
    // Todo: use the correct implementation and not Salto's temporary solution after:
    //  https://github.com/oracle/netsuite-suitecloud-sdk/issues/81 is resolved
    const setupAccountUsingExistingAuthID = async (): Promise<void> =>
      this.executeProjectAction(COMMANDS.SETUP_ACCOUNT, {
        authid: this.authId,
      })

    const setupAccountUsingNewAuthID = async (): Promise<void> =>
      this.executeProjectAction(COMMANDS.SETUP_ACCOUNT, {
        authid: this.authId,
        accountid: this.credentials.accountId,
        tokenid: this.credentials.tokenId,
        tokensecret: this.credentials.tokenSecret,
      })

    try {
      await setupAccountUsingExistingAuthID()
    } catch (e) {
      await setupAccountUsingNewAuthID()
    }
  }

  @NetsuiteClient.logDecorator
  @NetsuiteClient.requiresSetupAccount
  async listCustomObjects(): Promise<XmlElement[]> {
    await this.executeProjectAction(COMMANDS.IMPORT_OBJECTS, {
      destinationfolder: `${path.sep}${OBJECTS_DIR}`,
      type: 'ALL',
      scriptid: 'ALL',
      excludefiles: true,
    })

    const objectsDirPath = this.getObjectsDirPath()
    const dirContent = await readDir(objectsDirPath)
    return Promise.all(dirContent.map(async filename => {
      const xmlContent = await readFile(path.resolve(objectsDirPath, filename))
      return convertToSingleXmlElement(xmlContent)
    }))
  }

  private getObjectsDirPath(): string {
    return path.resolve(this.getProjectPath(), SRC_DIR, OBJECTS_DIR)
  }

  private getProjectPath(): string {
    return path.resolve(baseExecutionPath, this.projectName as string)
  }

  @NetsuiteClient.logDecorator
  @NetsuiteClient.requiresSetupAccount
  async deployCustomObject(filename: string, xmlElement: XmlElement): Promise<void> {
    await this.deploy(path.resolve(this.getObjectsDirPath(), `${filename}.xml`), xmlElement)
  }

  private async deploy(filePath: string, xmlElement: XmlElement): Promise<void> {
    await writeFile(filePath, convertToXmlString(xmlElement))
    await this.addProjectDependencies()
    await this.executeProjectAction(COMMANDS.DEPLOY_PROJECT, {})
  }

  private async addProjectDependencies(): Promise<void> {
    return this.executeProjectAction(COMMANDS.ADD_PROJECT_DEPENDENCIES, {})
  }
}
