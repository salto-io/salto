/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator } from '@salto-io/adapter-api'
import {
  domainReadOnlyValidator,
  roleReadOnlyValidator,
  schemaFieldsValidator,
  systemRoleValidator,
  groupMemberRoleValidator,
  roleAssignmentAdditionValidator,
  groupDomainValidator,
} from './change_validators'
import { UserConfig } from './config'

export default ({ config }: { config: UserConfig }): Record<string, ChangeValidator> => ({
  domainReadOnly: domainReadOnlyValidator,
  roleReadOnly: roleReadOnlyValidator,
  schemaFields: schemaFieldsValidator,
  systemRole: systemRoleValidator,
  groupMemberRole: groupMemberRoleValidator,
  roleAssignmentAddition: roleAssignmentAdditionValidator,
  groupDomain: groupDomainValidator(config),
})
