/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import path from 'path'
import { logger } from '@salto-io/logging'
import { API_VERSION } from '../client/client'
import { SfProject, SfError, TemplateService, TemplateType, ProjectOptions } from './salesforce_imports'

const log = logger(module)

export const createProject = async (baseDir: string): Promise<void> => {
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
  await templateService.create(TemplateType.Project, opts)
}

export const resolveOrCreateProject = async (baseDir: string): Promise<SfProject> => {
  try {
    return await SfProject.resolve(baseDir)
  } catch (error) {
    if (error instanceof SfError && error.name === 'InvalidProjectWorkspaceError') {
      log.info(`No SFDX project found at ${baseDir}, creating.`)
      await createProject(baseDir)
      return SfProject.resolve(baseDir)
    }

    throw error
  }
}
