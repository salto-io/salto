/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DownloadJob, UploadJob } from '../../../src/filters/guide_themes/types'

export const downloadJobResponse = (status: 'pending' | 'completed', url = 'clickMe!'): { job: DownloadJob } => ({
  job: { id: '1', status, data: { download: { url } } },
})

export const uploadJobResponse = (status: 'pending' | 'completed', url = 'clickMe!'): { job: UploadJob } => ({
  job: {
    id: '1',
    status,
    data: {
      upload: {
        url,
        parameters: {},
      },
      theme_id: 'abc',
    },
  },
})
