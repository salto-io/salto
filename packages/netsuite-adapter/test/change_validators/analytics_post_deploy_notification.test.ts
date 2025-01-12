/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import analyticsSilentFailureValidator from '../../src/change_validators/analytics_post_deploy_notification'
import { parsedDatasetType } from '../../src/type_parsers/analytics_parsers/parsed_dataset'
import { parsedWorkbookType } from '../../src/type_parsers/analytics_parsers/parsed_workbook'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import NetsuiteClient from '../../src/client/client'
import { mockChangeValidatorParams } from '../utils'

describe('analytics post deploy notification', () => {
  const baseParams = mockChangeValidatorParams()
  const firstDataset = new InstanceElement('dataset 1', parsedDatasetType().type, {
    scriptid: 'custDataset 1',
  })
  const secondDataset = new InstanceElement('dataset 2', parsedDatasetType().type, {
    scriptid: 'custDataset 2',
  })
  const firstWorkbook = new InstanceElement('workbook 1', parsedWorkbookType().type, {
    scriptid: 'custWorkbook 1',
  })
  const secondWorkbook = new InstanceElement('workbook 2', parsedWorkbookType().type, {
    scriptid: 'custWorkbook 2',
  })
  const other = new InstanceElement('other', workflowType().type, {
    scriptid: 'workflow',
  })
  const client = { url: 'ns_url' } as unknown as NetsuiteClient
  it('Should not have a post-deploy action if there is no dataset or workbook modification/addition', async () => {
    const changeErrors = await analyticsSilentFailureValidator(
      [
        toChange({ before: other, after: other }),
        toChange({ before: firstDataset }),
        toChange({ before: firstWorkbook }),
      ],
      { ...baseParams, client },
    )
    expect(changeErrors).toHaveLength(0)
  })

  it('Should have a post-deploy action if there is a dataset modification/addition', async () => {
    const changeErrors = await analyticsSilentFailureValidator(
      [
        toChange({ after: other }),
        toChange({ before: other, after: other }),
        toChange({ before: firstDataset, after: firstDataset }),
        toChange({ after: secondDataset }),
      ],
      { ...baseParams, client },
    )
    expect(changeErrors).toHaveLength(2)
  })
  it('Should have a post-deploy action if there is a workbook modification/addition', async () => {
    const changeErrors = await analyticsSilentFailureValidator(
      [
        toChange({ after: other }),
        toChange({ before: other, after: other }),
        toChange({ before: firstWorkbook, after: firstWorkbook }),
        toChange({ after: secondWorkbook }),
      ],
      baseParams,
    )
    expect(changeErrors).toHaveLength(2)
  })
})
