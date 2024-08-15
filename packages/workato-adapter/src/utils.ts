/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { InstanceElement } from '@salto-io/adapter-api'

export const getRootFolderID = (folder: InstanceElement): number =>
  folder.value.parent_id !== undefined ? getRootFolderID(folder.value.parent_id.value) : folder.value.id

export const getFolderPath = (folder: InstanceElement): string[] =>
  folder.value.parent_id !== undefined ? [...getFolderPath(folder.value.parent_id.value), folder.value.name] : []
