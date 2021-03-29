#                      Copyright 2021 Salto Labs Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
import os
import sys

def to_mock_details(logpath):
  with open(logpath) as logfile:
    return [l[l.find(': ') + 2:].strip() for l in logfile.readlines() if 'Full HTTP response' in l]

def main():
  if (len(sys.argv) != 3):
    print(f'Usage: {sys.argv[0]} <input log file> <output json file>')
    print(f'\tExample: {sys.argv[0]} log.txt mocks.json')
    return
  (logpath, mockpath) = sys.argv[1:]
  with open(mockpath, 'w') as mockfile:
    response_details = to_mock_details(logpath)
    mocks = ',\n'.join([f'\t{l}' for l in response_details])
    mockfile.writelines(f'[\n{mocks}\n]\n')

if __name__ == '__main__':
  main()
