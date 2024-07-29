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

// Disable salesforce logging for a few reasons:
// 1. It has a significant impact on memory consumption
// 2. It creates timers that delay the termination of the process
// 3. It uses relative paths to reference source files and thus cannot work when packed
process.env.SF_DISABLE_LOG_FILE = 'true'
// Due to an issue in the implementation of @jsforce/jsforce-node, it will emit a "console.error" if the process runs
// without a `HOME` environment variable configured.
// They have a PR to fix it, but until that issue is fixed, using this configuration works around the code path that
// leads to "console.error".
// Since we should never actually call any function that uses a connection from that library, this should not really
// affect anything.
process.env.JSFORCE_CONNECTION_REGISTRY = 'sfdx'
