/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import analyticsSilentFailureValidator from '../../src/change_validators/analytics_post_deploy_notification'
import { parsedDatasetType } from '../../src/type_parsers/analytics_parsers/parsed_dataset'
import { parsedWorkbookType } from '../../src/type_parsers/analytics_parsers/parsed_workbook'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'
import NetsuiteClient from '../../src/client/client'

describe('analytics post deploy notification', () => {
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
      undefined,
      undefined,
      undefined,
      client,
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
      undefined,
      undefined,
      undefined,
      client,
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
      undefined,
      undefined,
      undefined,
    )
    expect(changeErrors).toHaveLength(2)
  })
})
