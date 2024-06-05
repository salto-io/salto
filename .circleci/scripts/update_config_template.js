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

const { execSync } = require('child_process')
const { readFileSync, writeFileSync, existsSync, readdirSync } = require('fs')
const path = require('path')


const main = () => {
  const configTemplate = readFileSync(path.join(__dirname, '..', 'config_template.yml'), 'utf8')
  const adaptersWithJava = readFileSync(path.join(__dirname, '..', 'adapters_with_java.txt'), 'utf8').split('\n').filter(Boolean)
  const e2ePackagesToTest = readFileSync(path.join(__dirname, '..', 'e2e_packages_to_test.txt'), 'utf8').split('\n').filter(Boolean)
  console.log('e2ePackagesToTest:', e2ePackagesToTest)
  const e2ePackages = e2ePackagesToTest.filter(pkg => !adaptersWithJava.includes(pkg))
  const e2ePackagesWithJava = e2ePackagesToTest.filter(pkg => adaptersWithJava.includes(pkg))

  const e2eTestMatrix = `
      - e2e_tests:
          requires:
            - build
          matrix:
            alias: e2e_tests_without_java
            parameters:
              package_name: 
                - ${e2ePackages.join('\n                - ')}
              should_install_java: 
                - false
`
  const e2eTestMatrixWithJava =`
      - e2e_tests:
          requires:
            - build
          matrix:
            alias: e2e_tests_with_java
            parameters:
              package_name: 
                - ${e2ePackagesWithJava.join('\n                - ')}
              should_install_java: 
                - true
`
  const alteredConfigWithJavaE2es = e2ePackagesWithJava.length > 0 ? 
                            configTemplate.replace(/# <NEEDS_E2E_TEST_REQUIREMENT_JAVA>/g, '- e2e_tests_with_java')
                                          .replace(/# <TEST_MATRIX_E2E_JAVA>/g, e2eTestMatrixWithJava)
                            : configTemplate.replace(/# <NEEDS_E2E_TEST_REQUIREMENT_JAVA>/g, '')
                                           .replace(/# <TEST_MATRIX_E2E_JAVA>/g, '')
  const alteredConfigTemplate = e2ePackages.length > 0 ? 
                alteredConfigWithJavaE2es.replace(/# <NEEDS_E2E_TEST_REQUIREMENT>/g, '- e2e_tests_without_java')
                            .replace(/# <TEST_MATRIX_E2E>/g, e2eTestMatrix)
            : alteredConfigWithJavaE2es.replace(/# <NEEDS_E2E_TEST_REQUIREMENT>/g, '')
                            .replace(/# <TEST_MATRIX_E2E>/g, '')
  
  writeFileSync(path.join(__dirname, '..', 'continue_config.yml'), alteredConfigTemplate)
  console.log(alteredConfigTemplate)
}

main()
