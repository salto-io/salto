/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getChangeData, ChangeError, isInstanceChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { fileCabinetTopLevelFolders } from '../client/constants'
import { isFileCabinetType } from '../types'
import * as suiteAppFileCabinet from '../client/suiteapp_client/suiteapp_file_cabinet'
import { NetsuiteChangeValidator } from './types'
import { isPathAllowedBySdf } from '../types/file_cabinet_types'

const { awu } = collections.asynciterable

const changeValidator: NetsuiteChangeValidator = async changes => {
  const notSupportedChanges = await awu(changes)
    .filter(isInstanceChange)
    .filter(async change => isFileCabinetType(getChangeData(change).refType))
    .filter(async change => !isPathAllowedBySdf(getChangeData(change)))
    .filter(async change => !(await suiteAppFileCabinet.isChangeDeployable(change)))
    .toArray()

  const largeFileErrors = await awu(notSupportedChanges)
    .filter(async change => suiteAppFileCabinet.isTooBigFileForSuiteApp(change))
    .map(getChangeData)
    .map(
      (inst): ChangeError => ({
        elemID: inst.elemID,
        severity: 'Error',
        message: "Can't deploy large files",
        detailedMessage:
          "Can't deploy this file since Salto does not support uploading files over 10 MB to the file cabinet.\n" +
          'Please remove this file from your deployment and add it directly in the NetSuite UI.',
      }),
    )
    .toArray()

  const disallowedModificationErrors = notSupportedChanges
    .filter(change => suiteAppFileCabinet.hasDisallowedValueModification(change))
    .map(getChangeData)
    .map(
      (inst): ChangeError => ({
        elemID: inst.elemID,
        severity: 'Error',
        message: "Can't deploy the generateurltimestamp field for files outside specific folders",
        detailedMessage:
          `The generateUrlTimestamp field can't be deployed since it is outside of the folders ${fileCabinetTopLevelFolders.join(', ')}.\n` +
          "To deploy this field, you can edit it in Salto. If it's a new field, set its value to false. If it's an existing field, please set it to the original value (false / true). Alternatively, you can edit the file in Salto, remove this field and do the change directly in the NetSuite UI.",
      }),
    )
  return [...disallowedModificationErrors, ...largeFileErrors]
}

export default changeValidator
