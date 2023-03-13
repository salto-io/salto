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

import { CustomizationInfo } from '../../src/client/types'
import { reorderDeployXml } from '../../src/client/deploy_xml_utils'
import { Graph, GraphNode, SDFObjectNode } from '../../src/client/graph_utils'
import { FILE, FOLDER } from '../../src/constants'

describe('deploy xml utils tests', () => {
  let testGraph: Graph<SDFObjectNode>
  beforeEach(() => {
    const testNode1 = new GraphNode<SDFObjectNode>(
      { elemIdFullName: 'fullName1', serviceid: 'scriptid1', changeType: 'addition', customizationInfo: { scriptId: 'scriptid1', typeName: '', values: {} } as CustomizationInfo }
    )
    const testNode2 = new GraphNode<SDFObjectNode>(
      { elemIdFullName: 'fullName2', serviceid: 'scriptid2', changeType: 'addition', customizationInfo: { scriptId: 'scriptid2', typeName: '', values: {} } as CustomizationInfo }
    )
    const testNode3 = new GraphNode<SDFObjectNode>(
      { elemIdFullName: 'fullName3', serviceid: 'scriptid3', changeType: 'addition', customizationInfo: { scriptId: 'scriptid3', typeName: '', values: {} } as CustomizationInfo }
    )
    testNode3.addEdge('elemIdFullName', testNode1)
    testNode1.addEdge('elemIdFullName', testNode2)
    testGraph = new Graph<SDFObjectNode>('elemIdFullName', [testNode1, testNode2, testNode3])
  })
  const originalDeployXml = `<deploy>
    <configuration>
        <path>~/AccountConfiguration/*</path>
    </configuration>
    <files>
      <path>~/FileCabinet/*</path>
    </files>
    <objects>
        <path>~/Objects/*</path>
    </objects>
    <translationimports>
        <path>~/Translations/*</path>
    </translationimports>
  </deploy>
  `

  it('should add objects to deploy xml according to reference level', async () => {
    const fixedDeployXml = `<deploy>
  <configuration>
    <path>~/AccountConfiguration/*</path>
  </configuration>
  <files>
    <path>~/FileCabinet/*</path>
  </files>
  <objects>
    <path>~/Objects/scriptid3.xml</path>
    <path>~/Objects/scriptid1.xml</path>
    <path>~/Objects/scriptid2.xml</path>
    <path>~/Objects/*</path>
  </objects>
  <translationimports>
    <path>~/Translations/*</path>
  </translationimports>
</deploy>
`
    expect(reorderDeployXml(originalDeployXml, testGraph)).toEqual(fixedDeployXml)
  })

  it('should write files and folders to deploy xml according to ref level', async () => {
    const emptyFileCustInfo = { typeName: FILE, values: {}, path: ['SuiteScripts', 'shalomTest.js'], content: '' }
    const emptyFolderCustInfo = { typeName: FOLDER, values: {}, path: ['SuiteScripts', 'InnerFolder'] }
    const fileTestNode = new GraphNode<SDFObjectNode>({ elemIdFullName: 'fullFileName', serviceid: '/SuiteScripts/shalomTest.js', customizationInfo: emptyFileCustInfo, changeType: 'addition' })
    const folderTestNode = new GraphNode<SDFObjectNode>({ elemIdFullName: 'fullFolderName', serviceid: '/SuiteScripts/InnerFolder', customizationInfo: emptyFolderCustInfo, changeType: 'addition' })
    fileTestNode.addEdge(testGraph.key, folderTestNode)
    testGraph.addNodes([fileTestNode, folderTestNode])
    const fixedDeployXml = `<deploy>
  <configuration>
    <path>~/AccountConfiguration/*</path>
  </configuration>
  <files>
    <path>~/FileCabinet/SuiteScripts/shalomTest.js</path>
    <path>~/FileCabinet/SuiteScripts/InnerFolder/*</path>
  </files>
  <objects>
    <path>~/Objects/scriptid3.xml</path>
    <path>~/Objects/scriptid1.xml</path>
    <path>~/Objects/scriptid2.xml</path>
    <path>~/Objects/*</path>
  </objects>
  <translationimports>
    <path>~/Translations/*</path>
  </translationimports>
</deploy>
`
    expect(reorderDeployXml(originalDeployXml, testGraph)).toEqual(fixedDeployXml)
  })
})
