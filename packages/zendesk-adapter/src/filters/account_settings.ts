/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'

export const ACCOUNT_SETTING_TYPE_NAME = 'account_setting'

/**
 * Deploys account settings
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client, definitions }) => ({
  name: 'accountSettingsFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [accountSettingChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === ACCOUNT_SETTING_TYPE_NAME,
    )
    if (accountSettingChanges.length > 1) {
      const message = `${ACCOUNT_SETTING_TYPE_NAME} element is a singleton and should have only on instance. Found multiple: ${accountSettingChanges.length}`
      return {
        deployResult: {
          appliedChanges: [],
          errors: [
            {
              message,
              detailedMessage: message,
              severity: 'Error',
            },
          ],
        },
        leftoverChanges,
      }
    }
    const deployResult = await deployChanges(accountSettingChanges, async change => {
      const fieldsToIgnore =
        getChangeData(change).value.routing?.autorouting_tag === '' ? ['routing.autorouting_tag'] : []
      await deployChange({
        change,
        client,
        apiDefinitions: oldApiDefinitions,
        fieldsToIgnore,
        definitions,
      })
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
