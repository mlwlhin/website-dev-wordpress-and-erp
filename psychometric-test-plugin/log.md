# How to update the plugin

1. go to gcloud ssh
2. Go to the plugin directory

```bash
cd /var/www/html/wp-content/plugins/psychometric-plugin
```
3. (optional) remove the old plugin file
```bash
sudo rm  assessment_data.json field_to_item.json psychometric-test-integration.php question_list_data.json 
```
4. upload the file to ssh then move to the directory of the plugin file
```bash
sudo mv ~/assessment_data.json ~/field_to_item.json ~/psychometric-test-integration.php ~/question_list_data.json /var/www/html/wp-content/plugins/psychometric-plugin
```
5. reactivate the plugin and test it