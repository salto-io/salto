/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import os from 'os'
import osPath from 'path'
import { v4 as uuidv4 } from 'uuid'
import { mkdirp, rm, writeFile } from '@salto-io/file'
import Bottleneck from 'bottleneck'
import {
  SdfCredentials,
  SdfOAuthCredentials,
  SdfTokenBasedCredentials,
  toCredentialsAccountId,
} from '../src/client/credentials'
import SdfClient, { ALL_FEATURES, CommandActionExecutor, COMMANDS, safeQuoteArgument } from '../src/client/sdf_client'
import { DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST } from '../src/config/constants'
import { FILE_CABINET_PATH_SEPARATOR } from '../src/constants'
import { FILE_CABINET_DIR, OBJECTS_DIR, SRC_DIR } from '../src/client/sdf_parser'

export type ProjectInfo = {
  projectPath: string
  authId: string
}
type SDFExecutor = {
  createProject: (credentials: SdfCredentials) => Promise<ProjectInfo>
  importObjects: (objectIds: Array<{ type: string; scriptid: string }>) => Promise<void>
  importFiles: (filePaths: string[]) => Promise<void>
  importFeatures: () => Promise<void>
  deleteProject: (projectInfo: ProjectInfo) => Promise<void>
}

function assertSDFOAuthCredentials(_credentials: SdfCredentials): asserts _credentials is SdfOAuthCredentials {}
function assertSDFTokenBasedCredentials(
  _credentials: SdfCredentials,
): asserts _credentials is SdfTokenBasedCredentials {}

export const createSdfExecutor = ({ withOAuth }: { withOAuth: boolean }): SDFExecutor => {
  let baseCommandExecutor: CommandActionExecutor
  let executor: CommandActionExecutor

  const baseExecutionPath = os.tmpdir()
  const limiter = new Bottleneck({ maxConcurrent: 4 })

  return {
    createProject: async credentials => {
      const authId = uuidv4()
      const projectName = `sdf-${authId}`
      const projectPath = osPath.resolve(baseExecutionPath, projectName)

      if (withOAuth) {
        baseCommandExecutor = SdfClient.initNewCommandActionExecutor(baseExecutionPath)
        executor = SdfClient.initNewCommandActionExecutor(projectPath)
      } else {
        baseCommandExecutor = SdfClient.initLegacyCommandActionExecutor(baseExecutionPath)
        executor = SdfClient.initLegacyCommandActionExecutor(projectPath)
      }

      await baseCommandExecutor.executeAction({
        commandName: COMMANDS.CREATE_PROJECT,
        runInInteractiveMode: false,
        arguments: {
          projectname: projectName,
          type: 'ACCOUNTCUSTOMIZATION',
          parentdirectory: osPath.join(baseExecutionPath, projectName),
        },
      })

      if (withOAuth) {
        assertSDFOAuthCredentials(credentials)
        const privateKeyPath = osPath.resolve(baseExecutionPath, `${authId}.pem`)
        await writeFile(privateKeyPath, credentials.privateKey)
        const setupCommandArguments = {
          authid: authId,
          account: toCredentialsAccountId(credentials.accountId),
          certificateid: credentials.certificateId,
          privatekeypath: privateKeyPath,
        }
        try {
          await executor.executeAction({
            commandName: COMMANDS.SETUP_OAUTH,
            runInInteractiveMode: false,
            arguments: _.mapValues(setupCommandArguments, safeQuoteArgument),
          })
        } finally {
          await rm(privateKeyPath)
        }
      } else {
        assertSDFTokenBasedCredentials(credentials)
        const setupCommandArguments = {
          authid: authId,
          account: toCredentialsAccountId(credentials.accountId),
          tokenid: credentials.tokenId,
          tokensecret: credentials.tokenSecret,
        }
        await executor.executeAction({
          commandName: COMMANDS.SAVE_TOKEN,
          runInInteractiveMode: false,
          arguments: _.mapValues(setupCommandArguments, safeQuoteArgument),
        })
      }
      return { projectPath, authId }
    },
    importObjects: async objectIds => {
      await Promise.all(
        objectIds.map(({ type, scriptid }) =>
          limiter.schedule(() =>
            executor.executeAction({
              commandName: COMMANDS.IMPORT_OBJECTS,
              runInInteractiveMode: false,
              arguments: {
                destinationfolder: `${FILE_CABINET_PATH_SEPARATOR}${OBJECTS_DIR}`,
                type,
                scriptid,
                maxItemsInImportObjectsRequest: DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
                excludefiles: true,
                appid: undefined,
              },
            }),
          ),
        ),
      )
    },
    importFiles: async filePaths => {
      await limiter.schedule(() =>
        executor.executeAction({
          commandName: COMMANDS.IMPORT_FILES,
          runInInteractiveMode: false,
          arguments: {
            paths: filePaths,
          },
        }),
      )
    },
    importFeatures: async () => {
      await limiter.schedule(() =>
        executor.executeAction({
          commandName: COMMANDS.IMPORT_CONFIGURATION,
          runInInteractiveMode: false,
          arguments: {
            configurationid: ALL_FEATURES,
          },
        }),
      )
    },
    deleteProject: async ({ projectPath, authId }) => {
      await rm(projectPath)
      await baseCommandExecutor.executeAction({
        commandName: COMMANDS.MANAGE_AUTH,
        runInInteractiveMode: false,
        arguments: {
          remove: authId,
        },
      })
    },
  }
}

export const createAdditionalFiles = async (
  projectPath: string,
  files: Array<{ path: string[]; content: string }>,
): Promise<void> => {
  await Promise.all(
    files.map(async ({ path, content }) => {
      await mkdirp(osPath.join(projectPath, SRC_DIR, FILE_CABINET_DIR, ...path.slice(0, -1)))
      await writeFile(osPath.join(projectPath, SRC_DIR, FILE_CABINET_DIR, ...path), content)
    }),
  )
}
