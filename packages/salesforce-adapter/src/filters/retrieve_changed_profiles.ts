/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { RemoteFilterCreator } from '../filter'
import { retrieveMetadataInstances } from '../fetch'
import { PROFILE_METADATA_TYPE } from '../constants'
import { isMetadataObjectType } from '../transformers/transformer'
import { apiNameSync } from './utils'

const PROFILE_RELATED_TYPES = [
  'Profile',
  'ApexClass',
  'ApexComponent',
  'ApexPage',
  'ApexTrigger',
  'AssignmentRules',
  'AuraDefinitionBundle',
  'Certificate',
  'ContentAsset',
  'CustomApplication',
  'CustomMetadata',
  'CustomObject',
  'CustomPermission',
  'Dashboard',
  'DashboardFolder',
  'Document',
  'DocumentFolder',
  'EclairGeoData',
  'EmailFolder',
  'EmailTemplate',
  'EmbeddedServiceConfig',
  'ExperienceBundle',
  'ExternalDataSource',
  'FlexiPage',
  'FlowDefinition',
  'LightningComponentBundle',
  'NetworkBranding',
  'PermissionSet',
  'Report',
  'ReportFolder',
  'ReportType',
  'Scontrol',
  'SharingRules',
  'SiteDotCom',
  'StaticResource',
  'InstalledPackage',
  'Territory2',
  'Territory2Model',
  'Territory2Rule',
  'Territory2Type',
  'TopicsForObjects',
  'Layout',
  'Workflow',
]

const filterCreator: RemoteFilterCreator = ({ config, client }) => ({
  remote: true,
  name: 'mergeProfilesWithSourceValues',
  onFetch: async elements => {
    if (!config.fetchProfile.metadataQuery.isFetchWithChangesDetection()) {
      return
    }
    const profileRelatedMetadataTypes = elements
      .filter(isMetadataObjectType)
      .filter(type => PROFILE_RELATED_TYPES.includes(apiNameSync(type) ?? ''))
    const instances = await retrieveMetadataInstances({
      client,
      types: profileRelatedMetadataTypes,

    })
  },
})

export default filterCreator
