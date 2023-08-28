#!/usr/bin/python3

import os
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import wait, expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import logging
from pathlib import Path
from collections import defaultdict
from types_generation.types_generator import login
from constants import LICENSE_HEADER, TABLE_ROW, TABLE_DATA
import json

SCRIPT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(SCRIPT_DIR, '../../src/autogen/')
BUNDLE_COMPONENTS_DIR = os.path.join(SRC_DIR, 'bundle_components/')
FULL_LINE_LENGTH = 4
BUNDLE_IDS = [332172, 39609, 53195, 233251, 47492]
NO_VERSION = 'NO_VERSION'

search_bundles_link_template = 'https://{account_id}.app.netsuite.com/app/bundler/installbundle.nl?whence='

bundle_components_file_template = LICENSE_HEADER + '''

type BundleVersionToComponents = Readonly<Record<string, Set<string>>>

export const BUNDLE_ID_TO_COMPONENTS: Readonly<Record<string, BundleVersionToComponents>> = {{
{bundle_id_to_components}
}}
'''
def wait_on_element(webpage):
  element = webpage.find_element(By.XPATH, '//*[@id="div__lab1"]')
  if element:
    return element
  return False

def parse_components_table(bundle_id_to_components, bundle_id, components_table, webpage, driverWait):
  webpage_version = webpage.find_element(By.CSS_SELECTOR, '[data-searchable-id="mainmainversion"] > .uir-field')
  print('Bundle id is: ', bundle_id, 'with version: ',webpage_version.text.strip())
  version = webpage_version.text.strip() if webpage_version.text.strip() != '' else NO_VERSION
  # wait until loading row disappears and the table is fully loaded.
  driverWait.until(wait_on_element)
  for row in components_table.find_elements(By.TAG_NAME, TABLE_ROW)[3:]:
    cells = row.find_elements(By.TAG_NAME, TABLE_DATA)
    if len(cells) >= FULL_LINE_LENGTH and cells[3].text.strip()!= '' and (not cells[3].text.strip().isdigit()):
      bundle_id_to_components[bundle_id][version].append(cells[3].text)
  webpage.back()


def parse_bundle_components(account_id, username, password, secret_key_2fa, webpage, driverWait):
  logging.info('Starting to parse bundles')
  try:
    webpage.get(search_bundles_link_template.format(account_id = account_id))
    login(username, password, secret_key_2fa, webpage)
    bundle_id_to_components = defaultdict(lambda: defaultdict(list))
    for bundle_id in BUNDLE_IDS:
      search_field = driverWait.until(lambda driver: driver.find_element(By.XPATH, '//*[@id="keywords"]'))
      search_field.clear() # clear previous input if it exits
      search_field.send_keys(bundle_id)
      webpage.find_element(By.XPATH, '//*[@id="search"]').click()
      driverWait.until(lambda driver: driver.find_element(By.XPATH, '//*[@id="name1href"]')).click()
      try:
        driverWait.until(EC.text_to_be_present_in_element((By.TAG_NAME, 'body'), 'You have not been granted access to the bundle.'))
        # for private bundles we return an empty Record
        bundle_id_to_components[bundle_id] = {}
        webpage.back()
      except TimeoutException:
        driverWait.until(lambda driver: driver.find_element(By.XPATH, '//*[@id="componentstabtxt"]')).click()
        components_table = driverWait.until(lambda d: d.find_element(By.XPATH, '//*[@id="contentslist__tab"]')) 
        parse_components_table(bundle_id_to_components, bundle_id, components_table, webpage, driverWait)
  finally:
    webpage.quit()
  return bundle_id_to_components

def format_components(bundle_id_to_components):
  table_content = ""

  for bundle_id, bundle_versions in bundle_id_to_components.items():
    table_content += f'  {bundle_id}: {{\n'
    for version, files in bundle_versions.items():
      if version == NO_VERSION:
        table_content += f'    {version}: new Set({files}),\n'
      else:
        table_content += f'    \'{version}\': new Set({files}),\n'
    table_content += "  },\n"
  return table_content

def generate_bundle_map_file(bundle_id_to_components):
  formatted_components = format_components(bundle_id_to_components)
  file_content = bundle_components_file_template.format(bundle_id_to_components = formatted_components)
  Path(BUNDLE_COMPONENTS_DIR).mkdir(parents=True, exist_ok=True)
  with open(BUNDLE_COMPONENTS_DIR + 'bundle_components.ts', 'w') as file:
    file.write(file_content)

def create_merged_map(bundle_id_to_components):
  file_path = 'bundle_component.json'

  if not os.path.exists(file_path):
    json_data = json.dumps(bundle_id_to_components)
    with open('bundle_component.json', 'w') as file:
      file.write(json_data)
    return bundle_id_to_components

  else:
    with open(file_path, 'r') as file:
      existing_data = json.load(file)
    
    merged_data = merge_dictionaries(existing_data, bundle_id_to_components)

    with open(file_path, 'w') as file:
      file.write(json.dumps(merged_data))
    return merged_data

def merge_dictionaries(existing_data, new_bundle_dict):
  merged_dict = {}
  for bundle_id in new_bundle_dict:
    new_bundle_data = new_bundle_dict[bundle_id]
    
    if bundle_id not in existing_data:
      merged_dict[bundle_id] = new_bundle_data

    else:
      existing_bundle_data = existing_data[bundle_id]

      for version in new_bundle_data:
        if version not in existing_bundle_data:
          existing_bundle_data[version] = new_bundle_data
          merged_dict[bundle_id] = existing_bundle_data

  return merged_dict

def main():
  webpage = webdriver.Chrome()
  driverWait = wait.WebDriverWait(webpage, 15)
  account_id, username, password, secret_key_2fa = (sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
  bundle_to_components = parse_bundle_components(account_id, username, password, secret_key_2fa, webpage, driverWait)
  merged_bundle_map = create_merged_map(bundle_to_components)
  generate_bundle_map_file(merged_bundle_map)

if __name__=='__main__':
  main()