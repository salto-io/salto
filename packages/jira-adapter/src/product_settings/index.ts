/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { CLOUD_SETTINGS } from './cloud'
import { ProductSettings } from './product_settings'
import { DATA_CENTER_SETTINGS } from './data_center/data_center'

export const getProductSettings = ({ isDataCenter }: { isDataCenter: boolean }): ProductSettings =>
  isDataCenter ? DATA_CENTER_SETTINGS : CLOUD_SETTINGS
