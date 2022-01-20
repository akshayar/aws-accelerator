## Create Application
1. Create HIVE appliation. 
```shell
APPLICATION_TYPE=HIVE
S3_BUCKET=akshaya-emr-workshop

APPLICATION_ID=`aws emr-serverless list-applications  | jq -r '.applications[] | select(.type == "'$APPLICATION_TYPE'" ) | .id'`
aws emr-serverless get-application  --application-id ${APPLICATION_ID}

-- Application Cleanup If Required
aws emr-serverless stop-application  --application-id ${APPLICATION_ID}
aws emr-serverless delete-application  --application-id ${APPLICATION_ID}

--Create Application
aws emr-serverless create-application \
  --type HIVE \
  --name serverless-demo \
  --release-label "emr-5.34.0-preview" \
  --initial-capacity '{
        "DRIVER": {
            "workerCount": 1,
            "resourceConfiguration": {
                "cpu": "2vCPU",
                "memory": "4GB",
                "disk": "30gb"
            }
        },
        "TEZ_TASK": {
            "workerCount": 1,
            "resourceConfiguration": {
                "cpu": "4vCPU",
                "memory": "8GB",
                "disk": "30gb"
            }
        }
    }' \
    --maximum-capacity '{
        "cpu": "6vCPU",
        "memory": "1024GB",
        "disk": "1000GB"
    }'
    
APPLICATION_ID=`aws emr-serverless list-applications  | jq -r '.applications[] | select(.type == "'$APPLICATION_TYPE'" ) | .id'`
    
aws emr-serverless get-application  --application-id ${APPLICATION_ID}

ROLE_ARN=`aws iam get-role --role-name emr-serverless-job-role --query Role.Arn --output text`

```

3. Start Application and wait for application to get into "started" state.
```shell
aws emr-serverless start-application  --application-id ${APPLICATION_ID}

aws emr-serverless get-application   --application-id $APPLICATION_ID --query application.state --output text
```

# Run HIVE Job

1. Sumit job
```shell
JOB_RUN_ID=`aws emr-serverless start-job-run \
    --application-id ${APPLICATION_ID} \
    --execution-role-arn ${ROLE_ARN} \
    --job-driver '{
        "hive": {
            "initQueryFile": "s3://'${S3_BUCKET}'/code/hive/create_table.sql",
            "query": "s3://'${S3_BUCKET}'/code/hive/extreme_weather.sql",
            "parameters": "--hiveconf hive.exec.scratchdir=s3://'${S3_BUCKET}'/hive/scratch --hiveconf hive.metastore.warehouse.dir=s3://'${S3_BUCKET}'/hive/warehouse"
        }
    }' \
    --configuration-overrides '{
        "applicationConfiguration": [
            {
                "classification": "hive-site",
                "properties": {
                    "hive.driver.cores": "2",
                    "hive.driver.memory": "4g",
                    "hive.tez.container.size": "8192",
                    "hive.tez.cpu.vcores": "4"
                }
            }
        ],
        "monitoringConfiguration": {
            "s3MonitoringConfiguration": {
                "logUri": "s3://'${S3_BUCKET}'/hive-logs/"
            }
        }
    }' --query jobRunId --output text`
    
 aws emr-serverless list-job-runs --application-id $APPLICATION_ID

 aws emr-serverless get-job-run --application-id $APPLICATION_ID --job-run-id ${JOB_RUN_ID} --query jobRun.state --output text
 
 
 aws s3 cp --recursive s3://akshaya-emr-workshop/hive-logs/applications/$APPLICATION_ID/jobs/${JOB_RUN_ID}/HIVE_DRIVER/ ${JOB_RUN_ID}

 cat ${JOB_RUN_ID}/hive.log.gz | gunzip
 cat ${JOB_RUN_ID}/stderr.gz | gunzip
```