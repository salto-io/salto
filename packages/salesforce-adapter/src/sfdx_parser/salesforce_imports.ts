/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

// We have to have this import before any import from a @salesforce package
import './salesforce_imports_fix'

export { SfProject, SfError } from '@salesforce/core'
export {
  ComponentSet,
  ZipTreeContainer,
  MetadataConverter,
  TreeContainer,
  ManifestResolver,
  SourceComponent,
  SourcePath,
} from '@salesforce/source-deploy-retrieve'
export { TemplateService, TemplateType, ProjectOptions } from '@salesforce/templates'
