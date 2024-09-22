/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  InstanceElement,
  ChangeGroup,
  ReadOnlyElementsSource,
  ActionName,
  SaltoElementError,
} from '@salto-io/adapter-api'

export type ChangeAndContext = {
  change: Change<InstanceElement>
  changeGroup: Readonly<ChangeGroup>
  elementSource: ReadOnlyElementsSource
  // additional values that can be passed between requests or filters within the operation
  // (e.g. an id returned from one response that should be used in the next)
  sharedContext: Record<string, unknown>
}

export type ChangeAndExtendedContext = ChangeAndContext & {
  // current errors from the infra's deployment of the change group, by change elem id
  errors: Record<string, SaltoElementError[]>
}

export type DeployChangeInput<AdditionalAction extends string> = ChangeAndExtendedContext & {
  action: ActionName | AdditionalAction
}
