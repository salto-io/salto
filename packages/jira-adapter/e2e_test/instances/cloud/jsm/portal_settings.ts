/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Values } from '@salto-io/adapter-api'

export const createPortalSettingsValues = (name: string): Values => ({
  name,
  description: 'Support Portal description',
  announcementSettings: {
    canAgentsManagePortalAnnouncement: true,
  },
})
