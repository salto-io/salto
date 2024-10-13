/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import path from 'path'
import { AdapterFormat } from '@salto-io/adapter-api'
import { API_VERSION } from '../client/client'
import { SfProject, SfError, TemplateService, TemplateType, ProjectOptions } from './salesforce_imports'

type CheckAdapterFormatFolderFunc = AdapterFormat['isInitializedFolder']
export const isProjectFolder: CheckAdapterFormatFolderFunc = async ({ baseDir }) => {
  try {
    await SfProject.resolve(baseDir)
    return true
  } catch (error) {
    if (error instanceof SfError && error.name === 'InvalidProjectWorkspaceError') {
      return false
    }

    throw error
  }
}

type InitAdapterFormatFolderFunc = AdapterFormat['initFolder']
export const createProject: InitAdapterFormatFolderFunc = async ({ baseDir }) => {
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
