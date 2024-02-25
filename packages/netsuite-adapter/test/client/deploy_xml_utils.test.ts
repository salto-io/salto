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

import { CustomizationInfo, SDFObjectNode as Node } from '../../src/client/types'
import { reorderDeployXml } from '../../src/client/deploy_xml_utils'
import { Graph, GraphNode } from '../../src/client/graph_utils'
import { FILE, FOLDER } from '../../src/constants'

type SDFObjectNode = Omit<Node, 'change'>

describe('deploy xml utils tests', () => {
  let testGraph: Graph<Node>
  let testNode1: GraphNode<SDFObjectNode>
  beforeEach(() => {
    testNode1 = new GraphNode<SDFObjectNode>('fullName1', {
      serviceid: 'scriptid1',
      changeType: 'addition',
      customizationInfo: { scriptId: 'scriptid1', typeName: '', values: {} } as CustomizationInfo,
    })
    const testNode2 = new GraphNode<SDFObjectNode>('fullName2', {
      serviceid: 'scriptid2',
      changeType: 'addition',
      customizationInfo: { scriptId: 'scriptid2', typeName: '', values: {} } as CustomizationInfo,
    })
    const testNode3 = new GraphNode<SDFObjectNode>('fullName3', {
      serviceid: 'scriptid3',
      changeType: 'addition',
      customizationInfo: { scriptId: 'scriptid3', typeName: '', values: {} } as CustomizationInfo,
    })
    testNode3.addEdge(testNode1)
    testNode1.addEdge(testNode2)
    testGraph = new Graph<Node>([testNode1, testNode2, testNode3] as unknown as GraphNode<Node>[])
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

  it('should only explictly add objects that dont have circular dependencies', async () => {
    const testNode4 = new GraphNode<SDFObjectNode>('fullName4', {
      serviceid: 'scriptid4',
      changeType: 'addition',
      customizationInfo: { scriptId: 'scriptid4', typeName: '', values: {} } as CustomizationInfo,
    })
    testGraph.removeNode('fullName1')
    // creates cycle in graph
    testNode4.addEdge(testNode1)
    testNode1.addEdge(testNode4)
    testGraph.addNodes([testNode4, testNode1] as GraphNode<Node>[])
    const fixedDeployXml = `<deploy>
  <configuration>
    <path>~/AccountConfiguration/*</path>
  </configuration>
  <files>
    <path>~/FileCabinet/*</path>
  </files>
  <objects>
    <path>~/Objects/scriptid3.xml</path>
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
    const fileTestNode = new GraphNode<SDFObjectNode>('fullFileName', {
      serviceid: '/SuiteScripts/shalomTest.js',
      customizationInfo: emptyFileCustInfo,
      changeType: 'addition',
    })
    const folderTestNode = new GraphNode<SDFObjectNode>('fullFolderName', {
      serviceid: '/SuiteScripts/InnerFolder',
      customizationInfo: emptyFolderCustInfo,
      changeType: 'addition',
    })
    fileTestNode.addEdge(folderTestNode)
    testGraph.addNodes([fileTestNode, folderTestNode] as GraphNode<Node>[])
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
})
