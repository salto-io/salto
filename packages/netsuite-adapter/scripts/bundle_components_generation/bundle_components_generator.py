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
import logging
logging.basicConfig(filename='bundle_generation.log', level=logging.DEBUG)

SCRIPT_DIR = os.path.dirname(__file__)
SRC_DIR = os.path.join(SCRIPT_DIR, '../../src/autogen/')
BUNDLE_COMPONENTS_DIR = os.path.join(SRC_DIR, 'bundle_components/')
FULL_LINE_LENGTH = 4
BUNDLES_INFO = [(53195, 'PRODUCTION', 3912261), (47193, 'PRODUCTION', 3834147), (220096, 'PRODUCTION', 1940985),(123426, 'PRODUCTION', 4517454),(395822, 'PRODUCTION', 2418281),(38321, 'PRODUCTION', 3685018),(471284, 'PRODUCTION', 9067436),(272559, 'PRODUCTION', 2056492),(294288, 'PRODUCTION', 1863397),(25250, 'PRODUCTION', 3546841),(202156, 'PRODUCTION', 4918645),(303903, 'PRODUCTION', 5888283),(228224, 'PRODUCTION', 5017755),(202278, 'PRODUCTION', 4851490),(248158, 'PRODUCTION', 4918539),(69019, 'PRODUCTION', 4089988),(296482, 'PRODUCTION', 5773159),(228839, 'PRODUCTION', 5076310),(302124, 'PRODUCTION', 5866512),(233151, 'PRODUCTION', 4680257),(41296, 'PRODUCTION', 3751217),(338113, 'PRODUCTION', 6649340),(48331, 'PRODUCTION', 3845642),(307509, 'PRODUCTION', 5971501),(407373, 'PRODUCTION', 7277041),(116144, 'PRODUCTION', 4492328),(8792, 'PRODUCTION', 1149806),(381166, 'PRODUCTION', 7222220),(466992, 'PRODUCTION', 8909345),(266623, 'PRODUCTION', 5444133),(400554, 'PRODUCTION', 7450689),(28006, 'PRODUCTION', 3590083),(247488, 'PRODUCTION', 5238483),(276803, 'PRODUCTION', 2056492),(109485, 'PRODUCTION', 4029912),(402113, 'PRODUCTION', 2382091),(500853, 'PRODUCTION', 4929261),(241945, 'PRODUCTION', 5112211),(258730, 'PRODUCTION', 5311457),(47492, 'PRODUCTION', 3838953),(260367, 'PRODUCTION', 4992873),(464455, 'PRODUCTION', 2428865),(312388, 'PRODUCTION', 1283062),(67350, 'PRODUCTION', 4077295),(286091, 'PRODUCTION', 5610285),(385758, 'PRODUCTION', 7129008),(354075, 'PRODUCTION', 6771601),(147355, 'PRODUCTION', 4634152),(343848, 'PRODUCTION', 2297189),(181105, 'PRODUCTION', 4825319),(77203, 'PRODUCTION', 4125768),(49118, 'PRODUCTION', 3854066),(281353, 'PRODUCTION', 5620581),(488712, 'PRODUCTION', 9322946),(223208, 'PRODUCTION', 5005395),(480805, 'PRODUCTION', 2423472),(317199, 'PRODUCTION', 5773159),(17361, 'SANDBOX', 1309466),(293699, 'PRODUCTION', 5753515),(338744, 'PRODUCTION', 6422302),(185214, 'PRODUCTION', 4851490),(243341, 'PRODUCTION', 5112223),(444229, 'PRODUCTION', 8241742),(64313, 'PRODUCTION', 4045800),(286093, 'PRODUCTION', 5610285),(486222, 'PRODUCTION', 9294278),(249935, 'PRODUCTION', 5238505),(44281, 'PRODUCTION', 3802169),(94468, 'PRODUCTION', 3486911),(255470, 'PRODUCTION', 5328952),(256432, 'PRODUCTION', 5306639),(486381, 'PRODUCTION', 9294925),(325480, 'PRODUCTION', 2059571),(164289, 'PRODUCTION', 4679177),(251993, 'PRODUCTION', 5241813),(256435, 'PRODUCTION', 5306639),(248760, 'PRODUCTION', 5268822),(42036, 'PRODUCTION', 3758190),(288380, 'PRODUCTION', 5689656),(301545, 'PRODUCTION', 5849659),(217070, 'PRODUCTION', 4920140),(392913, 'PRODUCTION', 6895540),(289764, 'PRODUCTION', 1568320),(369637, 'PRODUCTION', 6993781),(334830, 'PRODUCTION', 6512475),(338741, 'PRODUCTION', 6422302),(380859, 'PRODUCTION', 7213590),(254709, 'PRODUCTION', 5311457),(92373, 'PRODUCTION', 4295572),(2851, 'PRODUCTION', 660883),(427237, 'PRODUCTION', 2423472),(43003, 'PRODUCTION', 3776651),(265450, 'PRODUCTION', 4918539),(362244, 'PRODUCTION', 1283062),(292237, 'PRODUCTION', 5306639),(51007, 'PRODUCTION', 3872646),(198386, 'PRODUCTION', 4865727),(219120, 'PRODUCTION', 4992828),(421277, 'PRODUCTION', 5220293),(411460, 'PRODUCTION', 2428865),(239645, 'PRODUCTION', 5109967),(486259, 'PRODUCTION', 9295303),(402703, 'PRODUCTION', 7387260),(210159, 'PRODUCTION', 4878346),(443808, 'PRODUCTION', 444558),(267306, 'PRODUCTION', 5450872),(69017, 'PRODUCTION', 4089992),(488833, 'PRODUCTION', 9324619),(16707, 'PRODUCTION', 3403378),(312849, 'PRODUCTION', 6188504),(446901, 'PRODUCTION', 4527410),(375624, 'PRODUCTION', 2382091),(17447, 'PRODUCTION', 3424416),(250352, 'PRODUCTION', 5238496),(165215, 'PRODUCTION', 4453644),(250732, 'PRODUCTION', 5238509),(286081, 'PRODUCTION', 5573488),(49018, 'PRODUCTION', 3849685),(256715, 'PRODUCTION', 5291956),(467447, 'PRODUCTION', 8939998),(413984, 'PRODUCTION', 2297189),(331808, 'PRODUCTION', 1962982),(219279, 'PRODUCTION', 4992882),(219322, 'PRODUCTION', 4930483),(348013, 'PRODUCTION', 5620581),(127355, 'PRODUCTION', 4530318),(297494, 'PRODUCTION', 5671058),(198385, 'PRODUCTION', 4865727),(436209, 'PRODUCTION', 8177039),(228841, 'PRODUCTION', 5076310),(322956, 'PRODUCTION', 6389922),(399233, 'PRODUCTION', 7453004),(328363, 'PRODUCTION', 2059571),(220018, 'PRODUCTION', 4930477),(250341, 'PRODUCTION', 5281608),(301860, 'PRODUCTION', 5863775),(480662, 'PRODUCTION', 2369660),(317102, 'PRODUCTION', 6247083),(230097, 'PRODUCTION', 5076248),(219306, 'PRODUCTION', 4992882),(218286, 'PRODUCTION', 4992828),(419251, 'PRODUCTION', 5676669),(36478, 'PRODUCTION', 3685019),(27369, 'PRODUCTION', 3564128),(219479, 'PRODUCTION', 4992873),(371551, 'PRODUCTION', 2382091),(244097, 'PRODUCTION', 5230724),(254263, 'PRODUCTION', 5307096),(491461, 'PRODUCTION', 1568320),(359132, 'PRODUCTION', 6958612),(260434, 'PRODUCTION', 1962982),(219307, 'PRODUCTION', 4992882),(468619, 'PRODUCTION', 8997875),(425774, 'PRODUCTION', 8017075),(459771, 'PRODUCTION', 8301606),(404928, 'PRODUCTION', 7511236),(413609, 'PRODUCTION', 2382091),(47459, 'PRODUCTION', 3776705),(286083, 'PRODUCTION', 5573488),(468574, 'PRODUCTION', 8997786),(319460, 'PRODUCTION', 1568320),(414835, 'PRODUCTION', 2382091),(412967, 'PRODUCTION', 5187423),(385757, 'PRODUCTION', 7129008),(405717, 'PRODUCTION', 7372031),(467364, 'PRODUCTION', 65900),(21147, 'PRODUCTION', 3525954),(314864, 'PRODUCTION', 5880772),(317462, 'PRODUCTION', 5187423),(500910, 'PRODUCTION', 2740319),(217069, 'PRODUCTION', 4920140),(58416, 'PRODUCTION', 3966833),(49333, 'PRODUCTION', 3856705),(53051, 'PRODUCTION', 3904464),(314865, 'PRODUCTION', 5880772),(217071, 'PRODUCTION', 4920140),(384223, 'PRODUCTION', 4559687),(251783, 'PRODUCTION', 5295622),(249416, 'PRODUCTION', 5238500),(347046, 'PRODUCTION', 2056492),(338212, 'PRODUCTION', 6649505),(220017, 'PRODUCTION', 4930477),(95282, 'PRODUCTION', 3838888),(94255, 'PRODUCTION', 4219438),(53195, 'PRODUCTION', 3912261),(464729, 'PRODUCTION', 8767842),(169224, 'PRODUCTION', 4773119),(34369, 'PRODUCTION', 3433572),(281760, 'PRODUCTION', 5610292),(359209, 'PRODUCTION', 6959270),(19656, 'PRODUCTION', 3368792),(248167, 'PRODUCTION', 4918539),(132058, 'PRODUCTION', 4537879),(179378, 'PRODUCTION', 4679885),(477064, 'PRODUCTION', 9105972),(446730, 'PRODUCTION', 8296255),(4154, 'PRODUCTION', 571943),(354076, 'PRODUCTION', 6771601),(341701, 'PRODUCTION', 444558),(199464, 'PRODUCTION', 4877486),(354512, 'PRODUCTION', 6403187),(496890, 'PRODUCTION', 9418963),(286063, 'PRODUCTION', 5573488),(219484, 'PRODUCTION', 4992873),(244699, 'PRODUCTION', 5106778),(305592, 'PRODUCTION', 4515968),(414815, 'PRODUCTION', 7681516),(254701, 'PRODUCTION', 5311457),(392827, 'PRODUCTION', 7374885),(410184, 'PRODUCTION', 2418281),(395663, 'PRODUCTION', 2418281),(249292, 'PRODUCTION', 5274085),(413123, 'PRODUCTION', 2297189),(218287, 'PRODUCTION', 4992828),(190350, 'PRODUCTION', 3420235),(47193, 'PRODUCTION', 3834147),(281349, 'PRODUCTION', 5620581),(397992, 'PRODUCTION', 7405743),(248415, 'PRODUCTION', 1568321),(239173, 'PRODUCTION', 5172011),(395113, 'PRODUCTION', 7390095),(423978, 'PRODUCTION', 8012499),(282505, 'PRODUCTION', 5134476),(281356, 'PRODUCTION', 5620581),(265658, 'PRODUCTION', 4918539),(373062, 'PRODUCTION', 7078778),(468610, 'PRODUCTION', 8992743),(341388, 'PRODUCTION', 2243192),(190323, 'PRODUCTION', 4866469),(467597, 'PRODUCTION', 8948388),(323305, 'PRODUCTION', 1962982),(166020, 'PRODUCTION', 4665146),(210160, 'PRODUCTION', 4878346),(464363, 'PRODUCTION', 8802227),(239499, 'PRODUCTION', 5108699),(248562, 'PRODUCTION', 1965430),(395821, 'PRODUCTION', 2418281),(12610, 'PRODUCTION', 660883),(250407, 'PRODUCTION', 5288338),(302960, 'PRODUCTION', 5773159),(363984, 'PRODUCTION', 6999753),(308846, 'PRODUCTION', 6065504),(251246, 'PRODUCTION', 5293192),(344590, 'PRODUCTION', 6525208),(311390, 'PRODUCTION', 6169444),(497478, 'PRODUCTION', 9439287),(354070, 'PRODUCTION', 6771601),(26846, 'PRODUCTION', 3595190),(490515, 'PRODUCTION', 9341188),(377979, 'PRODUCTION', 4811730),(251558, 'PRODUCTION', 5294745),(286094, 'PRODUCTION', 5610285),(295131, 'PRODUCTION', 5649323),(62340, 'PRODUCTION', 3956803),(249263, 'PRODUCTION', 5273860),(48476, 'PRODUCTION', 3848769),(249422, 'PRODUCTION', 5275473),(348011, 'PRODUCTION', 5620581),(143437, 'PRODUCTION', 4623185),(153470, 'PRODUCTION', 4219438),(316640, 'PRODUCTION', 6242896),(245936, 'PRODUCTION', 5017755),(350138, 'PRODUCTION', 6824171),(405648, 'PRODUCTION', 7372023),(286129, 'PRODUCTION', 4527410),(270798, 'PRODUCTION', 5478799),(161223, 'PRODUCTION', 4453644),(500712, 'PRODUCTION', 8241133),(486462, 'PRODUCTION', 2297189),(359508, 'PRODUCTION', 2354039),(251769, 'PRODUCTION', 5295597),(411095, 'PRODUCTION', 2428865),(445345, 'PRODUCTION', 8274429),(241677, 'PRODUCTION', 1568321),(412881, 'PRODUCTION', 5493088),(8443, 'PRODUCTION', 1149806),(33437, 'PRODUCTION', 3638698),(410870, 'PRODUCTION', 2428865),(380861, 'PRODUCTION', 7213590),(373485, 'PRODUCTION', 7060036),(167235, 'PRODUCTION', 4766402),(167330, 'PRODUCTION', 4767356),(449406, 'PRODUCTION', 8334838),(296469, 'PRODUCTION', 1568321),(387667, 'PRODUCTION', 7129008),(286092, 'PRODUCTION', 5610285),(250929, 'PRODUCTION', 5291237),(47196, 'PRODUCTION', 3834909),(328209, 'PRODUCTION', 4559687),(250724, 'PRODUCTION', 5238508),(284929, 'PRODUCTION', 5470796),(223212, 'PRODUCTION', 5005395),(248750, 'PRODUCTION', 5268793),(395819, 'PRODUCTION', 2418281),(333158, 'PRODUCTION', 6496277),(297909, 'PRODUCTION', 5671063),(373094, 'PRODUCTION', 7078778),(244690, 'PRODUCTION', 5234691),(57060, 'PRODUCTION', 3949705),(303913, 'PRODUCTION', 5891573),(122422, 'PRODUCTION', 4453644),(284927, 'PRODUCTION', 5470796),(405710, 'PRODUCTION', 7372031),(203059, 'PRODUCTION', 4921599),(251806, 'PRODUCTION', 5295740),(385249, 'PRODUCTION', 2354039),(486952, 'PRODUCTION', 2297189),(491023, 'PRODUCTION', 2547723),(388888, 'PRODUCTION', 4515968),(422358, 'PRODUCTION', 7598713),(276692, 'PRODUCTION', 4866942),(29321, 'PRODUCTION', 3596425),(369166, 'PRODUCTION', 2382090),(219323, 'PRODUCTION', 4930483),(240841, 'PRODUCTION', 5112204),(312584, 'PRODUCTION', 6173818),(430400, 'PRODUCTION', 444558),(53053, 'PRODUCTION', 3904462),(308820, 'PRODUCTION', 1962982),(23103, 'PRODUCTION', 3554037),(134181, 'PRODUCTION', 4549476),(380671, 'PRODUCTION', 6758546),(245955, 'PRODUCTION', 5232642),(230099, 'PRODUCTION', 5076248),(283976, 'PRODUCTION', 1568320),(230734, 'PRODUCTION', 5076310),(41420, 'PRODUCTION', 3755658),(45178, 'PRODUCTION', 3778273),(400562, 'PRODUCTION', 7450686),(312859, 'PRODUCTION', 6188565),(220014, 'PRODUCTION', 4930477),(56125, 'PRODUCTION', 3923787),(435663, 'PRODUCTION', 444558),(297121, 'PRODUCTION', 5773159),(222420, 'PRODUCTION', 5021564),(286061, 'PRODUCTION', 5573488),(270799, 'PRODUCTION', 5479044),(490204, 'PRODUCTION', 9338590),(375099, 'PRODUCTION', 7094595),(270800, 'PRODUCTION', 5479074),(444573, 'PRODUCTION', 8017072),(14927, 'PRODUCTION', 3372002),(112449, 'PRODUCTION', 4203227),(107016, 'PRODUCTION', 4450190),(58023, 'PRODUCTION', 3958187),(272756, 'PRODUCTION', 5023963),(439833, 'PRODUCTION', 8204881),(356248, 'PRODUCTION', 6936516),(260430, 'PRODUCTION', 1962982),(249788, 'PRODUCTION', 5278569),(331180, 'PRODUCTION', 6465930),(269695, 'PRODUCTION', 1962982),(286064, 'PRODUCTION', 5573488),(36477, 'PRODUCTION', 3685016),(49247, 'PRODUCTION', 3856193),(210158, 'PRODUCTION', 4878346),(17653, 'SANDBOX', 1309466),(422673, 'PRODUCTION', 7966533),(346642, 'PRODUCTION', 2297189),(163135, 'PRODUCTION', 4453640),(300047, 'PRODUCTION', 5822297),(324055, 'PRODUCTION', 1568320),(192046, 'PRODUCTION', 4679923),(249983, 'PRODUCTION', 5241873),(254705, 'PRODUCTION', 5311457),(418641, 'PRODUCTION', 2382091),(250920, 'PRODUCTION', 5272456),(77210, 'PRODUCTION', 4125768),(250891, 'PRODUCTION', 5291023),(4159, 'PRODUCTION', 571943),(270801, 'PRODUCTION', 5479105),(312814, 'PRODUCTION', 6188309),(112469, 'PRODUCTION', 4463997),(168463, 'PRODUCTION', 4771385),(455185, 'PRODUCTION', 8479900),(364000, 'PRODUCTION', 6999572),(312817, 'PRODUCTION', 6188322),(314888, 'PRODUCTION', 5880772),(334874, 'PRODUCTION', 1568320),(237702, 'PRODUCTION', 4824246),(354072, 'PRODUCTION', 6771601),(358126, 'PRODUCTION', 61399),(237699, 'PRODUCTION', 5170090),(429861, 'PRODUCTION', 2423472),(26153, 'PRODUCTION', 3563537),(213294, 'PRODUCTION', 4977580),(187488, 'PRODUCTION', 4858195),(265447, 'PRODUCTION', 4930477),(320155, 'PRODUCTION', 5291376),(244403, 'PRODUCTION', 5103995),(302959, 'PRODUCTION', 5773159),(17524, 'SANDBOX', 1309466),(286060, 'PRODUCTION', 5573488),(281755, 'PRODUCTION', 5610292),(416781, 'PRODUCTION', 7868193),(410185, 'PRODUCTION', 2418281),(286052, 'PRODUCTION', 5556801),(202280, 'PRODUCTION', 4920152),(35075, 'PRODUCTION', 3660481),(482718, 'PRODUCTION', 9238873),(188088, 'PRODUCTION', 3906557),(347165, 'PRODUCTION', 444558),(390151, 'PRODUCTION', 7129008),(354073, 'PRODUCTION', 6771601),(239212, 'PRODUCTION', 5172011),(319542, 'PRODUCTION', 1568320),(132060, 'PRODUCTION', 4537866),(419588, 'PRODUCTION', 7912315),(41309, 'PRODUCTION', 3751218),(341344, 'PRODUCTION', 2243192),(185105, 'PRODUCTION', 4849136),(375075, 'PRODUCTION', 7093972),(364290, 'PRODUCTION', 2297188),(318158, 'PRODUCTION', 6261605),(1894, 'PRODUCTION', 709602),(224753, 'PRODUCTION', 4679862),(330428, 'PRODUCTION', 6371451),(292257, 'PRODUCTION', 5610292),(352481, 'PRODUCTION', 1962982),(257625, 'PRODUCTION', 1283062),(13512, 'PRODUCTION', 660883),(405015, 'PRODUCTION', 7513236),(185219, 'PRODUCTION', 4851544),(134179, 'PRODUCTION', 4549484),(447660, 'PRODUCTION', 8189722),(284926, 'PRODUCTION', 5470796),(21352, 'PRODUCTION', 3507939),(279508, 'PRODUCTION', 5606292),(472167, 'PRODUCTION', 2297189),(188299, 'PRODUCTION', 4859773),(107253, 'PRODUCTION', 4219438),(410864, 'PRODUCTION', 2428865),(245935, 'PRODUCTION', 5017755),(470152, 'PRODUCTION', 9054342),(484689, 'PRODUCTION', 2203789),(338746, 'PRODUCTION', 6422302),(219297, 'PRODUCTION', 4930483),(186103, 'PRODUCTION', 4854980),(146013, 'PRODUCTION', 4453644),(372579, 'PRODUCTION', 5187423),(108404, 'PRODUCTION', 4125768),(219480, 'PRODUCTION', 4992873),(134180, 'PRODUCTION', 4549482),(22491, 'PRODUCTION', 3486911),(323359, 'PRODUCTION', 5187423),(233125, 'PRODUCTION', 4992882),(500777, 'PRODUCTION', 9523272)]
NO_VERSION = 'NO_VERSION'
NO_ACCESS_ERROR_MESSAGE = 'You have not been granted access to the bundle.'
UNEXPECTED_ERROR_MESSAGE = 'An unexpected error has occurred'
bundles_link_template = 'https://{account_id}.app.netsuite.com/app/bundler/bundledetails.nl?sourcecompanyid={publisher_id}&domain={installed_from}&config=F&id={bundle_id}'


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
  version_element = webpage.find_element(By.CSS_SELECTOR, 'div[data-nsps-label="Version"] .uir-field.inputreadonly')
  version = version_element.text.strip() if version_element.text.strip() != '' else NO_VERSION
  print('Bundle id is: ', bundle_id, 'with version: ',version)
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
    webpage.get('https://{account_id}.app.netsuite.com/app/center/card.nl?sc=-29&whence='.format(account_id = account_id))
    login(username, password, secret_key_2fa, webpage)
    bundle_id_to_components = defaultdict(lambda: defaultdict(list))
    unfetched_bundles = []
    for bundle_info in BUNDLES_INFO:
      bundle_id, installed_from, publisher_id = bundle_info
      if (not (installed_from and publisher_id)):
        unfetched_bundles.append((bundle_id, installed_from, publisher_id))
        continue
      webpage.get(bundles_link_template.format(account_id = account_id, publisher_id = publisher_id, installed_from = installed_from, bundle_id = bundle_id))
      try:
        error_conditions = lambda driver: NO_ACCESS_ERROR_MESSAGE in driver.find_element(By.TAG_NAME, 'body').text or UNEXPECTED_ERROR_MESSAGE in driver.find_element(By.TAG_NAME, 'body').text
        driverWait.until(error_conditions)
        # for private bundles we return an empty Record
        bundle_id_to_components[bundle_id] = {}
        webpage.back()
      except TimeoutException:
        driverWait.until(lambda driver: driver.find_element(By.XPATH, '//*[@id="componentstabtxt"]')).click()
        components_table = driverWait.until(lambda d: d.find_element(By.XPATH, '//*[@id="contentslist__tab"]')) 
        try:
          parse_components_table(bundle_id_to_components, bundle_id, components_table, webpage, driverWait)
        except TimeoutException:
          unfetched_bundles.append((bundle_id, installed_from, publisher_id))
  finally:
    webpage.quit()
  logging.info(f'The following bundles were not fetched due to missing required fields: {" ".join(map(str, unfetched_bundles))}')
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
  logging.info('Creating merged map')
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
# Running headless chrome speeds the script, but it's not required. To view the browser, remove the headless option.
  op = webdriver.ChromeOptions()
  op.add_argument('headless')
  webpage = webdriver.Chrome(options=op)
  driverWait = wait.WebDriverWait(webpage, 20)
  account_id, username, password, secret_key_2fa = (sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
  bundle_to_components = parse_bundle_components(account_id, username, password, secret_key_2fa, webpage, driverWait)
  merged_bundle_map = create_merged_map(bundle_to_components)
  generate_bundle_map_file(merged_bundle_map)

if __name__=='__main__':
  main()