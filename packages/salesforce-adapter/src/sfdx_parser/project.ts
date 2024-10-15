/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import path from 'path'
import { logger } from '@salto-io/logging'
import { AdapterFormat } from '@salto-io/adapter-api'
import { API_VERSION } from '../client/client'
import { SfProject, SfError, TemplateService, TemplateType, ProjectOptions } from './salesforce_imports'

const log = logger(module)

type IsInitializedFolderFunc = NonNullable<AdapterFormat['isInitializedFolder']>
export const isProjectFolder: IsInitializedFolderFunc = async ({ baseDir }) => {
  try {
    await SfProject.resolve(baseDir)
    return {
      result: true,
      errors: [],
    }
  } catch (error) {
    if (error instanceof SfError && error.name === 'InvalidProjectWorkspaceError') {
      return {
        result: false,
        errors: [],
      }
    }

    log.error(error)
    return {
      result: false,
      errors: [
        {
          severity: 'Error',
          message: 'Failed checking if folder contains an SFDX project',
          detailedMessage: error.message,
        },
      ],
    }
  }
}

type InitFolderFunc = NonNullable<AdapterFormat['initFolder']>
export const createProject: InitFolderFunc = async ({ baseDir }) => {
  const templateService = TemplateService.getInstance()
  const opts: ProjectOptions = {
    projectname: path.basename(baseDir),
    outputdir: path.dirname(baseDir),
    manifest: false,
    loginurl: 'https://login.salesforce.com',
    template: 'standard',
    ns: '',
    defaultpackagedir: 'force-app',
    apiversion: API_VERSION,
  }

  try {
    await templateService.create(TemplateType.Project, opts)
    return { errors: [] }
  } catch (error) {
    log.error(error)
    return {
      errors: [
        {
          severity: 'Error',
          message: 'Failed initializing SFDX project',
          detailedMessage: error.message,
        },
      ],
    }
  }
}
